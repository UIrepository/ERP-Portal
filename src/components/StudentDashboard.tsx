
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Video, FileText, MessageSquare, GraduationCap, Plus } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { StudentSchedule } from './student/StudentSchedule';
import { StudentNotes } from './student/StudentNotes';
import { StudentRecordings } from './student/StudentRecordings';
import { StudentFeedback } from './student/StudentFeedback';
import { StudentExtraClasses } from './student/StudentExtraClasses';
import { StudentExams } from './student/StudentExams';
import { StudentCurrentClass } from './student/StudentCurrentClass';

export const StudentDashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Security: Disable right-click, F12, Ctrl+U, etc.
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Get today's schedule
  const { data: todaySchedule } = useQuery({
    queryKey: ['student-today-schedule'],
    queryFn: async () => {
      const today = new Date().getDay();
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .eq('day_of_week', today)
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('start_time');
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  // Get notifications
  const { data: notifications } = useQuery({
    queryKey: ['student-notifications'],
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

  // Get extra classes
  const { data: extraClasses } = useQuery({
    queryKey: ['student-extra-classes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('extra_classes')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(3);
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

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

  if (profile?.role !== 'student') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have permission to access this page.</p>
      </div>
    );
  }

  // Check if student has proper batch and subjects assigned
  if (!profile?.batch || !profile?.subjects || profile.subjects.length === 0) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-warning">Enrollment Required</h1>
        <p className="text-muted-foreground mt-2">
          You're not enrolled in any batch or subject yet. Please contact support.
        </p>
      </div>
    );
  }

  if (activeTab !== 'dashboard') {
    return (
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="current-class">Current Class</TabsTrigger>
            <TabsTrigger value="recordings">Recordings</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="exams">Exams</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-6">
            <StudentSchedule />
          </TabsContent>

          <TabsContent value="current-class" className="mt-6">
            <StudentCurrentClass />
          </TabsContent>

          <TabsContent value="recordings" className="mt-6">
            <StudentRecordings />
          </TabsContent>

          <TabsContent value="notes" className="mt-6">
            <StudentNotes />
          </TabsContent>

          <TabsContent value="feedback" className="mt-6">
            <StudentFeedback />
          </TabsContent>

          <TabsContent value="exams" className="mt-6">
            <StudentExams />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {profile?.name}!</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="current-class">Current Class</TabsTrigger>
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6 space-y-6">
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
                <Calendar className="mr-2 h-5 w-5" />
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

          {/* Extra Classes */}
          {extraClasses && extraClasses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="mr-2 h-5 w-5" />
                  Upcoming Extra Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {extraClasses.map((extraClass) => (
                    <div
                      key={extraClass.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{extraClass.subject}</h4>
                        <p className="text-sm text-muted-foreground">
                          {extraClass.date} - {extraClass.start_time} to {extraClass.end_time}
                        </p>
                        {extraClass.reason && (
                          <p className="text-xs text-muted-foreground">
                            Reason: {extraClass.reason}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">{extraClass.batch}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications */}
          {notifications && notifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
