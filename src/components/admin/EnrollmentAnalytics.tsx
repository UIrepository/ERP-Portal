import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Loader2 } from 'lucide-react';

// Updated interface to include more student details
interface StudentProfile {
  name: string;
  email: string;
  batch: string | string[] | null;
  subjects: string[] | null;
}

export const EnrollmentAnalytics = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  // Updated query to fetch detailed student profiles
  const { data: students = [], isLoading: isLoadingStudents } = useQuery<StudentProfile[]>({
    queryKey: ['enrollment-analytics-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, batch, subjects')
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
    const allBatches = Array.from(new Set(options.filter((o: any) => o.type === 'batch').map((o: any) => o.name))).sort();
    const allSubjects = Array.from(new Set(options.filter((o: any) => o.type === 'subject').map((o: any) => o.name))).sort();

    let filteredStudents = students;
    if (selectedBatch !== 'all') {
      filteredStudents = filteredStudents.filter(s => {
        const batches = Array.isArray(s.batch) ? s.batch : (s.batch ? [s.batch] : []);
        return batches.includes(selectedBatch);
      });
    }
    if (selectedSubject !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.subjects?.includes(selectedSubject));
    }

    const chartData = allBatches.map(batch => {
      const batchData: Record<string, any> = { batch: batch };
      allSubjects.forEach(subject => {
        batchData[subject] = students.filter(
          s => {
            const batches = Array.isArray(s.batch) ? s.batch : (s.batch ? [s.batch] : []);
            return batches.includes(batch) && s.subjects?.includes(subject)
          }
        ).length;
      });
      return batchData;
    });

    return {
      totalStudents: students.length,
      filteredStudents, // Return the filtered list for the table
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
            High-level overview of student distribution.
          </CardDescription>
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
      
      {/* Detailed Student Enrollment Table */}
      <Card className="bg-white">
        <CardHeader>
            <CardTitle className="flex items-center text-lg">
                <Users className="mr-2 h-5 w-5" />
                Student Enrollment Details
            </CardTitle>
            <CardDescription>
                A detailed list of all students and their current enrollments. Found {analyticsData.filteredStudents.length} students matching criteria.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Enrolled Batches</TableHead>
                        <TableHead>Enrolled Subjects</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {analyticsData.filteredStudents.map((student, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>
                                {Array.isArray(student.batch) ? student.batch.map(b => <Badge key={b} variant="secondary" className="mr-1">{b}</Badge>) : <Badge variant="secondary">{student.batch}</Badge>}
                            </TableCell>
                            <TableCell>
                                {student.subjects?.map(s => <Badge key={s} variant="outline" className="mr-1">{s}</Badge>)}
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
