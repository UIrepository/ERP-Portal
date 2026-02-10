import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MergedPair {
  batch: string;
  subject: string;
}

/**
 * Given a batch+subject, returns all batch+subject pairs in its merge group
 * (including itself). If no merge exists, returns just the original pair.
 */
export const useMergedSubjects = (batch?: string, subject?: string) => {
  const { data: mergedPairs = [], isLoading } = useQuery<MergedPair[]>({
    queryKey: ['merged-subjects', batch, subject],
    queryFn: async () => {
      if (!batch || !subject) return [{ batch: batch || '', subject: subject || '' }];

      const { data, error } = await supabase.rpc('get_merged_pairs', {
        p_batch: batch,
        p_subject: subject,
      });

      if (error) {
        console.error('Error fetching merged pairs:', error);
        return [{ batch, subject }];
      }

      return (data as MergedPair[]) || [{ batch, subject }];
    },
    enabled: !!batch && !!subject,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Build an OR filter string for Supabase queries
  // UPDATED: Added quotes around values to handle spaces in batch names (e.g. "Class 12")
  const orFilter = mergedPairs.length > 0
    ? mergedPairs.map(p => `and(batch.eq."${p.batch}",subject.eq."${p.subject}")`).join(',')
    : null;

  // Deterministic primary pair: sort alphabetically so both sides of a merge resolve to the same one
  const primaryPair = mergedPairs.length > 0
    ? [...mergedPairs].sort((a, b) => `${a.batch}|${a.subject}`.localeCompare(`${b.batch}|${b.subject}`))[0]
    : (batch && subject ? { batch, subject } : null);

  return { mergedPairs, orFilter, primaryPair, isLoading };
};
