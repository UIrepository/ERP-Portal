import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/**
 * Per-community chat overview shared by the student, teacher and admin
 * community views. A single SECURITY INVOKER RPC returns, per group the
 * caller can read (RLS-scoped), the latest message + time + total + unread.
 * This lets every view sort chats "most recent conversation on top" and show
 * a message preview, a time, and an unread badge — without N+1 per-group
 * queries (admin lists 45+ groups).
 */

export interface GroupSummary {
  last_at: string | null;
  last_content: string | null;
  total: number;
  unread: number;
}

const SEEN_PREFIX = 'community-seen-';
const seenKey = (batch: string, subject: string) => `${SEEN_PREFIX}${batch}|${subject}`;

// Collect every "batch|subject" -> last-opened ISO stamp the user has stored.
function readSeenMap(): Record<string, string> {
  const map: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SEEN_PREFIX)) {
        const v = localStorage.getItem(k);
        if (v) map[k.slice(SEEN_PREFIX.length)] = v;
      }
    }
  } catch { /* ignore */ }
  return map;
}

export function useCommunitySummaries(enabled = true) {
  const queryClient = useQueryClient();
  const seen = readSeenMap();
  const seenSig = JSON.stringify(seen);

  const { data: summaries = {} } = useQuery<Record<string, GroupSummary>>({
    queryKey: ['community-summaries', seenSig],
    enabled,
    refetchInterval: 120000, // realtime keeps chats fresh; this is a safety net
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_community_group_summaries', { seen });
      if (error) throw error;
      const map: Record<string, GroupSummary> = {};
      (data ?? []).forEach((r: any) => {
        map[`${r.batch}|${r.subject}`] = {
          last_at: r.last_at ?? null,
          last_content: r.last_content ?? null,
          total: Number(r.total) || 0,
          unread: Number(r.unread) || 0,
        };
      });
      return map;
    },
  });

  const getSummary = useCallback(
    (batch?: string | null, subject?: string | null): GroupSummary | undefined =>
      batch && subject ? summaries[`${batch}|${subject}`] : undefined,
    [summaries],
  );

  // Record that the user just opened this chat, so its unread badge clears.
  const markSeen = useCallback((batch?: string | null, subject?: string | null) => {
    if (!batch || !subject) return;
    try { localStorage.setItem(seenKey(batch, subject), new Date().toISOString()); } catch { /* ignore */ }
    queryClient.invalidateQueries({ queryKey: ['community-summaries'] });
  }, [queryClient]);

  // Sort groups by most-recent activity; groups with no messages fall to the
  // bottom in stable alphabetical order.
  const orderGroups = useCallback(
    <T,>(groups: T[], keyOf: (g: T) => { batch: string; subject: string }): T[] =>
      [...groups].sort((a, b) => {
        const ka = keyOf(a); const kb = keyOf(b);
        const aAt = summaries[`${ka.batch}|${ka.subject}`]?.last_at || '';
        const bAt = summaries[`${kb.batch}|${kb.subject}`]?.last_at || '';
        if (aAt && bAt) return bAt.localeCompare(aAt);
        if (aAt) return -1;
        if (bAt) return 1;
        return `${ka.batch} ${ka.subject}`.localeCompare(`${kb.batch} ${kb.subject}`);
      }),
    [summaries],
  );

  return { summaries, getSummary, markSeen, orderGroups };
}

// Compact WhatsApp-style timestamp for a chat-list row.
export function formatChatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'dd/MM/yy');
  } catch { return ''; }
}
