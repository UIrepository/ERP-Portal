import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Loader2 } from 'lucide-react';

// Define a more specific type for student profiles for this component
interface StudentProfile {
  batch: string | null;
  subjects: string[] | null;
}

export const EnrollmentAnalytics = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  // Fetch all student profiles for analytics
  const { data: students = [], isLoading } = useQuery<StudentProfile[]>({
    queryKey: ['enrollment-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('batch, subjects')
        .eq('role', 'student');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Memoize processed data to avoid re-computation on every render
  const analyticsData = useMemo(() => {
    const allBatches = new Set<string>();
    const allSubjects = new Set<string>();

    students.forEach(student => {
      if (student.batch) allBatches.add(student.batch);
      student.subjects?.forEach(subject => allSubjects.add(subject));
    });

    // Filter students based on selection
    let filteredStudents = students;
    if (selectedBatch !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.batch === selectedBatch);
    }
    if (selectedSubject !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.subjects?.includes(selectedSubject));
    }

    // Prepare data for the chart, grouping by batch
    const chartData = Array.from(allBatches).map(batch => {
      const batchCounts: { name: string; [subject: string]: number } = { name: batch };
      Array.from(allSubjects).forEach(subject => {
        batchCounts[subject] = students.filter(
          s => s.batch === batch && s.subjects?.includes(subject)
        ).length;
      });
      return batchCounts;
    });

    return {
      totalStudents: students.length,
      filteredCount: filteredStudents.length,
      chartData,
      allBatches: Array.from(allBatches).sort(),
      allSubjects: Array.from(allSubjects).sort(),
    };
  }, [students, selectedBatch, selectedSubject]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Enrollment Analytics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analyticsData.totalStudents}</p>
          </CardContent>
        </Card>
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger><SelectValue placeholder="Filter by Batch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {analyticsData.allBatches.map(batch => (
              <SelectItem key={batch} value={batch}>{batch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger><SelectValue placeholder="Filter by Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {analyticsData.allSubjects.map(subject => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Users className="mr-2 h-5 w-5" />
            Filtered Enrollment Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{analyticsData.filteredCount}</p>
          <p className="text-sm text-muted-foreground">
            Students in {selectedBatch === 'all' ? 'all batches' : selectedBatch} enrolled in {selectedSubject === 'all' ? 'all subjects' : selectedSubject}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Enrollment by Subject Across Batches</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={analyticsData.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
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
