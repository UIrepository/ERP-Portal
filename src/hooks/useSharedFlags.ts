import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchCachedFlags, type CachedFlags } from '@/lib/cachedReads';

/**
 * Global app flags (maintenance mode + feedback gate) through ONE shared query.
 *
 * Both flags used to be polled separately by every client straight from
 * Supabase (~900 requests/day between them). They now ride the Vercel-edge-
 * cached /api/shared?resource=flags feed, so Supabase serves roughly one read
 * per minute TOTAL, not per user. Falls back to direct reads when the endpoint
 * is unavailable (vite dev has no /api server).
 *
 * Every consumer shares the same queryKey, so mounting this hook in N places
 * still costs at most one request per refetch window.
 */
export function useSharedFlags() {
  return useQuery<CachedFlags>({
    queryKey: ['shared-flags'],
    queryFn: async (): Promise<CachedFlags> => {
      try {
        return await fetchCachedFlags();
      } catch {
        // Endpoint unavailable — read both flags directly (tiny, single rows).
        // (`as any`: feedback_gate postdates the generated Supabase types, same
        // workaround the rest of the codebase uses for it.)
        const [m, g] = await Promise.all([
          supabase
            .from('maintenance_settings')
            .select('is_maintenance_mode, maintenance_message')
            .maybeSingle(),
          (supabase as any).from('feedback_gate').select('enabled, scope').eq('id', 1).maybeSingle(),
        ]);
        return {
          maintenance: m.data ?? { is_maintenance_mode: false, maintenance_message: null },
          feedback_gate: (g.data ?? { enabled: false, scope: 'everywhere' }) as CachedFlags['feedback_gate'],
        };
      }
    },
    // The CDN already holds the shared copy for ~60s; the client just needs to
    // come back for it occasionally. Worst-case flag flip latency ≈ 6 min.
    staleTime: 120_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}
