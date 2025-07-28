
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Monitor, MessageCircle, Activity } from 'lucide-react';
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

  const { data: chatLogs = [] } = useQuery({
    queryKey: ['chat-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: feedback = [] } = useQuery({
    queryKey: ['all-feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      // Get recent notes, recordings, and extra classes as activity
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: recordings } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: extraClasses } = await supabase
        .from('extra_classes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      // Combine and sort all activities
      const activities = [
        ...(notes || []).map(item => ({ ...item, type: 'note' })),
        ...(recordings || []).map(item => ({ ...item, type: 'recording' })),
        ...(extraClasses || []).map(item => ({ ...item, type: 'extra_class' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return activities.slice(0, 50);
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Monitoring Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <MessageCircle className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Chat Messages</p>
                <p className="text-2xl font-bold">{chatLogs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MessageCircle className="h-8 w-8 text-primary" />
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
                <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
                <p className="text-2xl font-bold">{recentActivity.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Active Users</TabsTrigger>
          <TabsTrigger value="chat">Chat Logs</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
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
                        {user.batch && <Badge variant="outline">{user.batch}</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        Last Updated: {format(new Date(user.updated_at), 'PPp')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Status: {user.is_active ? 'Active' : 'Inactive'}
                      </p>
                      {user.subjects && user.subjects.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Subjects: {user.subjects.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="chat" className="space-y-4">
          <div className="grid gap-4">
            {chatLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Sender: {log.sender_id || 'Unknown'}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">Receiver: {log.receiver_id || 'Unknown'}</span>
                      </div>
                      <p className="text-sm mb-2">{log.message}</p>
                      <div className="flex gap-2">
                        <Badge variant="outline">{log.subject}</Badge>
                        <Badge variant="outline">{log.batch}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(log.timestamp), 'PPp')}
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
            {feedback.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm mb-2">{item.feedback_text}</p>
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
                        By: {item.submitted_by || 'Anonymous'}
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
            {recentActivity.map((activity) => (
              <Card key={activity.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold capitalize">{activity.type.replace('_', ' ')}</h3>
                      <p className="text-sm text-muted-foreground">
                        {activity.type === 'note' ? activity.title : 
                         activity.type === 'recording' ? activity.topic : 
                         activity.type === 'extra_class' ? `${activity.subject} - Extra Class` : 
                         'Activity'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {activity.subject && <Badge variant="outline">{activity.subject}</Badge>}
                        {activity.batch && <Badge variant="outline">{activity.batch}</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(activity.created_at), 'PPp')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
