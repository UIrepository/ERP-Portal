import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  VideoReplayIcon,
  Clock01Icon,
  ChartAverageIcon,
  Medal01Icon,
  Idea01Icon,
  Rocket01Icon,
  CheckmarkCircle02Icon,
  Target01Icon,
} from '@hugeicons/core-free-icons';

const DAY = 86400000;
const isoDaysAgo = (d: number) => new Date(Date.now() - d * DAY).toISOString().slice(0, 10);
const hrs = (mins: number) => Math.round((mins / 60) * 10) / 10;

interface ActivityStats {
  my_classes: number;
  my_minutes: number;
  batch_avg_classes: number;
  batch_avg_minutes: number;
  batch_students: number;
  my_rank: number;
}

export const StudentActivity = () => {
  const { profile, user } = useAuth();
  const userId = user?.id || profile?.user_id;

  // Primary batch (the one currently selected on the dashboard).
  const primaryBatch =
    typeof localStorage !== 'undefined' ? localStorage.getItem('student-selected-batch') : null;

  // Own attendance — only this user's rows, capped to the last 120 days.
  const { data: attendance, isLoading: loadingAtt } = useQuery({
    queryKey: ['activity-attendance', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('class_attendance')
        .select('class_date, subject, duration_minutes')
        .eq('user_id', userId)
        .gte('class_date', isoDaysAgo(120))
        .order('class_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  // Own recording-watch progress.
  const { data: progress, isLoading: loadingVid } = useQuery({
    queryKey: ['activity-progress', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('video_progress')
        .select('recording_id, progress_seconds, duration_seconds')
        .eq('user_id', userId);
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  // Batch comparison — one cheap RPC call returning only aggregates.
  const { data: stats } = useQuery<ActivityStats | null>({
    queryKey: ['activity-stats', userId, primaryBatch],
    queryFn: async () => {
      if (!primaryBatch) return null;
      const { data, error } = await (supabase as any).rpc('get_student_activity_stats', {
        p_batch: primaryBatch,
      });
      if (error) return null; // RPC not deployed yet → comparison hidden
      return Array.isArray(data) ? (data[0] ?? null) : data;
    },
    enabled: !!userId && !!primaryBatch,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const m = useMemo(() => {
    const att = attendance ?? [];
    const vid = progress ?? [];
    const liveMinutes = att.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
    const watchedIds = new Set(vid.map((v) => v.recording_id));
    const completed = vid.filter(
      (v) => v.duration_seconds > 0 && v.progress_seconds / v.duration_seconds >= 0.9,
    ).length;
    const watchHours = Math.round((vid.reduce((s, v) => s + (v.progress_seconds ?? 0), 0) / 3600) * 10) / 10;

    const last7 = new Set<string>();
    const last30 = new Set<string>();
    const c7 = isoDaysAgo(7);
    const c30 = isoDaysAgo(30);
    att.forEach((a) => {
      if (a.class_date >= c7) last7.add(a.class_date);
      if (a.class_date >= c30) last30.add(a.class_date);
    });

    return {
      classesAttended: stats?.my_classes ?? att.length,
      liveHours: hrs(stats?.my_minutes ?? liveMinutes),
      lectures: watchedIds.size,
      completed,
      watchHours,
      daysActive30: last30.size,
      daysActive7: last7.size,
    };
  }, [attendance, progress, stats]);

  const percentile = useMemo(() => {
    if (!stats || !stats.batch_students || !stats.my_rank) return null;
    return Math.round(((stats.batch_students - stats.my_rank + 1) / stats.batch_students) * 100);
  }, [stats]);

  const advice = useMemo(() => {
    const tips: string[] = [];
    if (stats && stats.batch_avg_classes && m.classesAttended < stats.batch_avg_classes) {
      const gap = Math.ceil(stats.batch_avg_classes - m.classesAttended);
      tips.push(`You're ${gap} class${gap > 1 ? 'es' : ''} below your batch average — join the next live sessions to catch up.`);
    } else if (stats && stats.batch_avg_classes) {
      tips.push(`You're at or above your batch's average attendance — keep the momentum going.`);
    }
    if (m.daysActive7 === 0) tips.push(`You haven't attended a live class in the last week. Block 30 minutes for the next one.`);
    if (m.lectures > 0 && m.completed / m.lectures < 0.6) tips.push(`You start lectures but leave many unfinished — try finishing one recording fully before starting another.`);
    if (m.watchHours < 2) tips.push(`Low recording time this period. Aim for ~3–4 hours of revision per week.`);
    if (tips.length === 0) tips.push(`Great consistency. Maintain your routine and revise older recordings weekly.`);
    return tips;
  }, [m, stats]);

  const loading = loadingAtt || loadingVid;

  return (
    <div className="w-full max-w-[1840px] mx-auto px-4 md:px-6 py-6 font-sans">
      <div className="w-full bg-white rounded-lg border border-slate-200 shadow-sm p-6 md:p-8 min-h-[400px]">
        {/* Heading */}
        <div className="flex items-center gap-3 mb-1">
          <HugeiconsIcon icon={ChartAverageIcon} size={26} strokeWidth={2} className="text-indigo-600" />
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">My Activity</h2>
        </div>
        <p className="text-sm text-slate-500 mb-8">How you're performing, your time on the platform, and how you compare with your batch.</p>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Calendar03Icon} label="Classes attended" value={m.classesAttended} sub="last 120 days" />
              <StatCard icon={Clock01Icon} label="Live class time" value={`${m.liveHours}h`} sub="in sessions" />
              <StatCard icon={VideoReplayIcon} label="Lectures watched" value={m.lectures} sub={`${m.completed} completed`} />
              <StatCard icon={Target01Icon} label="Revision time" value={`${m.watchHours}h`} sub="recordings" />
            </div>

            {/* Comparison */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">How you compare</h3>
              {stats && stats.batch_students > 0 ? (
                <div className="rounded-lg border border-slate-200 p-5 grid md:grid-cols-3 gap-5">
                  <Compare label="Classes attended" mine={m.classesAttended} avg={stats.batch_avg_classes} unit="" />
                  <Compare label="Live class time" mine={m.liveHours} avg={hrs(stats.batch_avg_minutes)} unit="h" />
                  <div className="flex flex-col justify-center items-center text-center rounded-md bg-indigo-50/60 p-4">
                    <HugeiconsIcon icon={Medal01Icon} size={26} strokeWidth={2} className="text-indigo-600 mb-1" />
                    <p className="text-2xl font-bold text-slate-900">#{stats.my_rank}</p>
                    <p className="text-xs text-slate-500">of {stats.batch_students} students
                      {percentile !== null && ` · top ${100 - percentile + 1}%`}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                  Batch comparison appears once attendance data is available for your batch.
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
                  <PlanItem>Attend every live class for your subjects this week.</PlanItem>
                  <PlanItem>Finish {Math.max(2, Math.round(m.lectures * 0.2) || 3)} recordings end-to-end.</PlanItem>
                  <PlanItem>Spend ~3–4 hours revising notes &amp; DPPs.</PlanItem>
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

const StatCard = ({ icon, label, value, sub }: { icon: typeof Calendar03Icon; label: string; value: string | number; sub: string }) => (
  <div className="rounded-lg border border-slate-200 p-4">
    <HugeiconsIcon icon={icon} size={22} strokeWidth={2} className="text-indigo-600" />
    <p className="text-2xl font-bold text-slate-900 mt-2 leading-none">{value}</p>
    <p className="text-[13px] font-medium text-slate-700 mt-1.5">{label}</p>
    <p className="text-[11px] text-slate-400">{sub}</p>
  </div>
);

const Compare = ({ label, mine, avg, unit }: { label: string; mine: number; avg: number; unit: string }) => {
  const max = Math.max(mine, avg, 1);
  return (
    <div>
      <p className="text-xs font-medium text-slate-700 mb-2">{label}</p>
      <Bar label="You" value={mine} max={max} unit={unit} highlight />
      <Bar label="Batch avg" value={Math.round(avg * 10) / 10} max={max} unit={unit} />
    </div>
  );
};

const Bar = ({ label, value, max, unit, highlight }: { label: string; value: number; max: number; unit: string; highlight?: boolean }) => (
  <div className="flex items-center gap-2 mb-1.5">
    <span className="w-16 shrink-0 text-[11px] text-slate-500">{label}</span>
    <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${highlight ? 'bg-indigo-600' : 'bg-slate-300'}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
    <span className="w-12 shrink-0 text-right text-[11px] font-semibold text-slate-700">{value}{unit}</span>
  </div>
);

const PlanItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2 leading-relaxed">
    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
    {children}
  </li>
);
