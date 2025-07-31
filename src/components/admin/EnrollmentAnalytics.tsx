import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Loader2, AlertTriangle, BookOpen, GraduationCap, Filter } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
  name:string;
  email: string;
  enrollments: { batch: string; subject: string }[];
}

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
    const students = Array.from(studentMap.values());

    const allBatches = Array.from(new Set(options.filter((o: any) => o.type === 'batch').map((o: any) => o.name))).sort();
    const allSubjects = Array.from(new Set(options.filter((o: any) => o.type === 'subject').map((o: any) => o.name))).sort();

    let filteredStudents = students.filter(student => {
      const matchesBatch = selectedBatch === 'all' || student.enrollments.some(e => e.batch === selectedBatch);
      const matchesSubject = selectedSubject === 'all' || student.enrollments.some(e => e.subject === selectedSubject);
      return matchesBatch && matchesSubject;
    });

    const chartData = allBatches.map(batch => {
      const batchData: Record<string, any> = { batch: batch };
      allSubjects.forEach(subject => {
        batchData[subject] = enrollments.filter(e => e.batch_name === batch && e.subject_name === subject).length;
      });
      return batchData;
    });

    return {
      totalStudents: students.length,
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
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (isError) {
      return (
        <Card className="m-6 text-center py-20 bg-white rounded-lg border-dashed border-2 border-red-400 shadow-sm">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-destructive">Failed to Load Enrollment Data</h3>
            <p className="text-muted-foreground mt-2">
                There was an error fetching the required data from the database.
            </p>
            <p className="text-sm text-gray-500 mt-4">
                <strong>Error:</strong> {error?.message}
            </p>
        </Card>
      )
  }

  return (
    <div className="p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header */}
      <div className="px-2">
        <h1 className="text-3xl font-bold text-gray-800">Student Enrollment Analytics</h1>
        <p className="text-gray-500 mt-1">An interactive overview of your student population.</p>
      </div>

      {/* High-Level Stats & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.totalStudents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Filter by Batch</CardTitle>
                <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger><SelectValue placeholder="Select Batch" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {analyticsData.allBatches.map(batch => (<SelectItem key={batch} value={batch}>{batch}</SelectItem>))}
                    </SelectContent>
                </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Filter by Subject</CardTitle>
                <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {analyticsData.allSubjects.map(subject => (<SelectItem key={subject} value={subject}>{subject}</SelectItem>))}
                    </SelectContent>
                </Select>
            </CardContent>
          </Card>
      </div>

      {/* Chart & Student Directory */}
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Student Directory */}
        <div className="lg:col-span-2">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Student Directory</CardTitle>
                    <CardDescription>
                        {analyticsData.filteredStudents.length} students found.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[500px] overflow-y-auto space-y-4 pr-4">
                    {analyticsData.filteredStudents.map((student) => (
                        <div key={student.email} className="p-3 border rounded-lg hover:bg-gray-50">
                           <p className="font-semibold">{student.name}</p>
                           <p className="text-xs text-muted-foreground">{student.email}</p>
                           <Separator className="my-2" />
                           <div className="flex flex-wrap gap-2">
                               {student.enrollments.map((e, i) => (
                                   <Badge key={i} variant="secondary" className="font-normal">
                                       {e.batch} / {e.subject}
                                   </Badge>
                               ))}
                           </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
        {/* Enrollment Chart */}
        <div className="lg:col-span-3">
             <Card className="h-full">
                <CardHeader>
                  <CardTitle>Enrollment Distribution</CardTitle>
                  <CardDescription>Visualizing students by subject across different batches.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart data={analyticsData.chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="batch" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      {analyticsData.allSubjects.map((subject, index) => (
                        (selectedSubject === 'all' || selectedSubject === subject) &&
                        <Bar key={subject} dataKey={subject} stackId="a" fill={`hsl(${index * 60}, 70%, 50%)`} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
        </div>
      </div>
    </div>
  );
};
