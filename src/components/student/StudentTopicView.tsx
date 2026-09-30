import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useContentBuckets, UNSORTED } from '@/hooks/useContentBuckets';
import { StudentBackButton } from './StudentBackButton';
import { StudentRecordings } from './StudentRecordings';
import { StudentNotes } from './StudentNotes';
import { StudentDPP } from './StudentDPP';
import { StudentUIKiPadhai } from './StudentUIKiPadhai';

interface StudentTopicViewProps {
  batch: string;
  subject: string;
  /** A content_buckets id, or UNSORTED for the "Other" group. */
  topicId: string;
  onBack: () => void;
}

type Kind = 'lectures' | 'dpps' | 'notes' | 'uikp';

type TopicCounts = Record<Kind, number>;

/** How many of each kind of content sits in this topic. Head-only, so no rows travel. */
export const useTopicCounts = (batch: string, subject: string, topicId: string) =>
  useQuery<TopicCounts>({
    queryKey: ['topic-counts', batch, subject, topicId],
    staleTime: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = (q: any) => (topicId === UNSORTED ? q.is('bucket_id', null) : q.eq('bucket_id', topicId));
      const head = { count: 'exact' as const, head: true };
      const [lectures, notes, dpps, uikp] = await Promise.all([
        scope(supabase.from('recordings').select('id', head).eq('batch', batch).eq('subject', subject)),
        scope(supabase.from('notes').select('id', head).eq('batch', batch).eq('subject', subject)),
        scope(supabase.from('dpp_content').select('id', head).eq('batch', batch).eq('subject', subject).eq('is_active', true)),
        scope(supabase.from('ui_ki_padhai_content').select('id', head).eq('batch', batch).eq('subject', subject).eq('is_active', true)),
      ]);
      return {
        lectures: lectures.count ?? 0,
        notes: notes.count ?? 0,
        dpps: dpps.count ?? 0,
        uikp: uikp.count ?? 0,
      };
    },
  });

const TABS: { id: Kind; label: string }[] = [
  { id: 'lectures', label: 'Lectures' },
  { id: 'dpps', label: 'DPPs' },
  { id: 'notes', label: 'Notes' },
  { id: 'uikp', label: 'UI Ki Padhai' },
];

/**
 * One topic inside a subject: the topic name, a tab bar (Lectures / DPPs /
 * Notes / UI Ki Padhai) and that topic's content. Each tab reuses the existing
 * lecture, DPP, notes and UI Ki Padhai cards, narrowed to this topic, so they
 * open and download exactly as before.
 */
export const StudentTopicView = ({ batch, subject, topicId, onBack }: StudentTopicViewProps) => {
  const [picked, setPicked] = useState<Kind | null>(null);
  const { data: buckets = [] } = useContentBuckets(batch, subject);
  const { data: counts, isLoading } = useTopicCounts(batch, subject, topicId);

  const topicName = topicId === UNSORTED ? 'Other' : buckets.find((b) => b.id === topicId)?.topic ?? '';

  // Only offer tabs that have something in them; open on the first one.
  const available = TABS.filter((t) => (counts?.[t.id] ?? 0) > 0);
  const tab: Kind | undefined = available.some((t) => t.id === picked) ? picked! : available[0]?.id;

  return (
    <div className="w-full font-sans">
      {/* Topic name */}
      <div className="flex items-center gap-3 px-3 pt-4 sm:px-8 sm:pt-7">
        <StudentBackButton onClick={onBack} />
        <h1 className="min-w-0 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{topicName}</h1>
      </div>

      {/* Tab bar */}
      {available.length > 0 && (
        <div className="no-scrollbar sticky top-0 z-40 mt-2 border-b border-transparent shadow-[0_6px_8px_-6px_rgba(15,23,42,0.12)] sm:shadow-none overflow-x-auto bg-white px-3 py-2 sm:static sm:mt-5 sm:px-8 sm:py-0">
          <div
            role="tablist"
            aria-label={`${topicName} content`}
            className="inline-flex min-w-max items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-1"
          >
            {available.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPicked(t.id)}
                  className={cn(
                    'whitespace-nowrap rounded px-4 py-1.5 text-[14px] transition-colors sm:px-5',
                    active
                      ? 'bg-brand font-semibold text-white shadow-sm'
                      : 'font-normal text-slate-600 hover:text-slate-900',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-3 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-6">
        {isLoading ? null : !tab ? (
          <div className="py-12 text-center text-sm text-slate-500"><img src="/art/empty.png" alt="" aria-hidden width={160} height={160} draggable={false} className="mx-auto mb-3 object-contain" />Nothing has been added to this topic yet.</div>
        ) : (
          <>
            {tab === 'lectures' && <StudentRecordings batch={batch} subject={subject} topicId={topicId} />}
            {tab === 'dpps' && <StudentDPP batch={batch} subject={subject} topicId={topicId} />}
            {tab === 'notes' && <StudentNotes batch={batch} subject={subject} topicId={topicId} />}
            {tab === 'uikp' && <StudentUIKiPadhai batch={batch} subject={subject} topicId={topicId} />}
          </>
        )}
      </div>
    </div>
  );
};
