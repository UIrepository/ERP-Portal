import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Users, Loader2, AlertTriangle, Filter, Search } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';

// --- Interfaces for our data structures ---
interface Enrollment {
  batch_name: string;
  subject_name: string;
  profiles: {
    name: string;
    email: string;
  } | null;
}

interface StudentEnrollmentInfo {
  name: string;
  email: string;
  enrollments: { batch: string; subject: string }[];
}

// --- On-brand indigo/violet palette ---
const COLORS = ["#4f46e5", "#7c3aed", "#6366f1", "#0ea5e9", "#8b5cf6", "#3b82f6", "#a855f7", "#2dd4bf"];

// --- Custom Tooltip for a better feel ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((s: number, e: any) => s + (e.value || 0), 0);
    return (
      <div className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg shadow-xl font-sans min-w-[140px]">
        <p className="font-semibold text-slate-900 text-sm mb-1.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          entry.value > 0 && (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4 text-xs py-0.5">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="font-semibold text-slate-900">{entry.value}</span>
            </div>
          )
        ))}
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Total</span>
          <span className="font-bold text-indigo-600">{total}</span>
        </div>
      </div>
    );
  }
  return null;
};

// --- Custom Shape for selectively rounded corners ---
const getPath = (x: number, y: number, width: number, height: number, radius: [number, number, number, number]) => {
    const [tl, tr, br, bl] = radius;
    return `M${x + tl},${y}
            L${x + width - tr},${y}
            Q${x + width},${y} ${x + width},${y + tr}
            L${x + width},${y + height - br}
            Q${x + width},${y + height} ${x + width - br},${y + height}
            L${x + bl},${y + height}
            Q${x},${y + height} ${x},${y + height - bl}
            L${x},${y + tl}
            Q${x},${y} ${x + tl},${y}
            Z`;
};

const RoundedBar = (props: any) => {
    const { fill, x, y, width, height, radius } = props;
    return <path d={getPath(x, y, width, height, radius)} stroke="none" fill={fill} />;
};


export const EnrollmentAnalytics = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const queryClient = useQueryClient();

  // --- Real-time Subscription ---
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // --- Data Fetching ---
  const { data: enrollments = [], isLoading: isLoadingEnrollments, isError, error } = useQuery({
    queryKey: ['enrollment-analytics-enrollments'],
    queryFn: async (): Promise<Enrollment[]> => {
      // Fetch enrollments with email
      const { data: enrollmentData, error: enrollError } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name, user_id, email');

      if (enrollError) {
          console.error("Error fetching enrollments:", enrollError)
          throw enrollError;
      }

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, email');

      if (profilesError) {
          console.error("Error fetching profiles:", profilesError)
          throw profilesError;
      }

      // Map profiles by user_id
      const profilesMap = new Map<string, { name: string; email: string }>();
      profilesData?.forEach(p => profilesMap.set(p.user_id, { name: p.name, email: p.email }));

      // Join data manually
      return (enrollmentData || [])
        .map(e => ({
          batch_name: e.batch_name,
          subject_name: e.subject_name,
          profiles: profilesMap.get(e.user_id) || null
        }))
        .filter(e => e.profiles) as Enrollment[];
    },
  });

  // --- Data Processing ---
  const analyticsData = useMemo(() => {
    const studentMap = new Map<string, StudentEnrollmentInfo>();
    enrollments.forEach(enrollment => {
      if (enrollment.profiles) {
        const email = enrollment.profiles.email;
        if (!studentMap.has(email)) {
          studentMap.set(email, {
            name: enrollment.profiles.name,
            email: email,
            enrollments: [],
          });
        }
        studentMap.get(email)?.enrollments.push({
          batch: enrollment.batch_name,
          subject: enrollment.subject_name,
        });
      }
    });
    const allStudents = Array.from(studentMap.values());

    const allBatches = Array.from(new Set(enrollments.map(e => e.batch_name))).sort();
    const allSubjects = Array.from(new Set(enrollments.map(e => e.subject_name))).sort();

    const filteredStudents = allStudents.filter(student => {
      const matchesBatch = selectedBatch === 'all' || student.enrollments.some(e => e.batch === selectedBatch);
      const matchesSubject = selectedSubject === 'all' || student.enrollments.some(e => e.subject === selectedSubject);
      return matchesBatch && matchesSubject;
    });

    const chartData = (selectedBatch === 'all' ? allBatches : [selectedBatch]).map(batch => {
        const batchData: Record<string, any> = { name: batch };
        allSubjects.forEach(subject => {
            batchData[subject] = enrollments.filter(e => e.batch_name === batch && e.subject_name === subject).length;
        });
        return batchData;
    }).filter(d => Object.values(d).some(v => typeof v === 'number' && v > 0));

    return {
      totalStudents: allStudents.length,
      filteredStudents,
      chartData,
      allBatches,
      allSubjects,
    };
  }, [enrollments, selectedBatch, selectedSubject]);
  
  const isLoading = isLoadingEnrollments;

  // --- Rendering ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (isError) {
      return (
        <Card className="m-6 text-center py-20 bg-white rounded-lg border-dashed border-2 border-red-400 shadow-sm">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-destructive">Failed to Load Enrollment Data</h3>
            <p className="text-muted-foreground mt-2">There was an error fetching the required data.</p>
            <p className="text-sm text-gray-500 mt-4"><strong>Error:</strong> {error?.message}</p>
        </Card>
      )
  }

  return (
    <div className="w-full max-w-[1840px] mx-auto p-4 md:p-6 space-y-6 bg-white min-h-full font-sans">
      <div className="px-1">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Student Enrollment Analytics</h1>
        <p className="text-slate-500 mt-1 text-sm">An interactive overview of your student population.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Total Students</CardTitle>
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{analyticsData.totalStudents}</div>
              <p className="text-xs text-white/70 mt-1">{analyticsData.allBatches.length} batches · {analyticsData.allSubjects.length} subjects</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-700">Filter by Batch</CardTitle>
                <Filter className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger className="focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {analyticsData.allBatches.map(batch => (<SelectItem key={batch} value={batch}>{batch}</SelectItem>))}
                    </SelectContent>
                </Select>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-700">Filter by Subject</CardTitle>
                <Filter className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {analyticsData.allSubjects.map(subject => (<SelectItem key={subject} value={subject}>{subject}</SelectItem>))}
                    </SelectContent>
                </Select>
            </CardContent>
          </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
             <Card className="border-slate-200 shadow-sm h-full">
                <CardHeader>
                  <CardTitle className="text-slate-900">Enrollment Distribution</CardTitle>
                  <CardDescription className="text-slate-500">Students by subject across different batches.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart data={analyticsData.chartData} layout="vertical" margin={{ top: 5, right: 24, left: 10, bottom: 5 }} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} stroke="#94a3b8" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis type="category" dataKey="name" width={90} stroke="#94a3b8" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        {analyticsData.allSubjects
                            .filter(subject => selectedSubject === 'all' || selectedSubject === subject)
                            .map((subject, index, arr) => {
                            const isLast = index === arr.length - 1;
                            return (
                            <Bar
                              key={subject}
                              dataKey={subject}
                              stackId="a"
                              fill={COLORS[analyticsData.allSubjects.indexOf(subject) % COLORS.length]}
                              radius={isLast ? [0, 5, 5, 0] : [0, 0, 0, 0]}
                              maxBarSize={34}
                            />
                          );
                        })}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
        </div>
        <div className="lg:col-span-2">
            <Card className="border-slate-200 shadow-sm h-full">
                <CardHeader>
                    <CardTitle className="text-slate-900">Student Directory</CardTitle>
                    <CardDescription className="text-slate-500">{analyticsData.filteredStudents.length} students found.</CardDescription>
                </CardHeader>
                <CardContent className="h-[500px] overflow-y-auto space-y-3 pr-3">
                    {analyticsData.filteredStudents.length > 0 ? (
                        analyticsData.filteredStudents.map((student) => (
                            <div key={student.email} className="p-3 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors duration-200">
                               <p className="font-semibold text-slate-900">{student.name}</p>
                               <p className="text-xs text-slate-400">{student.email}</p>
                               <Separator className="my-2" />
                               <div className="flex flex-wrap gap-2">
                                   {student.enrollments.map((e, i) => (
                                       <Badge key={i} variant="secondary" className="font-normal bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-transparent">
                                           <GraduationCap className="h-3 w-3 mr-1.5"/>
                                           {e.batch} / {e.subject}
                                       </Badge>
                                   ))}
                               </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                            <Search className="h-12 w-12 mb-4" />
                            <p className="font-semibold">No students found</p>
                            <p className="text-sm">Try adjusting your filters.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};
