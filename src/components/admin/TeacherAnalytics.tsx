import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UserCheck, Loader2 } from 'lucide-react';

interface TeacherProfile {
  batch: string | null;
  subjects: string[] | null;
}

export const TeacherAnalytics = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  const { data: teachers = [], isLoading } = useQuery<TeacherProfile[]>({
    queryKey: ['teacher-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('batch, subjects')
        .eq('role', 'teacher');
      
      if (error) throw error;
      return data || [];
    },
  });

  const analyticsData = useMemo(() => {
    const allBatches = new Set<string>();
    const allSubjects = new Set<string>();

    teachers.forEach(teacher => {
      if (teacher.batch) allBatches.add(teacher.batch);
      teacher.subjects?.forEach(subject => allSubjects.add(subject));
    });

    let filteredTeachers = teachers;
    if (selectedBatch !== 'all') {
      filteredTeachers = filteredTeachers.filter(t => t.batch === selectedBatch);
    }
    if (selectedSubject !== 'all') {
      filteredTeachers = filteredTeachers.filter(t => t.subjects?.includes(selectedSubject));
    }

    const chartData = Array.from(allBatches).map(batch => {
      const batchCounts: { name: string; [subject: string]: number } = { name: batch };
      analyticsData.allSubjects.forEach(subject => {
        batchCounts[subject] = teachers.filter(
          t => t.batch === batch && t.subjects?.includes(subject)
        ).length;
      });
      return batchCounts;
    });

    return {
      totalTeachers: teachers.length,
      filteredCount: filteredTeachers.length,
      chartData,
      allBatches: Array.from(allBatches).sort(),
      allSubjects: Array.from(allSubjects).sort(),
    };
  }, [teachers, selectedBatch, selectedSubject]);

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
      <h2 className="text-2xl font-bold">Teacher Analytics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base font-medium">Total Teachers</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{analyticsData.totalTeachers}</p></CardContent>
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
        <CardHeader><CardTitle className="flex items-center text-lg"><UserCheck className="mr-2 h-5 w-5" />Filtered Teacher Count</CardTitle></CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{analyticsData.filteredCount}</p>
          <p className="text-sm text-muted-foreground">
            Teachers in {selectedBatch === 'all' ? 'all batches' : selectedBatch} for {selectedSubject === 'all' ? 'all subjects' : selectedSubject}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Teachers per Subject by Batch</CardTitle></CardHeader>
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
                <Bar key={subject} dataKey={subject} stackId="a" fill={`hsl(${index * 50}, 70%, 50%)`} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
