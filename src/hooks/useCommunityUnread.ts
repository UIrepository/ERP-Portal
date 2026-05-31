import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Mirrors the "seen" bookkeeping used inside StudentCommunity so the nav badge
// and the in-page unread counts stay in agreement (same localStorage keys).
const seenKey = (batch: string, subject: string) => `community-seen-${batch}|${subject}`;

const EPOCH = '1970-01-01T00:00:00Z';

/**
 * Total unread community messages across every batch+subject the student is
 * enrolled in. Used to badge the Community tab in the mobile bottom nav.
 *
 * Cost-conscious: this hook is mounted app-wide (in Layout), so it must stay
 * cheap. It runs ONE bounded query per minute (not a fan-out per group) and
 * does NOT keep a realtime subscription — a badge that updates within a minute
 * (and immediately on remount, e.g. after visiting the community page) is more
 * than enough, and avoids re-querying on every message for every student.
 */
export function useCommunityUnread(): number {
  const { profile } = useAuth();
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

  const batches = [...new Set(enrollments.map((e) => e.batch_name))];
  const subjects = [...new Set(enrollments.map((e) => e.subject_name))];
  const pairKey = enrollments.map((e) => `${e.batch_name}|${e.subject_name}`).join(',');

  const { data: total = 0 } = useQuery<number>({
    queryKey: ['community-unread-total', uid, pairKey],
    queryFn: async () => {
      if (enrollments.length === 0) return 0;

      // Per-group last-seen timestamps (set by StudentCommunity in localStorage).
      const seenMap: Record<string, string | null> = {};
      const seenValues: (string | null)[] = [];
      for (const e of enrollments) {
        let s: string | null = null;
        try { s = localStorage.getItem(seenKey(e.batch_name, e.subject_name)); } catch { /* ignore */ }
        seenMap[`${e.batch_name}|${e.subject_name}`] = s;
        seenValues.push(s);
      }
      // We only need messages newer than the EARLIEST group's "seen" cutoff.
      const from = seenValues.some((s) => !s)
        ? EPOCH
        : seenValues.reduce((min, s) => (s! < min ? s! : min), seenValues[0] as string);

      // ONE bounded request. `.in(batch).in(subject)` is a cross-product, so it
      // can include (batch,subject) combos the student isn't actually in — we
      // filter to the exact enrolled pairs client-side below. 60 rows is plenty
      // for a badge that caps at "9+".
      const { data, error } = await supabase
        .from('community_messages')
        .select('batch, subject, created_at')
        .in('batch', batches)
        .in('subject', subjects)
        .eq('is_deleted', false)
        .neq('user_id', uid || '')
        .gt('created_at', from)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;

      const enrolledPairs = new Set(Object.keys(seenMap));
      let sum = 0;
      for (const m of data || []) {
        const key = `${m.batch}|${m.subject}`;
        if (!enrolledPairs.has(key)) continue;
        const seen = seenMap[key];
        if (!seen || new Date(m.created_at) > new Date(seen)) sum++;
      }
      return sum;
    },
    enabled: enrollments.length > 0 && !!uid,
    refetchInterval: 60000,
  });

  return total;
}
