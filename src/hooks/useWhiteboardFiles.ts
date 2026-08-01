import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface WhiteboardFile {
  id: string;
  owner_id: string;
  title: string;
  content_url: string | null;
  content_public_id: string | null;
  thumbnail_url: string | null;
  thumbnail_public_id: string | null;
  created_at: string;
  updated_at: string;
  // Only populated in the admin (all-teachers) view.
  ownerName?: string | null;
  ownerEmail?: string | null;
}

/** The signed-in teacher's / admin's own whiteboard files (RLS returns own). */
export function useMyWhiteboards() {
  const { user, profile } = useAuth();
  const uid = user?.id || profile?.user_id;
  return useQuery<WhiteboardFile[]>({
    queryKey: ['my-whiteboards', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whiteboard_files')
        .select('*')
        .eq('owner_id', uid)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WhiteboardFile[];
    },
  });
}

/** Every teacher's whiteboards, with owner name — admins only (RLS returns all). */
export function useAllWhiteboards(enabled: boolean) {
  return useQuery<WhiteboardFile[]>({
    queryKey: ['all-whiteboards'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whiteboard_files')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const files = (data || []) as WhiteboardFile[];
      // Attach owner names (scoped lookup — no 1000-row cap risk).
      const ownerIds = Array.from(new Set(files.map((f) => f.owner_id)));
      if (ownerIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', ownerIds);
        const map = new Map((profs || []).map((p) => [p.user_id, p]));
        files.forEach((f) => {
          const p = map.get(f.owner_id);
          f.ownerName = p?.name ?? null;
          f.ownerEmail = p?.email ?? null;
        });
      }
      return files;
    },
  });
}

export type WhiteboardShareRole = 'viewer' | 'editor';

export interface WhiteboardViewer {
  id: string;
  whiteboard_id: string;
  email: string;
  role: WhiteboardShareRole;
  created_at: string;
}

/**
 * Viewers granted read-only access to one board. RLS restricts this table to
 * admins, so only they can list, add or revoke — a viewer can never re-share.
 */
export function useWhiteboardViewers(whiteboardId: string | null) {
  return useQuery<WhiteboardViewer[]>({
    queryKey: ['whiteboard-viewers', whiteboardId],
    enabled: !!whiteboardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whiteboard_viewers')
        .select('id, whiteboard_id, email, role, created_at')
        .eq('whiteboard_id', whiteboardId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as WhiteboardViewer[];
    },
  });
}

export function useWhiteboardViewerMutations() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const uid = user?.id || profile?.user_id;
  const invalidate = (whiteboardId: string) =>
    qc.invalidateQueries({ queryKey: ['whiteboard-viewers', whiteboardId] });

  const addViewer = useMutation({
    mutationFn: async (
      { whiteboardId, email, role }: { whiteboardId: string; email: string; role: WhiteboardShareRole },
    ) => {
      const clean = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Enter a valid email address');
      // Re-adding an existing person updates their access level instead of failing.
      const { error } = await supabase
        .from('whiteboard_viewers')
        .upsert(
          { whiteboard_id: whiteboardId, email: clean, role, added_by: uid },
          { onConflict: 'whiteboard_id,email' },
        );
      // Surface the real reason (permissions, constraints) instead of a generic
      // "could not add" that hides what actually went wrong.
      if (error) throw new Error(error.message || 'Could not add person');
    },
    onSuccess: (_d, v) => invalidate(v.whiteboardId),
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: WhiteboardShareRole; whiteboardId: string }) => {
      const { error } = await supabase.from('whiteboard_viewers').update({ role }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.whiteboardId),
  });

  const removeViewer = useMutation({
    mutationFn: async ({ id }: { id: string; whiteboardId: string }) => {
      const { error } = await supabase.from('whiteboard_viewers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.whiteboardId),
  });

  return { addViewer, removeViewer, setRole };
}

export function useWhiteboardMutations() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const uid = user?.id || profile?.user_id;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-whiteboards'] });
    qc.invalidateQueries({ queryKey: ['all-whiteboards'] });
  };

  const create = useMutation({
    mutationFn: async (title: string): Promise<WhiteboardFile> => {
      if (!uid) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('whiteboard_files')
        .insert({ owner_id: uid, title: title.trim() || 'Untitled whiteboard' })
        .select()
        .single();
      if (error) throw error;
      return data as WhiteboardFile;
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from('whiteboard_files')
        .update({ title: title.trim() || 'Untitled whiteboard' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whiteboard_files').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, rename, remove };
}
