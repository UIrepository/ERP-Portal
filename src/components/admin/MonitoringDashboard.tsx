import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Monitor, MessageSquare, Activity, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useMemo } from 'react';

export const MonitoringDashboard = () => {

  const { data, isLoading } = useQuery({
    queryKey: ['monitoring-dashboard-data'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monitoring_dashboard_data');
      if (error) throw error;
      return data;
    }
  });

  const { activeUsers = [], feedback = [], studentActivities = [] } = data || {};

  const activitiesGroupedByStudent = useMemo(() => {
    if (!studentActivities) return [];
    
    const groups = studentActivities.reduce((acc: any, activity: any) => {
        const studentId = activity.user_id;
        if (!acc[studentId]) {
            acc[studentId] = {
                id: studentId,
                name: activity.student_name,
                email: activity.student_email,
                activities: []
            };
        }
        if (acc[studentId].activities.length < 5) {
            acc[studentId].activities.push(activity);
        }
        return acc;
    }, {});

    return Object.values(groups);
  }, [studentActivities]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50/50 min-h-full">
      <h2 className="text-3xl font-bold text-gray-800">Monitoring Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center text-gray-600">
                <Users className="mr-2 h-5 w-5" />
                Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{activeUsers.length}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
            <CardHeader>
                <CardTitle className="text-base font-medium flex items-center text-gray-600">
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Total Feedback
                </CardTitle>
            </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{feedback.length}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
            <CardHeader>
                <CardTitle className="text-base font-medium flex items-center text-gray-600">
                    <Activity className="mr-2 h-5 w-5" />
                    Monitored Students
                </CardTitle>
            </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{Object.keys(activitiesGroupedByStudent).length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Active Users</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="activity">Student Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="mt-6 space-y-4">
          {activeUsers.map((user: any) => (
            <Card key={user.id} className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{user.role}</Badge>
                      {Array.isArray(user.batch) ? user.batch.map((b: string) => <Badge key={b} variant="secondary">{b}</Badge>) : user.batch && <Badge variant="secondary">{user.batch}</Badge>}
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
        </TabsContent>

        <TabsContent value="feedback" className="mt-6 space-y-4">
            {feedback.map((item: any) => (
              <Card key={item.id} className="bg-white">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2">{item.subject} <Badge variant="secondary">{item.batch}</Badge></CardTitle>
                            <CardTitle className="text-base font-normal flex items-center gap-2 mt-2">
                                <User className="h-4 w-4" /> {item.profiles?.name || 'Anonymous'}
                            </CardTitle>
                        </div>
                        <div className="text-sm text-muted-foreground text-right">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(item.created_at), 'PPP')}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="mt-2 text-sm text-gray-800 italic bg-gray-50 p-3 rounded-md">"{item.comments}"</p>
                </CardContent>
              </Card>
            ))}
        </TabsContent>
        
        <TabsContent value="activity" className="mt-6 space-y-4">
            {activitiesGroupedByStudent.map((student: any) => (
              <Card key={student.id} className="bg-white">
                <CardHeader>
                  <CardTitle>{student.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                </CardHeader>
                <CardContent>
                  {student.activities.length > 0 ? (
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
