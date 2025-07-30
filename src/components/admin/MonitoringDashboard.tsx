import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Import useQueryClient
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Monitor, MessageSquare, Activity, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton'; // Assuming Skeleton is used for loading states if needed elsewhere

export const MonitoringDashboard = () => {
  const queryClient = useQueryClient(); // Initialize useQueryClient

  // --- Real-time Subscriptions ---
  useEffect(() => {
    // Channel for profiles table changes (affects Active Users)
    const profilesChannel = supabase
      .channel('monitoring-profiles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('Real-time update: profiles table changed in monitoring dashboard', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['active-users'] });
          queryClient.invalidateQueries({ queryKey: ['student-activities-monitoring'] }); // Invalidate student activities too as they join profiles
        }
      )
      .subscribe();

    // Channel for feedback table changes
    const feedbackChannel = supabase
      .channel('monitoring-feedback-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback' },
        (payload) => {
          console.log('Real-time update: feedback table changed in monitoring dashboard', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['all-feedback'] });
        }
      )
      .subscribe();

    // Channel for student_activities table changes
    const activitiesChannel = supabase
      .channel('monitoring-activities-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_activities' },
        (payload) => {
          console.log('Real-time update: student_activities table changed in monitoring dashboard', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['student-activities-monitoring'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(feedbackChannel);
      supabase.removeChannel(activitiesChannel);
    };
  }, [queryClient]); // Dependency array includes queryClient

  // --- Data Fetching Queries ---

  const { data: activeUsers = [], isLoading: isLoadingActiveUsers, isError: isErrorActiveUsers, error: errorActiveUsers } = useQuery({
    queryKey: ['active-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: feedback = [], isLoading: isLoadingFeedback, isError: isErrorFeedback, error: errorFeedback } = useQuery({
    queryKey: ['all-feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          *,
          profiles (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: studentActivitiesData = [], isLoading: isLoadingStudentActivities, isError: isErrorStudentActivities, error: errorStudentActivities } = useQuery({
    queryKey: ['student-activities-monitoring'],
    queryFn: async () => {
      // Fetch all students (profiles with role 'student')
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('id, user_id, name, email') // Select user_id to match student_activities
        .eq('role', 'student');

      if (studentsError) {
        console.error("Error fetching students for activity monitoring:", studentsError);
        throw studentsError;
      }

      // If no students, return empty array immediately
      if (!students || students.length === 0) {
        return [];
      }

      // Fetch latest activities for each student
      const activitiesPromises = students.map(async (student) => {
        const { data: activities, error: activitiesError } = await supabase
          .from('student_activities')
          .select('*')
          .eq('user_id', student.user_id) // Use user_id for joining
          .order('created_at', { ascending: false })
          .limit(5); // Get latest 5 activities per student
        
        if (activitiesError) {
          console.warn(`Error fetching activities for student ${student.name}:`, activitiesError);
          // Return student with empty activities if there's an error for this specific student
          return { ...student, activities: [] };
        }
        return { ...student, activities: activities || [] };
      });
      
      return Promise.all(activitiesPromises);
    }
  });

  // Consolidated loading and error states for main dashboard content
  const overallLoading = isLoadingActiveUsers || isLoadingFeedback || isLoadingStudentActivities;
  const overallError = isErrorActiveUsers || isErrorFeedback || isErrorStudentActivities;

  if (overallLoading) {
    return (
      <div className="p-6 space-y-8 bg-gray-50/50 min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-xl text-gray-700">Loading Monitoring Data...</p>
        </div>
      </div>
    );
  }

  if (overallError) {
    const errorMessage = errorActiveUsers?.message || errorFeedback?.message || errorStudentActivities?.message || 'Unknown error occurred.';
    return (
      <div className="p-6 space-y-8 bg-gray-50/50 min-h-full flex items-center justify-center text-center">
        <Card className="p-8 rounded-3xl shadow-xl border-red-400 border-2 bg-white">
          <AlertTriangle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Monitoring Data</h3>
          <p className="text-gray-600 mb-4">
            There was a problem fetching monitoring data. Please check your Supabase configuration:
          </p>
          <ul className="list-disc list-inside text-left text-gray-700 space-y-1">
            <li>Ensure RLS policies allow `super_admin` to `SELECT` from `profiles`, `feedback`, and `student_activities`.</li>
            <li>Confirm your logged-in user's role is `super_admin` in `public.profiles`.</li>
            <li>Check for network issues or a temporary Supabase outage.</li>
          </ul>
          <p className="mt-4 text-sm text-red-500">Error details: {errorMessage}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50/50 min-h-full">
      <h2 className="text-2xl font-bold flex items-center">
        <Monitor className="mr-2 h-7 w-7 text-primary" />
        Monitoring Dashboard
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{activeUsers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Feedback</p>
                <p className="text-2xl font-bold">{feedback.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Monitored Students</p>
                <p className="text-2xl font-bold">{studentActivitiesData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Active Users</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="activity">Student Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4">
            {activeUsers.map((user: any) => (
              <Card key={user.id} className="bg-white shadow-md rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{user.role}</Badge>
                        {Array.isArray(user.batch) ? user.batch.map((b: string) => <Badge key={b} variant="outline">{b}</Badge>) : user.batch && <Badge variant="outline">{user.batch}</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        Last Updated: {format(new Date(user.updated_at), 'PPp')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Status: {user.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <div className="grid gap-4">
            {feedback.map((item: any) => (
              <Card key={item.id} className="bg-white shadow-md rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm mb-2">"{item.comments}"</p>
                      <div className="flex gap-2">
                        <Badge variant="outline">{item.subject}</Badge>
                        <Badge variant="outline">{item.batch}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(item.created_at), 'PPp')}
                      </p>
                      <p className="text-sm font-medium">
                        By: {item.profiles?.name || 'Anonymous'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4">
            {studentActivitiesData.map((student: any) => (
              <Card key={student.id} className="bg-white shadow-md rounded-xl">
                <CardHeader>
                  <CardTitle>{student.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                </CardHeader>
                <CardContent>
                  {student.activities && student.activities.length > 0 ? (
                    <ul className="space-y-2">
                      {student.activities.map((activity: any) => (
                        <li key={activity.id} className="text-sm p-2 bg-gray-50 rounded-md">
                          <strong>{activity.activity_type}:</strong> {activity.description}
                          <span className="text-xs text-muted-foreground ml-2">({format(new Date(activity.created_at), 'PPp')})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity recorded for this student.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
