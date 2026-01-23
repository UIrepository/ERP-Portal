import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter, addMinutes } from 'date-fns';
import { JitsiMeeting } from '@/components/JitsiMeeting';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date: string | null;
}

interface UserEnrollment {
  batch_name: string;
  subject_name: string;
}

export const StudentJoinClass = () => {
  const { profile, user } = useAuth();
  const [activeMeeting, setActiveMeeting] = useState<{
    roomName: string;
    subject: string;
    batch: string;
    scheduleId: string;
  } | null>(null);

  // Fetch user enrollments
  const { data: enrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['studentEnrollments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Fetch all schedules
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['allSchedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, subject, batch, day_of_week, start_time, end_time, date');
      if (error) throw error;
      return data || [];
    }
  });

  // Filter schedules for today based on enrollments
  const todaysClasses = useMemo(() => {
    if (!schedules || !enrollments || enrollments.length === 0) return [];
    
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    
    // Create a Set of enrolled batch-subject combinations for quick lookup
    const enrolledCombinations = new Set(
      enrollments.map(e => `${e.batch_name}|${e.subject_name}`)
    );
    
    return schedules.filter(schedule => {
      // Check if student is enrolled in this batch+subject
      const isEnrolled = enrolledCombinations.has(`${schedule.batch}|${schedule.subject}`);
      if (!isEnrolled) return false;
      
      // Check if this schedule is for today
      if (schedule.date) {
        return isToday(new Date(schedule.date));
      } else {
        return schedule.day_of_week === todayDayOfWeek;
      }
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, enrollments]);

  // Categorize classes
  const { liveClasses, upcomingClasses, completedClasses } = useMemo(() => {
    const now = new Date();
    const live: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const completed: Schedule[] = [];

    todaysClasses.forEach(cls => {
      const startTime = parse(cls.start_time, 'HH:mm:ss', now);
      const endTime = parse(cls.end_time, 'HH:mm:ss', now);
      
      if (isBefore(now, startTime)) {
        upcoming.push(cls);
      } else if (isAfter(now, endTime)) {
        completed.push(cls);
      } else {
        live.push(cls);
      }
    });

    return { liveClasses: live, upcomingClasses: upcoming, completedClasses: completed };
  }, [todaysClasses]);

  const formatTime = (time: string) => {
    const parsed = parse(time, 'HH:mm:ss', new Date());
    return format(parsed, 'h:mm a');
  };

  const handleJoinClass = (cls: Schedule) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setActiveMeeting({
      roomName: `${cls.batch}-${cls.subject}-${today}`,
      subject: cls.subject,
      batch: cls.batch,
      scheduleId: cls.id
    });
  };

  const isLoading = isLoadingEnrollments || isLoadingSchedules;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Enrollments Found</h3>
            <p className="text-muted-foreground text-center mt-2">
              You are not enrolled in any classes yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Join Class</h1>
        <p className="text-muted-foreground">Today's classes • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Live Classes */}
      {liveClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Live Now
          </h2>
          <div className="grid gap-4">
            {liveClasses.map((cls) => (
              <Card key={cls.id} className="border-green-500 bg-green-50 dark:bg-green-950">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{cls.subject}</h3>
                      <p className="text-muted-foreground">{cls.batch}</p>
                      <p className="text-sm mt-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    <Button 
                      size="lg" 
                      onClick={() => handleJoinClass(cls)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Video className="mr-2 h-5 w-5" />
                      Join Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Classes */}
      {upcomingClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Today
          </h2>
          <div className="grid gap-4">
            {upcomingClasses.map((cls) => (
              <Card key={cls.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{cls.subject}</h3>
                      <p className="text-muted-foreground text-sm">{cls.batch}</p>
                      <p className="text-sm mt-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    <Badge variant="secondary">Upcoming</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Classes */}
      {completedClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Completed</h2>
          <div className="grid gap-4">
            {completedClasses.map((cls) => (
              <Card key={cls.id} className="opacity-60">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{cls.subject}</h3>
                      <p className="text-muted-foreground text-sm">{cls.batch}</p>
                      <p className="text-sm mt-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    <Badge variant="outline">Completed</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No Classes Today */}
      {todaysClasses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Classes Today</h3>
            <p className="text-muted-foreground text-center mt-2">
              You don't have any scheduled classes for today.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Jitsi Meeting Overlay */}
      {activeMeeting && (
        <JitsiMeeting
          roomName={activeMeeting.roomName}
          displayName={user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.name || 'Student'}
          subject={activeMeeting.subject}
          batch={activeMeeting.batch}
          scheduleId={activeMeeting.scheduleId}
          onClose={() => setActiveMeeting(null)}
        />
      )}
    </div>
  );
};
