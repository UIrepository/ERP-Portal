
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, FileText, MessageSquare, DollarSign } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { TeacherSchedule } from './teacher/TeacherSchedule';
import { TeacherFeedback } from './teacher/TeacherFeedback';
import { TeacherContent } from './teacher/TeacherContent';
import { TeacherExtraClasses } from './teacher/TeacherExtraClasses';
import { TeacherBankDetails } from './teacher/TeacherBankDetails';

export const TeacherDashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Get today's schedule for teacher
  const { data: todaySchedule } = useQuery({
    queryKey: ['teacher-today-schedule'],
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

  // Get teacher's extra classes
  const { data: extraClasses } = useQuery({
    queryKey: ['teacher-extra-classes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('extra_classes')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  // Get recent feedback
  const { data: recentFeedback } = useQuery({
    queryKey: ['teacher-recent-feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('feedback')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('created_at', { ascending: false })
        .limit(5);
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
  const upcomingExtraClasses = extraClasses?.filter(cls => new Date(cls.date) >= new Date()) || [];

  if (profile?.role !== 'teacher') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have permission to access this page.</p>
      </div>
    );
  }

  if (activeTab !== 'dashboard') {
    return (
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="extra-classes">Extra Classes</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="bank-details">Bank Details</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-6">
            <TeacherSchedule />
          </TabsContent>

          <TabsContent value="extra-classes" className="mt-6">
            <TeacherExtraClasses />
          </TabsContent>

          <TabsContent value="feedback" className="mt-6">
            <TeacherFeedback />
          </TabsContent>

          <TabsContent value="bank-details" className="mt-6">
            <TeacherBankDetails />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {profile?.name}!</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="extra-classes">Extra Classes</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="bank-details">Bank Details</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6 space-y-6">
          {/* Current Class Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
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
                        Start Class
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

          {/* Upcoming Extra Classes */}
          {upcomingExtraClasses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Upcoming Extra Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingExtraClasses.slice(0, 3).map((extraClass) => (
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

          {/* Recent Feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="mr-2 h-5 w-5" />
                Recent Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentFeedback && recentFeedback.length > 0 ? (
                <div className="space-y-3">
                  {recentFeedback.map((feedback) => (
                    <div
                      key={feedback.id}
                      className="p-3 border-l-4 border-primary bg-muted/50 rounded-r-lg"
                    >
                      <p className="text-sm">{feedback.feedback_text}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{feedback.subject}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(feedback.created_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No feedback received yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
