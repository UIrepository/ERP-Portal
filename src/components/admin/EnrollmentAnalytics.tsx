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
  };
}

interface StudentEnrollmentInfo {
  name: string;
  email: string;
  enrollments: { batch: string; subject: string }[];
}

// --- New Royal Color Palette ---
const COLORS = ["#2563eb", "#dc2626", "#7c3aed", "#db2777", "#16a34a", "#ea580c", "#0ea5e9"];

// --- Custom Tooltip for a better feel ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-background/90 border rounded-lg shadow-lg backdrop-blur-sm">
        <p className="font-bold text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          entry.value > 0 && (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          )
        ))}
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
  const { data: enrollments = [], isLoading: isLoadingEnrollments, isError, error } = useQuery<Enrollment[]>({
    queryKey: ['enrollment-analytics-enrollments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_enrollments')
        .select(`
          batch_name,
          subject_name,
          profiles!inner ( name, email )
        `);

      if (error) {
          console.error("Error fetching enrollments:", error)
          throw error;
      };
      
      return (data || []) as Enrollment[];
    },
  });

  // --- Data Processing ---
  const analyticsData = useMemo(() => {
    const studentMap = new Map<string, StudentEnrollmentInfo>();
    enrollments.forEach(enrollment => {
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
    <div className="p-4 md:p-6 space-y-6 bg-gray-50/70 min-h-full">
      <div className="px-1">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Student Enrollment Analytics</h1>
        <p className="text-muted-foreground mt-1">An interactive overview of your student population.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.totalStudents}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Filter by Batch</CardTitle>
                <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger className="focus:ring-2 focus:ring-primary focus:ring-offset-2"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {analyticsData.allBatches.map(batch => (<SelectItem key={batch} value={batch}>{batch}</SelectItem>))}
                    </SelectContent>
                </Select>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Filter by Subject</CardTitle>
                <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="focus:ring-2 focus:ring-primary focus:ring-offset-2"><SelectValue placeholder="Select Subject" /></SelectTrigger>
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
             <Card className="shadow-lg h-full">
                <CardHeader>
                  <CardTitle>Enrollment Distribution</CardTitle>
                  <CardDescription>Students by subject across different batches.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart data={analyticsData.chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis type="number" allowDecimals={false} stroke="#888" />
                      <YAxis type="category" dataKey="name" width={80} stroke="#888" tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(240, 240, 240, 0.5)'}} />
                      <Legend />
                        {analyticsData.allSubjects
                            .filter(subject => selectedSubject === 'all' || selectedSubject === subject)
                            .map((subject, index, arr) => (
                            <Bar key={subject} dataKey={subject} stackId="a" shape={<RoundedBar />}>
                                {analyticsData.chartData.map((entry, entryIndex) => {
                                    const isFirst = index === 0;
                                    const isLast = index === arr.length - 1;
                                    const radius = [isFirst ? 8 : 0, isLast ? 8 : 0, isLast ? 8 : 0, isFirst ? 8 : 0] as [number, number, number, number];
                                    return <Cell key={`cell-${entryIndex}`} fill={COLORS[analyticsData.allSubjects.indexOf(subject) % COLORS.length]} radius={radius}/>
                                })}
                            </Bar>
                        ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
        </div>
        <div className="lg:col-span-2">
            <Card className="shadow-lg h-full">
                <CardHeader>
                    <CardTitle>Student Directory</CardTitle>
                    <CardDescription>{analyticsData.filteredStudents.length} students found.</CardDescription>
                </CardHeader>
                <CardContent className="h-[500px] overflow-y-auto space-y-3 pr-3">
                    {analyticsData.filteredStudents.length > 0 ? (
                        analyticsData.filteredStudents.map((student) => (
                            <div key={student.email} className="p-3 border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200">
                               <p className="font-semibold text-primary">{student.name}</p>
                               <p className="text-xs text-muted-foreground">{student.email}</p>
                               <Separator className="my-2" />
                               <div className="flex flex-wrap gap-2">
                                   {student.enrollments.map((e, i) => (
                                       <Badge key={i} variant="secondary" className="font-normal border-2 border-transparent">
                                           <GraduationCap className="h-3 w-3 mr-1.5"/>
                                           {e.batch} / {e.subject}
                                       </Badge>
                                   ))}
                               </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
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
