import { useState, useMemo, useEffect } from 'react';
 import { useQuery, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
 import { Users, Loader2, AlertTriangle, BookOpen, GraduationCap, Filter, Search } from 'lucide-react';
 import { Separator } from '@/components/ui/separator';
 import { Badge } from '@/components/ui/badge'; // <-- **FIXED: Added the missing Badge import**

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

 // --- Improved color palette for the chart ---
 const COLORS = ["#6366f1", "#22c55e", "#f97316", "#d946ef", "#0ea5e9", "#a855f7", "#0d9488", "#eab308"];

 // --- Custom Tooltip for a better feel ---
 const CustomTooltip = ({ active, payload, label }: any) => {
   if (active && payload && payload.length) {
     return (
       <div className="p-2 bg-background/90 border rounded-lg shadow-lg backdrop-blur-sm">
         <p className="font-bold text-foreground">{label}</p>
         {payload.map((entry: any, index: number) => (
           <p key={`item-${index}`} style={{ color: entry.color }}>
             {`${entry.name}: ${entry.value}`}
           </p>
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

     // Filter the student list based on selections
     const filteredStudents = allStudents.filter(student => {
       const matchesBatch = selectedBatch === 'all' || student.enrollments.some(e => e.batch === selectedBatch);
       const matchesSubject = selectedSubject === 'all' || student.enrollments.some(e => e.subject === selectedSubject);
       return matchesBatch && matchesSubject;
     });

     // Recalculate chart data based on the *filtered* student list
     const filteredEnrollments = enrollments.filter(enrollment =>
         filteredStudents.some(student => student.email === enrollment.profiles?.email)
     );

     const chartData = (selectedBatch === 'all' ? allBatches : [selectedBatch]).map(batch => {
         const batchData: Record<string, any> = { name: batch };
         allSubjects.forEach(subject => {
             batchData
