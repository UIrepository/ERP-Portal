import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Loader2 } from 'lucide-react';

interface StudentProfile {
  batch: string | string[] | null;
  subjects: string[] | null;
}

export const EnrollmentAnalytics = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  const { data: students = [], isLoading: isLoadingStudents } = useQuery<StudentProfile[]>({
    queryKey: ['enrollment-analytics-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('batch, subjects')
        .eq('role', 'student');
      if (error) throw error;
      return data || [];
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

    let filteredStudents = students;
    if (selectedBatch !== 'all') {
      filteredStudents = filteredStudents.filter(s => {
        const batches = Array.isArray(s.batch) ? s.batch : [s.batch];
        return batches.includes(selectedBatch);
      });
    }
    if (selectedSubject !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.subjects?.includes(selectedSubject));
    }

    const chartData = allBatches.map(batch => {
      const batchCounts: { name: string; [subject: string]: number } = { name: batch };
      allSubjects.forEach(subject => {
        batchCounts[subject] = students.filter(
          s => {
            const batches = Array.isArray(s.batch) ? s.batch : [s.batch];
            return batches.includes(batch) && s.subjects?.includes(subject)
          }
        ).length;
      });
      return batchCounts;
    });

    return {
      totalStudents: students.length,
      filteredCount: filteredStudents.length,
      chartData,
      allBatches,
      allSubjects,
    };
  }, [students, options, selectedBatch, selectedSubject]);
  
  const isLoading = isLoadingStudents || isLoadingOptions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Student Enrollment Analytics</h1>
        <p className="text-gray-500 mt-1">Filter and visualize student enrollment data across batches and subjects.</p>
      </div>

      {/* Filter and Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{analyticsData.totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="text-base font-medium">Filter by Batch</CardTitle></CardHeader>
            <CardContent>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger><SelectValue placeholder="Select Batch" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {analyticsData.allBatches.map(batch => (
                        <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                        ))}
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
                        {analyticsData.allSubjects.map(subject => (
                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <BarChart className="mr-2 h-5 w-5" />
            Enrollment by Subject Across Batches
          </CardTitle>
          <CardDescription>
            Showing {analyticsData.filteredCount} students for the current filter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={analyticsData.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
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
    </div>
  );
};
