import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Loader2, AlertTriangle, BookOpen, GraduationCap, Filter, Search, Crown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

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

// --- A Royal Color Palette ---
const COLORS = ["#4338ca", "#c026d3", "#db2777", "#16a34a", "#f97316", "#0ea5e9"];

// --- Custom Tooltip with a Royal Touch ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg shadow-xl backdrop-blur-sm text-white">
        <p className="font-bold text-lg">{label}</p>
        <Separator className="my-2 bg-slate-600" />
        {payload.map((entry: any, index: number) => (
          entry.value > 0 && (
            <div key={`item-${index}`} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
                <span>{`${entry.name}:`}</span>
              </div>
              <span className="font-bold ml-4">{entry.value}</span>
            </div>
          )
        ))}
      </div>
    );
  }
  return null;
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
  const { data: enrollments = [], isLoading: isLoadingEnrollments, isError, error } = useQuery<Enrollment[]>({
    queryKey: ['enrollment-analytics-enrollments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_enrollments')
        .select(`
          batch_name,
          subject_name,
          profiles ( name, email )
        `);

      if (error) {
          console.error("Error fetching enrollments:", error)
          throw error;
      };
      
      return data.filter(e => e.profiles) as Enrollment[];
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

    const allBatches = Array.from(new Set(options.filter((o: any) => o.type === 'batch').map((o: any) => o.name))).sort();
    const allSubjects = Array.from(new Set(options.filter((o: any) => o.type === 'subject').map((o: any) => o.name))).sort();

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
  }, [enrollments, options, selectedBatch, selectedSubject]);
  
  const isLoading = isLoadingEnrollments || isLoadingOptions;

  // --- Rendering ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-10">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
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
    <div className="p-4 md:p-6 space-y-6 bg-slate-100 min-h-full">
      {/* Header */}
      <div className="px-1">
        <h1 className="text-4xl font-bold text-slate-800 tracking-tight flex items-center">
            <Crown className="h-8 w-8 mr-3 text-amber-500"/>
            Royal Analytics Dashboard
        </h1>
        <p className="text-slate-500 mt-1">A premium overview of the student kingdom.</p>
      </div>
      
      {/* Filters and Stats */}
      <Card className="bg-white/70 backdrop-blur-sm shadow-lg border-slate-200">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">Total Students</p>
                    <Users className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-3xl font-bold text-indigo-600 mt-1">{analyticsData.totalStudents}</p>
            </div>
             <div className="p-4 rounded-lg bg-slate-50 border">
                <p className="text-sm font-medium text-slate-500 mb-2">Filter by Batch</p>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger className="focus:ring-2 focus:ring-indigo-500"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {analyticsData.allBatches.map(batch => (<SelectItem key={batch} value={batch}>{batch}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
             <div className="p-4 rounded-lg bg-slate-50 border">
                <p className="text-sm font-medium text-slate-500 mb-2">Filter by Subject</p>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="focus:ring-2 focus:ring-indigo-500"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {analyticsData.allSubjects.map(subject => (<SelectItem key={subject} value={subject}>{subject}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
      
      {/* Main Content Area */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
             <Card className="shadow-2xl h-full border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl">Enrollment Distribution</CardTitle>
                  <CardDescription>Student count by subject across batches.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart data={analyticsData.chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis type="number" allowDecimals={false} stroke="#888" />
                      <YAxis type="category" dataKey="name" width={80} stroke="#888" tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(230, 230, 255, 0.6)'}} />
                      <Legend />
                        {analyticsData.allSubjects
                            .filter(subject => selectedSubject === 'all' || selectedSubject === subject)
                            .map((subject, index) => (
                            <Bar key={subject} dataKey={subject} stackId="a" fill={COLORS[analyticsData.allSubjects.indexOf(subject) % COLORS.length]} radius={[0, 8, 8, 0]} />
                        ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
        </div>
        <div className="lg:col-span-2">
            <Card className="shadow-2xl h-full border-slate-200">
                <CardHeader>
                    <CardTitle className="text-xl">Student Directory</CardTitle>
                    <CardDescription>{analyticsData.filteredStudents.length} students found.</CardDescription>
                </CardHeader>
                <CardContent className="h-[500px] overflow-y-auto space-y-3 pr-3">
                    {analyticsData.filteredStudents.length > 0 ? (
                        analyticsData.filteredStudents.map((student) => (
                            <div key={student.email} className="p-4 border border-slate-200 rounded-xl hover:shadow-lg hover:border-indigo-400 transition-all duration-300 bg-white">
                               <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                                       {student.name.charAt(0)}
                                   </div>
                                   <div>
                                       <p className="font-semibold text-slate-800">{student.name}</p>
                                       <p className="text-xs text-slate-500">{student.email}</p>
                                   </div>
                               </div>
                               <Separator className="my-3" />
                               <div className="flex flex-wrap gap-2">
                                   {student.enrollments.map((e, i) => (
                                       <Badge key={i} variant="secondary" className="font-normal border-2 border-transparent text-slate-700 bg-slate-200/80">
                                           <GraduationCap className="h-3 w-3 mr-1.5 text-slate-500"/>
                                           {e.batch} / {e.subject}
                                       </Badge>
                                   ))}
                               </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                            <Search className="h-12 w-12 mb-4" />
                            <p className="font-semibold">No students found</p>
                            <p className="text-sm">Try adjusting your filters to find them.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};
