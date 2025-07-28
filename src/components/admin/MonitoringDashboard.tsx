
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Monitor, MessageCircle, Activity } from 'lucide-react';
import { format } from 'date-fns';

export const MonitoringDashboard = () => {
  const { data: activeSessions = [] } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          *,
          profiles!inner(name, email, role, batch)
        `)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });
      
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

  const { data: analyticsEvents = [] } = useQuery({
    queryKey: ['analytics-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
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
                <p className="text-sm font-medium text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
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
                <p className="text-sm font-medium text-muted-foreground">Analytics Events</p>
                <p className="text-2xl font-bold">{analyticsEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="chat">Chat Logs</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sessions" className="space-y-4">
          <div className="grid gap-4">
            {activeSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{session.profiles.name}</h3>
                      <p className="text-sm text-muted-foreground">{session.profiles.email}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{session.profiles.role}</Badge>
                        <Badge variant="outline">{session.profiles.batch}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        Last Active: {format(new Date(session.last_activity), 'PPp')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        IP: {session.ip_address || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Device: {session.device_info || 'Unknown'}
                      </p>
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
                        <span className="font-medium">Sender: {log.sender_id}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">Receiver: {log.receiver_id}</span>
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
        
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4">
            {analyticsEvents.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{event.event_type}</h3>
                      <p className="text-sm text-muted-foreground">
                        User: {event.user_id || 'Anonymous'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {event.subject && <Badge variant="outline">{event.subject}</Badge>}
                        {event.batch && <Badge variant="outline">{event.batch}</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.created_at), 'PPp')}
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
