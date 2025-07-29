import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Monitor, MessageSquare, Activity } from 'lucide-react';
import { format } from 'date-fns';

export const MonitoringDashboard = () => {
  const { data: activeUsers = [] } = useQuery({
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

  const { data: feedback = [] } = useQuery({
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

  const { data: studentActivities = [] } = useQuery({
    queryKey: ['student-activities-monitoring'],
    queryFn: async () => {
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'student');

      if (studentsError) throw studentsError;

      const activitiesPromises = students.map(async (student) => {
        const { data: activities, error: activitiesError } = await supabase
          .from('student_activities')
          .select('*')
          .eq('user_id', student.id)
          .order('created_at', { ascending: false })
          .limit(5); // Get latest 5 activities per student
        
        if (activitiesError) return { ...student, activities: [] };
        return { ...student, activities };
      });
      
      return Promise.all(activitiesPromises);
    }
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Monitoring Dashboard</h2>
      
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
                <p className="text-2xl font-bold">{studentActivities.length}</p>
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
            {activeUsers.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{user.role}</Badge>
                        {Array.isArray(user.batch) ? user.batch.map(b => <Badge key={b} variant="outline">{b}</Badge>) : user.batch && <Badge variant="outline">{user.batch}</Badge>}
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
              <Card key={item.id}>
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
            {studentActivities.map((student) => (
              <Card key={student.id}>
                <CardHeader>
                  <CardTitle>{student.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                </CardHeader>
                <CardContent>
                  {student.activities.length > 0 ? (
                    <ul className="space-y-2">
                      {student.activities.map(activity => (
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
