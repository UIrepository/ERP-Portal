
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video, Plus, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { StudentSchedule } from './student/StudentSchedule';
import { StudentRecordings } from './student/StudentRecordings';
import { StudentFeedback } from './student/StudentFeedback';
import { StudentCurrentClass } from './student/StudentCurrentClass';
import { StudentDPP } from './student/StudentDPP';
import { StudentUIKiPadhai } from './student/StudentUIKiPadhai';
import { StudentChatTeacher } from './student/StudentChatTeacher';
import { StudentChatFounder } from './student/StudentChatFounder';

interface StudentDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const StudentDashboard = ({ activeTab, onTabChange }: StudentDashboardProps) => {
  const { profile } = useAuth();

  // Security: Disable right-click, F12, Ctrl+U, etc.
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Render specific tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'schedule':
        return <StudentSchedule />;
      case 'current-class':
        return <StudentCurrentClass />;
      case 'recordings':
        return <StudentRecordings />;
      case 'dpp':
        return <StudentDPP />;
      case 'ui-ki-padhai':
        return <StudentUIKiPadhai />;
      case 'feedback':
        return <StudentFeedback />;
      case 'chat-teacher':
        return <StudentChatTeacher />;
      case 'chat-founder':
        return <StudentChatFounder />;
      default:
        return renderDashboardContent();
    }
  };

  const renderDashboardContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🎓 Student Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {profile?.name}!</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
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
    </div>
  );

  return (
    <div className="p-6">
      {renderTabContent()}
    </div>
  );
};
