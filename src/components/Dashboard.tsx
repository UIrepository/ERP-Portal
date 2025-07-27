import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Video, BookOpen, Users } from 'lucide-react';
import { format, isToday, isAfter, parseISO } from 'date-fns';

export const Dashboard = () => {
  const { profile } = useAuth();

  // Get today's schedule
  const { data: todaySchedule } = useQuery({
    queryKey: ['today-schedule'],
    queryFn: async () => {
      const today = new Date().getDay();
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .eq('day_of_week', today)
        .order('start_time');
      return data || [];
    },
  });

  // Get notifications
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Get current class
  const getCurrentClass = () => {
    if (!todaySchedule) return null;
    
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    return todaySchedule.find(schedule => {
      const startTime = schedule.start_time;
      const endTime = schedule.end_time;
      return currentTime >= startTime && currentTime <= endTime;
    });
  };

  // Get next class
  const getNextClass = () => {
    if (!todaySchedule) return null;
    
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    return todaySchedule.find(schedule => {
      return schedule.start_time > currentTime;
    });
  };

  const currentClass = getCurrentClass();
  const nextClass = getNextClass();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {getGreeting()}, {profile?.name}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome to your {profile?.role?.replace('_', ' ')} dashboard
        </p>
      </div>

      {/* Current Class Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Video className="mr-2 h-5 w-5" />
            Current Class Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentClass ? (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{currentClass.subject}</h3>
                <p className="text-muted-foreground">
                  {currentClass.start_time} - {currentClass.end_time}
                </p>
                <Badge variant="default" className="mt-2">
                  <Clock className="mr-1 h-3 w-3" />
                  Live Now
                </Badge>
              </div>
              {currentClass.link && (
                <Button asChild>
                  <a href={currentClass.link} target="_blank" rel="noopener noreferrer">
                    Join Now
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No class is currently ongoing</p>
              {nextClass && (
                <div className="mt-4">
                  <p className="text-sm">Next class:</p>
                  <p className="font-semibold">{nextClass.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    at {nextClass.start_time}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Today's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaySchedule && todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule.map((schedule, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <h4 className="font-medium">{schedule.subject}</h4>
                    <p className="text-sm text-muted-foreground">
                      {schedule.start_time} - {schedule.end_time}
                    </p>
                  </div>
                  <Badge variant="outline">{schedule.batch}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No classes scheduled for today
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      {notifications && notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="mr-2 h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 border-l-4 border-primary bg-muted/50 rounded-r-lg"
                >
                  <h4 className="font-medium">{notification.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(notification.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Batch</p>
                <p className="text-2xl font-bold">{profile?.batch || 'Not Assigned'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Subjects</p>
                <p className="text-2xl font-bold">{profile?.subjects?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Role</p>
                <p className="text-lg font-bold capitalize">
                  {profile?.role?.replace('_', ' ') || 'Student'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};