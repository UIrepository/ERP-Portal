import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseVideoUrl } from '@/components/video-player/useVideoPlayer';
import { useIsMobile } from '@/hooks/use-mobile';
import { openInternalRoute } from '@/hooks/useInstallApp';

const UI_LOGO = 'https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png';

interface TodaysClassStripProps {
  batch?: string | null;
  enrolledSubjects?: string[];
  /** Switch the dashboard to the "Join Live Class" tab. */
  onJoinLive?: () => void;
}

interface ScheduleRow {
  subject: string;
  start_time: string;
  end_time: string;
  date: string | null;
  day_of_week: number | null;
}
interface ActiveRow { subject: string; started_at: string | null }
interface RecordingRow { id: string; subject: string; topic: string; embed_link: string; date: string }

const IST_OFFSET_MIN = 330;
const hhmmToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
};
// Format a timestamptz as an IST clock time (e.g. active_classes.started_at).
const fmtTsIST = (ts: string) => {
  const d = new Date(new Date(ts).getTime() + IST_OFFSET_MIN * 60000);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

/** A video frame: the real thumbnail if we have one, else a small UI logo on
 *  light grey. Slightly inset from the card edge, lightly rounded, no shadow. */
const Frame = ({ thumb, children }: { thumb?: string | null; children?: React.ReactNode }) => (
  <div className="p-1.5">
    <div className="relative aspect-video overflow-hidden rounded-[3px] bg-slate-100">
      {thumb ? (
        <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <img src={UI_LOGO} alt="" className="h-7 w-7 object-contain opacity-80" />
        </div>
      )}
      {children}
    </div>
  </div>
);

/**
 * "Today's class" strip, above Continue watching. Shows, for the current batch
 * + enrolled subjects: live-now classes (red tag), today's uploaded recordings
 * (open in the player), and today's not-yet-started scheduled classes. Renders
 * nothing when the day has none of the three.
 */
export const TodaysClassStrip = ({ batch, enrolledSubjects = [], onJoinLive }: TodaysClassStripProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const ist = new Date(Date.now() + IST_OFFSET_MIN * 60000); // read via getUTC* = IST wall clock
  const todayStr = ist.toISOString().slice(0, 10);
  const dow = ist.getUTCDay();
  const nowMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const subjectsKey = enrolledSubjects.slice().sort().join(',');

  const { data } = useQuery({
    queryKey: ['todays-class', batch, subjectsKey, todayStr],
    enabled: !!batch && enrolledSubjects.length > 0,
    // Live status must stay fresh (no realtime backup), so poll and never serve
    // stale on mount. Small, batch+subject-scoped selects keep egress modest.
    staleTime: 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const [schedRes, activeRes, recRes] = await Promise.all([
        supabase.from('schedules').select('subject, start_time, end_time, date, day_of_week')
          .eq('batch', batch).in('subject', enrolledSubjects)
          .or(`day_of_week.eq.${dow},date.eq.${todayStr}`),
        supabase.from('active_classes').select('subject, started_at')
          .eq('batch', batch).in('subject', enrolledSubjects).eq('is_active', true),
        supabase.from('recordings').select('id, subject, topic, embed_link, date')
          .eq('batch', batch).in('subject', enrolledSubjects).eq('date', todayStr)
          .order('created_at', { ascending: false }),
      ]);
      return {
        schedules: (schedRes.data || []) as ScheduleRow[],
        active: (activeRes.data || []) as ActiveRow[],
        recordings: (recRes.data || []) as RecordingRow[],
      };
    },
  });

  const { liveList, upcoming, recordings, endBySubject } = useMemo(() => {
    const schedules = (data?.schedules || []).filter((s) =>
      s.date ? s.date === todayStr : s.day_of_week === dow,
    );
    // Only count a class as live if it started today (IST). active_classes can
    // hold stale is_active=true rows from past sessions whose end never wrote
    // back; without this guard a subject would read "Currently Live" forever.
    const liveMap = new Map<string, string>(); // subject -> started_at
    (data?.active || []).forEach((a) => {
      if (!a.started_at) return;
      const startedToday = new Date(new Date(a.started_at).getTime() + IST_OFFSET_MIN * 60000)
        .toISOString().slice(0, 10) === todayStr;
      if (startedToday && !liveMap.has(a.subject)) liveMap.set(a.subject, a.started_at);
    });
    const liveSet = new Set(liveMap.keys());

    // Scheduled end time per subject today, used for the recording "Ended at".
    const endMap = new Map<string, string>();
    schedules.forEach((s) => {
      const cur = endMap.get(s.subject);
      if (!cur || s.end_time > cur) endMap.set(s.subject, s.end_time);
    });

    const seen = new Set<string>();
    const up = schedules
      .filter((s) => !liveSet.has(s.subject) && hhmmToMin(s.start_time) > nowMin)
      .filter((s) => {
        const k = `${s.subject}-${s.start_time}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => hhmmToMin(a.start_time) - hhmmToMin(b.start_time));

    return {
      liveList: Array.from(liveMap, ([subject, startedAt]) => ({ subject, startedAt })),
      upcoming: up,
      recordings: data?.recordings || [],
      endBySubject: endMap,
    };
  }, [data, todayStr, dow, nowMin]);

  const total = liveList.length + upcoming.length + recordings.length;
  if (total === 0) return null;

  const openLecture = (id: string) => {
    const url = `/lecture/${id}`;
    if (isMobile) openInternalRoute(url, navigate);
    else navigate(url);
  };

  // Fixed text-area height so every card is the same size and the frames line up.
  const textArea = 'px-2 pb-2 pt-0.5 min-h-[38px]';

  return (
    <section className="bg-white rounded-lg border border-slate-100 shadow-sm p-4">
      {/* Heading row: title left, green "join live" hint on the right */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-[#1e293b]">Today's class</h2>
        {liveList.length > 0 && (
          <button
            type="button"
            onClick={onJoinLive}
            className="shrink-0 text-right text-[11px] sm:text-[12px] font-normal text-emerald-800 hover:text-emerald-900 font-sans"
          >
            To join the live class, click the Join Live Class tab.
          </button>
        )}
      </div>

      <div className="flex items-start gap-2.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
        {/* Live now — red "Currently Live" with the subject name. Click the frame. */}
        {liveList.map(({ subject, startedAt }) => (
          <div key={`live-${subject}`} className="shrink-0 w-[136px] rounded-md overflow-hidden border border-slate-200 bg-white">
            <button type="button" onClick={onJoinLive} className="block w-full">
              <Frame>
                <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-[3px] bg-red-600 px-1 py-[1px] text-[8px] font-normal text-white font-sans">
                  <span className="h-1 w-1 rounded-full bg-white animate-pulse" /> Currently Live
                </span>
              </Frame>
            </button>
            <div className={textArea}>
              <p className="text-[12px] font-semibold text-slate-900 line-clamp-1 leading-snug">{subject}</p>
              <p className="text-[10.5px] text-slate-500 mt-0.5">Started at {fmtTsIST(startedAt)}</p>
            </div>
          </div>
        ))}

        {/* Recordings uploaded today — click the frame; keep the subject name. */}
        {recordings.map((rec) => {
          const parsed = parseVideoUrl(rec.embed_link);
          const thumb = parsed.type === 'youtube' && parsed.videoId
            ? `https://img.youtube.com/vi/${parsed.videoId}/mqdefault.jpg`
            : null;
          return (
            <div key={`rec-${rec.id}`} className="shrink-0 w-[136px] rounded-md overflow-hidden border border-slate-200 bg-white">
              <button type="button" onClick={() => openLecture(rec.id)} className="group block w-full">
                <Frame thumb={thumb}>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-9 w-9 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="h-4 w-4 text-slate-900 ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                </Frame>
              </button>
              <div className={textArea}>
                <p className="text-[12px] font-semibold text-slate-900 line-clamp-1 leading-snug">{rec.subject}</p>
                {endBySubject.get(rec.subject) && (
                  <p className="text-[10.5px] text-slate-500 mt-0.5">Ended at {fmtTime(endBySubject.get(rec.subject)!)}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Upcoming today — subject + start time (not clickable) */}
        {upcoming.map((s) => (
          <div key={`up-${s.subject}-${s.start_time}`} className="shrink-0 w-[136px] rounded-md overflow-hidden border border-slate-200 bg-white">
            <Frame />
            <div className={textArea}>
              <p className="text-[12px] font-semibold text-slate-800 line-clamp-1 leading-snug">{s.subject}</p>
              <p className="text-[10.5px] text-slate-500 mt-0.5">Starts {fmtTime(s.start_time)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
