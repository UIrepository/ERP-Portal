import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Week / chapter buckets for one subject inside one batch.
 *
 * Buckets are just rows a teacher creates — "Week 1", "Chapter 3", "Revision".
 * Nothing in the code knows or cares what they are called.
 *
 * Content whose bucket_id is null is NOT an error state: it is everything
 * uploaded before buckets existed, plus anything added straight to the
 * database. Screens render those under a trailing "Unsorted" group, which is
 * why there is no Unsorted row in the table.
 */

export interface ContentBucket {
  id: string;
  batch: string;
  subject: string;
  name: string;
  position: number;
}

/** Sentinel used as a grouping key for items with no bucket. */
export const UNSORTED = '__unsorted__';
export const UNSORTED_LABEL = 'Unsorted';

export const useContentBuckets = (batch?: string, subject?: string) =>
  useQuery<ContentBucket[]>({
    queryKey: ['content-buckets', batch, subject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_buckets')
        .select('id, batch, subject, name, position')
        .eq('batch', batch!)
        .eq('subject', subject!)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContentBucket[];
    },
    enabled: !!batch && !!subject,
    staleTime: 5 * 60_000,
  });

/**
 * Get-or-create a bucket by name across the whole merge group.
 *
 * Going live writes one recording per merged pair, and a bucket belongs to a
 * single (batch, subject) — so picking "Week 5" once has to produce a Week 5
 * in every batch of the group. ensure_bucket_group does that in one round trip
 * and is idempotent, so calling it for an existing name just returns the ids.
 *
 * Returns the bucket id for the pair that was asked for.
 */
export const ensureBucketGroup = async (
  batch: string,
  subject: string,
  name: string,
): Promise<{ byPair: Record<string, string>; own: string | null }> => {
  const { data, error } = await supabase.rpc('ensure_bucket_group', {
    p_batch: batch,
    p_subject: subject,
    p_name: name,
  });
  if (error) throw error;

  const rows = (data ?? []) as { bucket_batch: string; bucket_subject: string; bucket_id: string }[];
  const byPair: Record<string, string> = {};
  rows.forEach((r) => { byPair[`${r.bucket_batch}|${r.bucket_subject}`] = r.bucket_id; });

  return { byPair, own: byPair[`${batch}|${subject}`] ?? null };
};

/** Drops every cached bucket list — call after creating or renaming one. */
export const useInvalidateBuckets = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['content-buckets'] });
};
