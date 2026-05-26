
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon, ChartColumnStackedIcon } from '@hugeicons/core-free-icons';

// Refined, muted categorical palette (matches Enrollment Analytics)
const TA_COLORS = ['#4f46e5', '#0ea5e9', '#14b8a6', '#f59e0b', '#e11d48', '#8b5cf6', '#10b981', '#64748b'];

interface TeacherProfile {
  batch: string | string[] | null;
  subjects: string[] | null;
}

export const TeacherAnalytics = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  const { data: teachers = [], isLoading: isLoadingTeachers } = useQuery<TeacherProfile[]>({
    queryKey: ['teacher-analytics-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('batch, subjects')
        .eq('role', 'teacher' as any);
      if (error) throw error;
      return (data || []) as TeacherProfile[];
    },
  });

  const { data: options = [], isLoading: isLoadingOptions } = useQuery({
    queryKey: ['all-options-central'],
    queryFn: async () => {
        const { data, error } = await supabase.rpc('get_all_options');
        if (error) throw error;
        return data || [];
    }
  });

  const analyticsData = useMemo(() => {
    const allBatches = options.filter((o: any) => o.type === 'batch').map((o: any) => o.name).sort();
    const allSubjects = options.filter((o: any) => o.type === 'subject').map((o: any) => o.name).sort();

    let filteredTeachers = teachers;
    if (selectedBatch !== 'all') {
      filteredTeachers = filteredTeachers.filter(t => {
        const batches = Array.isArray(t.batch) ? t.batch : [t.batch];
        return batches.includes(selectedBatch);
      });
    }
    if (selectedSubject !== 'all') {
      filteredTeachers = filteredTeachers.filter(t => t.subjects?.includes(selectedSubject));
    }

    const chartData = allBatches.map(batch => {
      const batchData: Record<string, any> = { batch: batch }; // Use 'batch' instead of 'name'
      allSubjects.forEach(subject => {
        batchData[subject] = teachers.filter(
          t => {
            const batches = Array.isArray(t.batch) ? t.batch : [t.batch];
            return batches.includes(batch) && t.subjects?.includes(subject);
          }
        ).length;
      });
      return batchData;
    });

    return {
      totalTeachers: teachers.length,
      filteredCount: filteredTeachers.length,
      chartData,
      allBatches,
      allSubjects,
    };
  }, [teachers, options, selectedBatch, selectedSubject]);

  const isLoading = isLoadingTeachers || isLoadingOptions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1840px] mx-auto p-4 md:p-6 space-y-6 bg-white min-h-full font-sans">
      {/* Header Section */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Teacher Analytics</h1>
        <p className="text-slate-500 mt-1 text-sm">Filter and visualize teacher allocation data.</p>
      </div>

      {/* Filter and Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-slate-200 shadow-none p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Teachers</p>
              <p className="text-3xl font-bold text-slate-900 tabular-nums mt-2 leading-none">{analyticsData.totalTeachers}</p>
            </div>
            <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
              <HugeiconsIcon icon={UserGroupIcon} size={18} strokeWidth={2} />
            </div>
          </div>
        </Card>
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Filter by Batch</CardTitle></CardHeader>
            <CardContent>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger className="focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {analyticsData.allBatches.map(batch => (
                        <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Filter by Subject</CardTitle></CardHeader>
            <CardContent>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {analyticsData.allSubjects.map(subject => (
                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="flex items-center text-lg text-slate-900">
            <HugeiconsIcon icon={ChartColumnStackedIcon} size={18} strokeWidth={2} className="mr-2 text-slate-400" />
            Teacher Allocation by Subject
          </CardTitle>
          <CardDescription className="text-slate-500">
            Showing {analyticsData.filteredCount} teachers for the current filter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={analyticsData.chartData} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="batch" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', fontSize: 12 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {analyticsData.allSubjects.map((subject, index, arr) => (
                (selectedSubject === 'all' || selectedSubject === subject) &&
                <Bar key={subject} dataKey={subject} stackId="a" fill={TA_COLORS[index % TA_COLORS.length]} maxBarSize={48} radius={index === arr.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
