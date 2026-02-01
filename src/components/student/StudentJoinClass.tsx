import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users, Loader2 } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter } from 'date-fns';
import { toast } from 'sonner';

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
  id: string;
  batch_name: string;
  subject_name: string;
}

export const StudentJoinClass = () => {
  const { profile } = useAuth();
  const [waitingForClass, setWaitingForClass] = useState<string | null>(null); // Store ID of class we are waiting for
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user enrollments with IDs
  const { data: enrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['studentEnrollments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('id, batch_name, subject_name')
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

  // Filter schedules
  const todaysClasses = useMemo(() => {
    if (!schedules || !enrollments || enrollments.length === 0) return [];
    
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const enrolledCombinations = new Set(enrollments.map(e => `${e.batch_name}|${e.subject_name}`));
    
    return schedules.filter(schedule => {
      const isEnrolled = enrolledCombinations.has(`${schedule.batch}|${schedule.subject}`);
      if (!isEnrolled) return false;
      if (schedule.date) return isToday(new Date(schedule.date));
      return schedule.day_of_week === todayDayOfWeek;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, enrollments]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const checkTeacherAvailability = async (cls: Schedule, enrollmentId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Check if a teacher has marked attendance for this class today
    const { data: teacherLog, error } = await supabase
      .from('class_attendance')
      .select('id')
      .eq('schedule_id', cls.id)
      .eq('class_date', today)
      .eq('user_role', 'teacher')
      .limit(1);

    if (teacherLog && teacherLog.length > 0) {
        // Teacher is here! Stop polling and join.
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setWaitingForClass(null);
        
        toast.success("Teacher has joined! Entering class...");
        
        // Open the secure link
        const url = `/class-session/${enrollmentId}?scheduleId=${cls.id}`;
        window.open(url, '_blank');
    }
  };

  const handleJoinClick = (cls: Schedule) => {
    if (!enrollments) return;
    
    const enrollment = enrollments.find(
        e => e.batch_name === cls.batch && e.subject_name === cls.subject
    );

    if (!enrollment?.id) {
        toast.error("Enrollment error.");
        return;
    }

    if (waitingForClass === cls.id) {
        toast.info("Already checking for teacher...");
        return;
    }

    setWaitingForClass(cls.id);
    toast.info("Checking class status...", { description: "We will automatically join you once the teacher starts the class." });

    // Immediate check
    checkTeacherAvailability(cls, enrollment.id);

    // Start polling
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
        checkTeacherAvailability(cls, enrollment.id);
    }, 4000); // Check every 4 seconds
  };

  const { liveClasses, upcomingClasses, completedClasses } = useMemo(() => {
    const now = new Date();
    const live: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const completed: Schedule[] = [];

    todaysClasses.forEach(cls => {
      const startTime = parse(cls.start_time, 'HH:mm:ss', now);
      const endTime = parse(cls.end_time, 'HH:mm:ss', now);
      if (isBefore(now, startTime)) upcoming.push(cls);
      else if (isAfter(now, endTime)) completed.push(cls);
      else live.push(cls);
    });

    return { liveClasses: live, upcomingClasses: upcoming, completedClasses: completed };
  }, [todaysClasses]);

  const formatTime = (time: string) => format(parse(time, 'HH:mm:ss', new Date()), 'h:mm a');
  const isLoading = isLoadingEnrollments || isLoadingSchedules;

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-32 w-full" /></div>;
  }

  if (!enrollments || enrollments.length === 0) {
    return <div className="p-6 text-center text-muted-foreground">No enrollments found.</div>;
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
                    
                    {waitingForClass === cls.id ? (
                        <Button disabled className="bg-yellow-600/80 text-white min-w-[140px]">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Waiting for Teacher...
                        </Button>
                    ) : (
                        <Button 
                            size="lg" 
                            onClick={() => handleJoinClick(cls)}
                            className="bg-green-600 hover:bg-green-700 min-w-[140px]"
                        >
                            <Video className="mr-2 h-5 w-5" />
                            Join Now
                        </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming & Completed Sections (Simpler for brevity) */}
      {upcomingClasses.length > 0 && (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Upcoming</h2>
            {upcomingClasses.map((cls) => (
                <Card key={cls.id}><CardContent className="p-4"><h3 className="font-bold">{cls.subject}</h3><p className="text-sm">{cls.batch} • {formatTime(cls.start_time)}</p></CardContent></Card>
            ))}
        </div>
      )}
    </div>
  );
};
