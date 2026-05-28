import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Mirrors the "seen" bookkeeping used inside StudentCommunity so the nav badge
// and the in-page unread counts stay in agreement (same localStorage keys).
const seenKey = (batch: string, subject: string) => `community-seen-${batch}|${subject}`;

/**
 * Total unread community messages across every batch+subject the student is
 * enrolled in. Used to badge the Community tab in the mobile bottom nav.
 * "Unread" = messages from someone else, newer than the last time the student
 * opened that community (persisted in localStorage by StudentCommunity).
 */
export function useCommunityUnread(): number {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const uid = profile?.user_id;

  const { data: enrollments = [] } = useQuery({
    queryKey: ['community-enrollments', uid],
    queryFn: async () => {
      if (!uid) return [] as { batch_name: string; subject_name: string }[];
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', uid);
      if (error) throw error;
      return data || [];
    },
    enabled: !!uid,
  });

  const pairs = enrollments.map((e) => `${e.batch_name}|${e.subject_name}`).join(',');

  const { data: total = 0 } = useQuery<number>({
    queryKey: ['community-unread-total', uid, pairs],
    queryFn: async () => {
      let sum = 0;
      await Promise.all(
        enrollments.map(async (e) => {
          const { data: last } = await supabase
            .from('community_messages')
            .select('created_at')
            .eq('batch', e.batch_name)
            .eq('subject', e.subject_name)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const lastAt = (last as { created_at: string } | null)?.created_at ?? null;
          let seen: string | null = null;
          try { seen = localStorage.getItem(seenKey(e.batch_name, e.subject_name)); } catch { /* ignore */ }
          if (lastAt && (!seen || new Date(lastAt) > new Date(seen))) {
            const { count } = await supabase
              .from('community_messages')
              .select('*', { count: 'exact', head: true })
              .eq('batch', e.batch_name)
              .eq('subject', e.subject_name)
              .eq('is_deleted', false)
              .neq('user_id', uid || '')
              .gt('created_at', seen || '1970-01-01T00:00:00Z');
            sum += count ?? 0;
          }
        })
      );
      return sum;
    },
    enabled: enrollments.length > 0 && !!uid,
    refetchInterval: 30000,
  });

  // Refresh promptly when a new community message lands (rather than waiting
  // for the 30s poll), so the badge feels live.
  useEffect(() => {
    if (!uid || enrollments.length === 0) return;
    const channel = supabase
      .channel('community-unread-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['community-unread-total'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, enrollments.length, queryClient]);

  return total;
}
