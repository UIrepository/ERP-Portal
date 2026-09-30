import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, LiveStreaming01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChatDrawer } from '@/hooks/useChatDrawer';
import { useContentBuckets, TOPIC_PREFIX, UNSORTED } from '@/hooks/useContentBuckets';
import { useAuth } from '@/hooks/useAuth';
import { COMPLETE_PCT } from '@/lib/videoProgress';

type Kind = 'lectures' | 'dpps' | 'notes' | 'uikp';
type Count = { total: number; done: number };
type TopicProgress = Record<Kind, Count>;

/** Row order and labels under each topic name: "Lecture: 1/3 • DPP: 0/2". */
const PROGRESS_PARTS: { kind: Kind; label: string }[] = [
  { kind: 'lectures', label: 'Lecture' },
  { kind: 'dpps', label: 'DPP' },
  { kind: 'notes', label: 'Notes' },
  { kind: 'uikp', label: 'UI Ki Padhai' },
];

type Progress = { parts: ({ label: string } & Count)[]; total: number; done: number; pct: number };

interface Block {
  id: string;
  label: string;
  stats: string[];
  isLive?: boolean;
  /** Present on topic blocks: drives the "Lecture: 1/3 • DPP: 0/2" row and meter. */
  progress?: Progress;
}

/** Illustration shown on the right of each block. */
const blockArt = (id: string) => {
  if (id.startsWith(TOPIC_PREFIX)) return '/art/topic.png';
  const map: Record<string, string> = {
    'live-class': '/art/lectures.png',
    recordings: '/art/my-learning.png',
    notes: '/art/notes.png',
    dpps: '/art/dpp.png',
    'ui-ki-padhai': '/art/ui-ki-padhai.png',
    announcements: '/art/contact-admin.png',
    community: '/art/community.png',
    connect: '/art/support.png',
  };
  return map[id];
};

const emptyProgress = (): TopicProgress => ({
  lectures: { total: 0, done: 0 },
  dpps: { total: 0, done: 0 },
  notes: { total: 0, done: 0 },
  uikp: { total: 0, done: 0 },
});

interface StudentSubjectBlocksProps {
  batch: string;
  subject: string;
  onBack: () => void;
  onBlockSelect: (blockId: string) => void;
}

export const StudentSubjectBlocks = ({
  batch,
  subject,
  onBack,
  onBlockSelect,
}: StudentSubjectBlocksProps) => {
  const { openSubjectConnect } = useChatDrawer();
  const { user } = useAuth();

  // Fetch real content counts from the database
  const { data: stats, isLoading } = useQuery({
    queryKey: ['subject-stats', batch, subject],
    queryFn: async () => {
      const [recordings, notes, dpp, premium] = await Promise.all([
        supabase
          .from('recordings')
          .select('*', { count: 'exact', head: true })
          .eq('batch', batch)
          .eq('subject', subject),
        supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('batch', batch)
          .eq('subject', subject),
        supabase
          .from('dpp_content')
          .select('*', { count: 'exact', head: true })
          .eq('batch', batch)
          .eq('subject', subject),
        supabase
          .from('ui_ki_padhai_content')
          .select('*', { count: 'exact', head: true })
          .eq('batch', batch)
          .eq('subject', subject),
      ]);

      return {
        videos: recordings.count || 0,
        notes: notes.count || 0,
        exercises: dpp.count || 0,
        premium: premium.count || 0,
      };
    },
    staleTime: 1000 * 60 * 5, 
  });

  // Topics the teacher created for this subject. When there are any, the subject
  // opens into one block per topic (each holding its lectures, DPPs and notes)
  // instead of the flat Lectures / Notes / DPPs blocks. A subject with no topics
  // keeps the original blocks, so nothing changes until someone organises it.
  const { data: buckets = [], isLoading: bucketsLoading } = useContentBuckets(batch, subject);
  const topicMode = buckets.length > 0;

  /**
   * Per-topic progress for this student. "Done" means:
   *   lecture      — watched to COMPLETE_PCT (the same rule the player uses)
   *   DPP          — opened at least once        (student_activities 'dpp_open')
   *   note         — downloaded at least once    ('note_download')
   *   UI Ki Padhai — opened at least once        ('uikp_open')
   * Refetched every time the subject opens, so coming back from a topic shows
   * what was just finished.
   */
  const { data: topicStats, isLoading: topicStatsLoading } = useQuery({
    queryKey: ['subject-topic-stats', batch, subject, user?.id],
    enabled: topicMode && !!user?.id,
    staleTime: 30_000,
    refetchOnMount: 'always',
    queryFn: async () => {
      type Item = { id: string; bucket_id: string | null };
      const [rec, notes, dpp, uikp, acts] = await Promise.all([
        supabase.from('recordings').select('id, bucket_id').eq('batch', batch).eq('subject', subject),
        supabase.from('notes').select('id, bucket_id').eq('batch', batch).eq('subject', subject),
        supabase.from('dpp_content').select('id, bucket_id').eq('batch', batch).eq('subject', subject).eq('is_active', true),
        supabase.from('ui_ki_padhai_content').select('id, bucket_id').eq('batch', batch).eq('subject', subject).eq('is_active', true),
        supabase
          .from('student_activities')
          .select('activity_type, metadata')
          .eq('user_id', user!.id)
          .eq('batch', batch)
          .eq('subject', subject)
          .in('activity_type', ['dpp_open', 'note_download', 'uikp_open']),
      ]);

      const recRows = (rec.data ?? []) as Item[];
      const watched = new Set<string>();
      if (recRows.length) {
        const { data: vp } = await supabase
          .from('video_progress')
          .select('recording_id, progress_seconds, duration_seconds')
          .eq('user_id', user!.id)
          .in('recording_id', recRows.map((r) => r.id));
        (vp ?? []).forEach((v) => {
          const dur = Number(v.duration_seconds) || 0;
          if (dur > 0 && (Number(v.progress_seconds) / dur) * 100 >= COMPLETE_PCT) watched.add(v.recording_id);
        });
      }

      const opened: Record<string, Set<string>> = { dpp_open: new Set(), note_download: new Set(), uikp_open: new Set() };
      const metaKey: Record<string, string> = { dpp_open: 'dppId', note_download: 'noteId', uikp_open: 'uikpId' };
      (acts.data ?? []).forEach((a) => {
        const id = (a.metadata as Record<string, unknown> | null)?.[metaKey[a.activity_type]];
        if (typeof id === 'string') opened[a.activity_type]?.add(id);
      });

      const tally: Record<string, TopicProgress> = {};
      const add = (rows: Item[], kind: Kind, isDone: (id: string) => boolean) =>
        rows.forEach((r) => {
          const c = (tally[r.bucket_id ?? UNSORTED] ??= emptyProgress())[kind];
          c.total += 1;
          if (isDone(r.id)) c.done += 1;
        });
      add(recRows, 'lectures', (id) => watched.has(id));
      add((dpp.data ?? []) as Item[], 'dpps', (id) => opened.dpp_open.has(id));
      add((notes.data ?? []) as Item[], 'notes', (id) => opened.note_download.has(id));
      add((uikp.data ?? []) as Item[], 'uikp', (id) => opened.uikp_open.has(id));
      return tally;
    },
  });

  const toProgress = (t?: TopicProgress): Progress => {
    const parts = PROGRESS_PARTS
      .filter((p) => (t?.[p.kind].total ?? 0) > 0)
      .map((p) => ({ label: p.label, ...t![p.kind] }));
    const total = parts.reduce((n, p) => n + p.total, 0);
    const done = parts.reduce((n, p) => n + p.done, 0);
    return { parts, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  const topicBlocks: Block[] = [
    ...buckets.map((b) => ({ id: `${TOPIC_PREFIX}${b.id}`, label: b.topic, stats: [] as string[], progress: toProgress(topicStats?.[b.id]) })),
    { id: `${TOPIC_PREFIX}${UNSORTED}`, label: 'Other', stats: [] as string[], progress: toProgress(topicStats?.[UNSORTED]) },
  ].filter((t) => (t.progress?.total ?? 0) > 0);

  // Until the topic list is known, show one placeholder instead of flashing the
  // old blocks and then swapping them.
  const contentBlocks: Block[] = bucketsLoading || (topicMode && topicStatsLoading)
    ? [{ id: '__loading__', label: 'Loading topics…', stats: [] as string[] }]
    : topicMode
      ? topicBlocks
      : [
          { id: 'recordings', label: 'Lectures', stats: [isLoading ? 'Loading...' : `${stats?.videos} Videos`, 'Past Classes'] },
          { id: 'notes', label: 'Notes & PDFs', stats: [isLoading ? 'Loading...' : `${stats?.notes} Notes`, 'Assignments'] },
          { id: 'dpps', label: 'DPPs', stats: [isLoading ? 'Loading...' : `${stats?.exercises} DPPs`, 'Daily Practice'] },
        ];

  // Is a class live right now for this subject? Merge-aware: a merged class is
  // signalled under the primary pair, so check every pair merged with this one.
  const { data: isLiveNow = false } = useQuery({
    queryKey: ['subject-live', batch, subject],
    queryFn: async () => {
      const [{ data: merges }, { data: active }] = await Promise.all([
        supabase.from('subject_merges')
          .select('primary_batch, primary_subject, secondary_batch, secondary_subject')
          .eq('is_active', true)
          .or(`and(primary_batch.eq."${batch}",primary_subject.eq."${subject}"),and(secondary_batch.eq."${batch}",secondary_subject.eq."${subject}")`),
        supabase.from('active_classes').select('batch, subject').eq('is_active', true),
      ]);
      const pairs = new Set([`${batch}|${subject}`]);
      (merges ?? []).forEach((m) => {
        pairs.add(`${m.primary_batch}|${m.primary_subject}`);
        pairs.add(`${m.secondary_batch}|${m.secondary_subject}`);
      });
      return (active ?? []).some((a) => pairs.has(`${a.batch}|${a.subject}`));
    },
    enabled: !!batch && !!subject,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const blocks: Block[] = [
    {
      id: 'live-class',
      label: 'Join Live Class',
      stats: ['Ongoing Classes', 'Upcoming Schedule'],
      isLive: true,
    },
    ...contentBlocks,
    // In a subject with topics, UI Ki Padhai items live inside the topics.
    ...(topicMode ? [] : [
      {
        id: 'ui-ki-padhai',
        label: 'UI Ki Padhai',
        stats: [
          isLoading ? 'Loading...' : `${stats?.premium} Premium Content`, 
          'Exclusive Series'
        ],
      },
    ]),
    {
      id: 'announcements',
      label: 'Announcements',
      stats: ['Latest Updates', 'Batch News'],
    },
    {
      id: 'community',
      label: 'Community',
      stats: ['Discussions', 'Peer Support'],
    },
    {
      id: 'connect',
      label: 'Connect',
      stats: ['Chat with Teachers', 'Mentorship'],
    },
  ];

  return (
    <div className="w-full max-w-[1840px] mx-auto px-2 py-3 sm:px-4 sm:py-6 md:px-6 font-sans">

      {/* Single framed content card with 1px black border */}
      <div className="w-full bg-white rounded-lg border border-slate-200 shadow-sm p-3 sm:p-6 md:p-8 min-h-[400px]">

          {/* Back arrow beside the subject title */}
          <div className="flex items-center gap-3 mb-4 sm:mb-8">
            <button
              onClick={onBack}
              aria-label="Back"
              className="shrink-0 text-[#1e293b] hover:opacity-70 transition-opacity"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={26} strokeWidth={2} />
            </button>
            <h2 className="text-xl md:text-2xl font-bold text-[#1e293b] tracking-tight whitespace-normal break-words leading-tight">
              {subject}
            </h2>
          </div>

          <div data-tour="blocks-grid" className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
            {blocks.map((block) => (
              <button
                key={block.id}
                data-tour={`block-${block.id}`}
                disabled={block.id === '__loading__'}
                onClick={() => {
                  if (block.id === 'connect') {
                    openSubjectConnect(batch, subject);
                  } else {
                    onBlockSelect(block.id);
                  }
                }}
                className={cn(
                  "group relative w-full text-left",
                  // White Background, Rounded Corners
                  "bg-white rounded-[4px]", 
                  // Static Border (No hover change)
                  "border border-slate-200", 
                  // No hover effects (transform, shadow, etc. removed)
                  "p-4 sm:p-6", 
                  "flex items-stretch gap-4"
                )}
              >
                {/* Blue Bar */}
                <div className="w-1 bg-[#3b82f6] rounded-full shrink-0" />

                {/* Content */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  {block.progress ? (
                    <>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="truncate text-[17px] font-semibold text-[#1e293b]">{block.label}</h3>
                      </div>

                      {/* Progress row: Lecture: 1/3 | DPP: 0/2 */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#71717a] sm:gap-x-0">
                        {block.progress.parts.map((part, index) => (
                          <span key={part.label} className="flex items-center">
                            {index > 0 && <span className="mx-3 hidden text-[#d4d4d8] sm:inline">|</span>}
                            {part.label}:&nbsp;
                            <span className="font-semibold text-[#1e293b]">{part.done}/{part.total}</span>
                          </span>
                        ))}
                      </div>

                      {/* Meter — deep ink gradient, matching the app's dark buttons */}
                      <div
                        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)]"
                        role="progressbar"
                        aria-valuenow={block.progress.pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${block.label} progress`}
                      >
                        <div
                          className="relative h-full overflow-hidden rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#334155_70%,#64748b_100%)] transition-[width] duration-700"
                          style={{ width: `${Math.max(block.progress.pct, block.progress.done > 0 ? 4 : 0)}%` }}
                        >
                          {block.progress.done > 0 && (
                            <span className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent motion-safe:animate-loading-bar" />
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="mb-2 flex items-center gap-2 text-[17px] font-semibold text-[#1e293b]">
                        {block.label}
                        {block.isLive && isLiveNow && (
                          <span className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide text-red-600">
                            <HugeiconsIcon icon={LiveStreaming01Icon} size={16} strokeWidth={2} className="animate-pulse" />
                            Live
                          </span>
                        )}
                      </h3>

                      {/* Stats Row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#71717a] font-normal sm:gap-x-0">
                        {block.stats.map((stat, index) => (
                          <span key={index} className="flex items-center">
                            {index > 0 && <span className="mx-3 hidden text-[#d4d4d8] sm:inline">|</span>}
                            {stat}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {blockArt(block.id) && (
                  <img
                    src={blockArt(block.id)}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="-my-3 h-16 w-16 shrink-0 self-center object-contain sm:h-24 sm:w-24"
                  />
                )}

              </button>
            ))}
          </div>

      </div>
    </div>
  );
};
