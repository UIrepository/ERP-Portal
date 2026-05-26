import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  VideoReplayIcon,
  Clock01Icon,
  Target01Icon,
  CheckmarkCircle02Icon,
  Idea01Icon,
  Rocket01Icon,
  ChartAverageIcon,
} from '@hugeicons/core-free-icons';

const fmtHrs = (seconds: number) => {
  const h = seconds / 3600;
  return h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(seconds / 60)}m`;
};

export const StudentActivity = () => {
  const { profile, user } = useAuth();
  const userId = user?.id || profile?.user_id;

  // Own recording-watch progress (small, this user's rows only).
  const { data: progress, isLoading } = useQuery({
    queryKey: ['activity-progress', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('video_progress')
        .select('recording_id, progress_seconds, duration_seconds, last_watched_at')
        .eq('user_id', userId)
        .order('last_watched_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  // Titles for the lectures this user has watched.
  const watchedIds = useMemo(
    () => Array.from(new Set((progress ?? []).map((p) => p.recording_id))),
    [progress],
  );
  const { data: recordings } = useQuery({
    queryKey: ['activity-recordings', watchedIds],
    queryFn: async () => {
      if (watchedIds.length === 0) return [];
      const { data } = await supabase
        .from('recordings')
        .select('id, topic, subject')
        .in('id', watchedIds);
      return data ?? [];
    },
    enabled: watchedIds.length > 0,
    staleTime: 10 * 60_000,
  });

  const m = useMemo(() => {
    const vid = progress ?? [];
    const withDuration = vid.filter((v) => v.duration_seconds > 0);
    const completed = withDuration.filter((v) => v.progress_seconds / v.duration_seconds >= 0.9).length;
    const totalSeconds = vid.reduce((s, v) => s + (v.progress_seconds ?? 0), 0);
    const avgCompletion = withDuration.length
      ? Math.round(
          (withDuration.reduce((s, v) => s + Math.min(1, v.progress_seconds / v.duration_seconds), 0) /
            withDuration.length) *
            100,
        )
      : 0;

    const titleById = new Map((recordings ?? []).map((r) => [r.id, r]));
    const recent = vid.slice(0, 6).map((v) => {
      const rec = titleById.get(v.recording_id);
      const pct = v.duration_seconds > 0 ? Math.min(100, Math.round((v.progress_seconds / v.duration_seconds) * 100)) : 0;
      return {
        id: v.recording_id,
        topic: rec?.topic || 'Lecture',
        subject: rec?.subject || '',
        pct,
      };
    });

    return {
      lectures: vid.length,
      completed,
      totalSeconds,
      avgCompletion,
      recent,
    };
  }, [progress, recordings]);

  const advice = useMemo(() => {
    const tips: string[] = [];
    const hours = m.totalSeconds / 3600;
    if (m.lectures === 0) {
      tips.push('You haven\'t watched any recordings yet — open a subject and start with the latest lecture.');
    } else {
      if (m.lectures > 0 && m.completed / m.lectures < 0.6)
        tips.push('You start lectures but leave many unfinished — try finishing one recording fully before opening another.');
      if (hours < 2) tips.push('Low revision time this period. Aim for ~3–4 hours of recordings per week.');
      if (tips.length === 0) tips.push('Great consistency on recordings — keep revising older lectures weekly.');
    }
    return tips;
  }, [m]);

  return (
    <div className="w-full max-w-[1840px] mx-auto px-4 md:px-6 py-6 font-sans">
      <div className="w-full bg-white rounded-lg border border-slate-200 shadow-sm p-6 md:p-8 min-h-[400px]">
        {/* Heading */}
        <div className="flex items-center gap-3 mb-1">
          <HugeiconsIcon icon={ChartAverageIcon} size={26} strokeWidth={2} className="text-indigo-600" />
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">My Activity</h2>
        </div>
        <p className="text-sm text-slate-500 mb-8">Your recording watch time and revision progress.</p>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Clock01Icon} label="Video watched" value={fmtHrs(m.totalSeconds)} sub="total time" />
              <StatCard icon={VideoReplayIcon} label="Lectures watched" value={m.lectures} sub="recordings opened" />
              <StatCard icon={CheckmarkCircle02Icon} label="Completed" value={m.completed} sub="≥ 90% watched" />
              <StatCard icon={Target01Icon} label="Avg completion" value={`${m.avgCompletion}%`} sub="across lectures" />
            </div>

            {/* Recently watched — how much of each video they saw */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Recently watched</h3>
              {m.recent.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                  No watch history yet — your recording progress will show here.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {m.recent.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{r.topic}</p>
                        {r.subject && <p className="text-[11px] text-slate-400">{r.subject}</p>}
                        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${r.pct}%` }} />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-700 w-12 text-right">{r.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Advice + plan */}
            <div className="mt-8 grid md:grid-cols-2 gap-5">
              <div className="rounded-lg border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HugeiconsIcon icon={Idea01Icon} size={20} strokeWidth={2} className="text-amber-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Advice for you</h3>
                </div>
                <ul className="space-y-2.5">
                  {advice.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={2} className="text-emerald-500 mt-0.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HugeiconsIcon icon={Rocket01Icon} size={20} strokeWidth={2} className="text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-800">Your weekly plan</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-600">
                  <PlanItem>Finish {Math.max(2, Math.round(m.lectures * 0.2) || 3)} recordings end-to-end.</PlanItem>
                  <PlanItem>Spend ~3–4 hours revising recordings this week.</PlanItem>
                  <PlanItem>Revisit any lecture you left below 90% complete.</PlanItem>
                  <PlanItem>Post one doubt in the community to stay engaged.</PlanItem>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, sub }: { icon: typeof Clock01Icon; label: string; value: string | number; sub: string }) => (
  <div className="rounded-lg border border-slate-200 p-4">
    <HugeiconsIcon icon={icon} size={22} strokeWidth={2} className="text-indigo-600" />
    <p className="text-2xl font-bold text-slate-900 mt-2 leading-none">{value}</p>
    <p className="text-[13px] font-medium text-slate-700 mt-1.5">{label}</p>
    <p className="text-[11px] text-slate-400">{sub}</p>
  </div>
);

const PlanItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2 leading-relaxed">
    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
    {children}
  </li>
);
