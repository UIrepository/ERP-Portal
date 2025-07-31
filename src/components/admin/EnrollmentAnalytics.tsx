import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Loader2, AlertTriangle, BookOpen, GraduationCap } from 'lucide-react';

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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (isError) {
      return (
        <Card className="text-center py-20 bg-white rounded-lg border-dashed border-2 border-red-400 shadow-sm">
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
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header and Filter sections */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Student Enrollment Analytics</h1>
        <p className="text-gray-500 mt-1">Filter and visualize student enrollment data across batches and subjects.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-medium">Total Students</CardTitle></CardHeader>
          <CardContent><p className="text-4xl font-bold">{analyticsData.totalStudents}</p></CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="text-base font-medium">Filter by Batch</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="text-base font-medium">Filter by Subject</CardTitle></CardHeader>
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

      {/* Chart Section */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center text-lg"><BarChart className="mr-2 h-5 w-5" />Enrollment by Subject Across Batches</CardTitle>
          <CardDescription>High-level overview of student distribution.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={analyticsData.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="batch" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {analyticsData.allSubjects.map((subject, index) => (
                (selectedSubject === 'all' || selectedSubject === subject) &&
                <Bar key={subject} dataKey={subject} stackId="a" fill={`hsl(${index * 40}, 70%, 50%)`} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Improved Student Enrollment Table */}
      <Card className="bg-white">
        <CardHeader>
            <CardTitle className="flex items-center text-lg"><Users className="mr-2 h-5 w-5" />Student Enrollment Details</CardTitle>
            <CardDescription>A detailed list of all students and their current enrollments. Found {analyticsData.filteredStudents.length} students matching criteria.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Enrollments</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {analyticsData.filteredStudents.map((student, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-2">
                                    {student.enrollments.map((e, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-200 shadow-sm hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <GraduationCap className="h-5 w-5 text-blue-500" />
                                                <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200">{e.batch}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="h-5 w-5 text-indigo-500" />
                                                <Badge variant="default" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200">{e.subject}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
};
