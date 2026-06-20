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
        .order('updated_at', { ascending: false });
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
