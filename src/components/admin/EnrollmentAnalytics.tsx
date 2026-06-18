import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserGroupIcon,
  Layers01Icon,
  BookOpen01Icon,
  Mortarboard01Icon,
  ChartColumnStackedIcon,
  PieChartIcon,
  ChartColumnIcon,
  FilterHorizontalIcon,
  Search01Icon,
  Alert02Icon,
} from '@hugeicons/core-free-icons';
import { Loader2 } from 'lucide-react';

// --- Interfaces ---
interface Enrollment {
  batch_name: string;
  subject_name: string;
  profiles: { name: string; email: string } | null;
}
interface StudentEnrollmentInfo {
  name: string;
  email: string;
  enrollments: { batch: string; subject: string }[];
}

// Refined, muted categorical palette (no neon, no gradients).
const COLORS = ['#4f46e5', '#0ea5e9', '#14b8a6', '#f59e0b', '#e11d48', '#8b5cf6', '#10b981', '#64748b'];

// Batch/subject names are long ("Foundation Quiz 1 - May 26 Data Science") and
// collide on axes/legends. Truncate for display; full names stay in tooltips.
const shortLabel = (s: unknown, n = 16) => {
  const v = String(s ?? '');
  return v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v;
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((e: any) => e.value > 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((s: number, e: any) => s + (e.value || 0), 0);
  return (
    <div className="px-3 py-2 bg-white border border-slate-200 rounded-md shadow-lg font-sans min-w-[150px]">
      {label && <p className="font-semibold text-slate-900 text-[13px] mb-1.5">{label}</p>}
      {rows.map((e: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: e.color || e.payload?.fill }} />
            {e.name}
          </span>
          <span className="font-semibold text-slate-900 tabular-nums">{e.value}</span>
        </div>
      ))}
      {rows.length > 1 && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400">Total</span>
          <span className="font-bold text-slate-900 tabular-nums">{total}</span>
        </div>
      )}
    </div>
  );
};

const Kpi = ({ icon, label, value, hint }: { icon: typeof UserGroupIcon; label: string; value: string | number; hint?: string }) => (
  <Card className="border-slate-200 shadow-none p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-3xl font-bold text-slate-900 tabular-nums mt-2 leading-none">{value}</p>
        {hint && <p className="text-xs text-slate-400 mt-2">{hint}</p>}
      </div>
      <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
        <HugeiconsIcon icon={icon} size={18} strokeWidth={2} />
      </div>
    </div>
  </Card>
);

const ChartCard = ({ icon, title, subtitle, children }: { icon: typeof UserGroupIcon; title: string; subtitle?: string; children: React.ReactNode }) => (
  <Card className="border-slate-200 shadow-none p-5">
    <div className="flex items-center gap-2.5 mb-4">
      <HugeiconsIcon icon={icon} size={18} strokeWidth={2} className="text-slate-400" />
      <div>
        <h3 className="text-sm font-semibold text-slate-900 leading-none">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
    {children}
  </Card>
);

export const EnrollmentAnalytics = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('admin-enrollment-analytics-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_enrollments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['enrollment-analytics-enrollments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['enrollment-analytics-enrollments'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: enrollments = [], isLoading, isError, error } = useQuery({
    queryKey: ['enrollment-analytics-enrollments'],
    queryFn: async (): Promise<Enrollment[]> => {
      const { data: enrollmentData, error: enrollError } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name, user_id, email');
      if (enrollError) throw enrollError;

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, email');
      if (profilesError) throw profilesError;

      const profilesMap = new Map<string, { name: string; email: string }>();
      profilesData?.forEach(p => profilesMap.set(p.user_id, { name: p.name, email: p.email }));

      return (enrollmentData || [])
        .map(e => ({ batch_name: e.batch_name, subject_name: e.subject_name, profiles: profilesMap.get(e.user_id) || null }))
        .filter(e => e.profiles) as Enrollment[];
    },
  });

  const d = useMemo(() => {
    const studentMap = new Map<string, StudentEnrollmentInfo>();
    enrollments.forEach(e => {
      if (!e.profiles) return;
      const email = e.profiles.email;
      if (!studentMap.has(email)) studentMap.set(email, { name: e.profiles.name, email, enrollments: [] });
      studentMap.get(email)!.enrollments.push({ batch: e.batch_name, subject: e.subject_name });
    });
    const allStudents = Array.from(studentMap.values());
    const allBatches = Array.from(new Set(enrollments.map(e => e.batch_name))).sort();
    const allSubjects = Array.from(new Set(enrollments.map(e => e.subject_name))).sort();

    const filteredStudents = allStudents.filter(s =>
      (selectedBatch === 'all' || s.enrollments.some(e => e.batch === selectedBatch)) &&
      (selectedSubject === 'all' || s.enrollments.some(e => e.subject === selectedSubject)),
    );

    // batch × subject (stacked bar)
    const stacked = (selectedBatch === 'all' ? allBatches : [selectedBatch]).map(batch => {
      const row: Record<string, any> = { name: batch };
      allSubjects.forEach(subject => {
        row[subject] = enrollments.filter(e => e.batch_name === batch && e.subject_name === subject).length;
      });
      return row;
    }).filter(r => Object.values(r).some(v => typeof v === 'number' && v > 0));

    // students per subject (donut)
    const subjectTotals = allSubjects
      .map(subject => ({ name: subject, value: enrollments.filter(e => e.subject_name === subject && (selectedBatch === 'all' || e.batch_name === selectedBatch)).length }))
      .filter(s => s.value > 0)
      .sort((a, b) => b.value - a.value);

    // students per batch (bar) — distinct students per batch
    const batchTotals = allBatches.map(batch => {
      const set = new Set(enrollments.filter(e => e.batch_name === batch).map(e => e.profiles?.email));
      return { name: batch, value: set.size };
    }).filter(b => b.value > 0).sort((a, b) => b.value - a.value);

    const avgSubjects = allStudents.length
      ? Math.round((allStudents.reduce((s, st) => s + new Set(st.enrollments.map(e => e.subject)).size, 0) / allStudents.length) * 10) / 10
      : 0;

    return { totalStudents: allStudents.length, filteredStudents, stacked, subjectTotals, batchTotals, allBatches, allSubjects, avgSubjects, totalEnrollments: enrollments.length };
  }, [enrollments, selectedBatch, selectedSubject]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full p-10"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }
  if (isError) {
    return (
      <div className="w-full max-w-[1840px] mx-auto p-3 sm:p-6 font-sans">
        <Card className="border border-dashed border-rose-300 text-center py-16">
          <HugeiconsIcon icon={Alert02Icon} size={40} className="text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900">Failed to load enrollment data</h3>
          <p className="text-sm text-slate-500 mt-1">{(error as Error)?.message}</p>
        </Card>
      </div>
    );
  }

  const visibleSubjects = d.allSubjects.filter(s => selectedSubject === 'all' || selectedSubject === s);

  return (
    <div className="w-full max-w-[1840px] mx-auto p-4 md:p-6 bg-white min-h-full font-sans">
      {/* Header + filters toolbar */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enrollment Analytics</h1>
          <p className="text-slate-500 mt-1 text-sm">Overview of your student population and subject demand.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 mr-1">
            <HugeiconsIcon icon={FilterHorizontalIcon} size={15} strokeWidth={2} /> Filter
          </span>
          <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger className="w-[160px] h-9 text-sm border-slate-200"><SelectValue placeholder="Batch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {d.allBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[160px] h-9 text-sm border-slate-200"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {d.allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={UserGroupIcon} label="Students" value={d.totalStudents} hint={`${d.totalEnrollments} enrollments`} />
        <Kpi icon={Layers01Icon} label="Batches" value={d.allBatches.length} />
        <Kpi icon={BookOpen01Icon} label="Subjects" value={d.allSubjects.length} />
        <Kpi icon={Mortarboard01Icon} label="Avg subjects / student" value={d.avgSubjects} />
      </div>

      {/* Row 1: stacked bar + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <ChartCard icon={ChartColumnStackedIcon} title="Enrollment by batch" subtitle="Students per subject across batches">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={d.stacked} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis type="category" dataKey="name" width={134} tickMargin={6} tickFormatter={(v) => shortLabel(v, 18)} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                {visibleSubjects.map((subject, i, arr) => (
                  <Bar key={subject} dataKey={subject} stackId="a" fill={COLORS[d.allSubjects.indexOf(subject) % COLORS.length]}
                    radius={i === arr.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} maxBarSize={30} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard icon={PieChartIcon} title="Students by subject" subtitle="Share of total enrollments">
          <div className="relative">
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie data={d.subjectTotals} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2} stroke="none">
                  {d.subjectTotals.map((s, i) => <Cell key={i} fill={COLORS[d.allSubjects.indexOf(s.name) % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8, lineHeight: '18px' }} formatter={(value) => <span style={{ color: '#475569' }}>{shortLabel(value, 18)}</span>} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-28px' }}>
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{d.totalEnrollments}</span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400">enrollments</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Row 2: per-batch bar + directory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard icon={ChartColumnIcon} title="Students per batch" subtitle="Distinct students enrolled in each batch">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={d.batchTotals} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" height={96} tickMargin={8} tickFormatter={(v) => shortLabel(v, 16)} tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
              <Bar dataKey="value" name="Students" radius={[4, 4, 0, 0]} maxBarSize={46}>
                {d.batchTotals.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="border-slate-200 shadow-none p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <HugeiconsIcon icon={UserGroupIcon} size={18} strokeWidth={2} className="text-slate-400" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 leading-none">Student directory</h3>
                <p className="text-xs text-slate-400 mt-1">{d.filteredStudents.length} students</p>
              </div>
            </div>
          </div>
          <div className="h-[320px] overflow-y-auto space-y-2 pr-2 no-scrollbar">
            {d.filteredStudents.length > 0 ? d.filteredStudents.map(student => (
              <div key={student.email} className="p-3 border border-slate-200 rounded-md hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                <p className="font-medium text-slate-900 text-sm">{student.name}</p>
                <p className="text-[11px] text-slate-400">{student.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {student.enrollments.map((e, i) => (
                    <span key={i} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {e.batch} · {e.subject}
                    </span>
                  ))}
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                <HugeiconsIcon icon={Search01Icon} size={36} strokeWidth={1.8} className="mb-3" />
                <p className="font-medium text-slate-600">No students found</p>
                <p className="text-sm">Try adjusting the filters.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
