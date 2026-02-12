import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter } from 'date-fns';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';
import { useMergedSubjects } from '@/hooks/useMergedSubjects';

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

  // Fetch active merges to determine primary pairs for room naming
  const { data: activeMerges = [], isLoading: isMergesLoading } = useQuery({
    queryKey: ['active-merges-for-join-class'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subject_merges')
        .select('*')
        .eq('is_active', true);
      if (error) return [];
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Helper to get primary pair for a batch+subject (for consistent Jitsi room naming)
  const getPrimaryPair = useMemo(() => {
    return (batch: string, subject: string) => {
      const merge = activeMerges.find((m: any) =>
        (m.primary_batch === batch && m.primary_subject === subject) ||
        (m.secondary_batch === batch && m.secondary_subject === subject)
      );
      if (!merge) return { batch, subject };
      // Return alphabetically first pair for deterministic room name
      const pairs = [
        { batch: merge.primary_batch, subject: merge.primary_subject },
        { batch: merge.secondary_batch, subject: merge.secondary_subject }
      ];
      return pairs.sort((a, b) => `${a.batch}|${a.subject}`.localeCompare(`${b.batch}|${b.subject}`))[0];
    };
  }, [activeMerges]);

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
    
    const enrolledCombinations = new Set(
      enrollments.map(e => `${e.batch_name}|${e.subject_name}`)
    );
    
    return schedules.filter(schedule => {
      const isEnrolled = enrolledCombinations.has(`${schedule.batch}|${schedule.subject}`);
      if (!isEnrolled) return false;
      
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

  const handleJoinClass = async (cls: Schedule) => {
    // 1. Mark Attendance
    try {
      if (profile?.user_id) {
        const today = format(new Date(), 'yyyy-MM-dd');
        await supabase.from('class_attendance').upsert({
          user_id: profile.user_id,
          user_name: profile.name || user?.email || 'Student',
          user_role: 'student',
          schedule_id: cls.id,
          batch: cls.batch,
          subject: cls.subject,
          class_date: today,
          joined_at: new Date().toISOString()
        }, { onConflict: 'user_id,schedule_id,class_date' });
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
    }

    // 2. Use primary pair for consistent room naming across merged subjects
    const primary = getPrimaryPair(cls.batch, cls.subject);
    const roomName = generateJitsiRoomName(primary.batch, primary.subject);
    const roomUrl = `https://meet.jit.si/${encodeURIComponent(roomName)}`;
    window.open(roomUrl, '_blank');
  };

  const isLoading = isLoadingEnrollments || isLoadingSchedules || isMergesLoading;

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

      {/* Jitsi Meeting Overlay (Legacy/Unused in new redirect flow) */}
      {activeMeeting && (
        <JitsiMeeting
          roomName={activeMeeting.roomName}
          displayName={user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.name || 'Student'}
          subject={activeMeeting.subject}
          batch={activeMeeting.batch}
          scheduleId={activeMeeting.scheduleId}
          onClose={() => setActiveMeeting(null)}
          userRole="student"
          userEmail={user?.email}
        />
      )}
    </div>
  );
};
