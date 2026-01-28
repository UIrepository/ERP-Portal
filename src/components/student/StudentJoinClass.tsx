import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users, AlertCircle } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter, getDay, parseISO } from 'date-fns';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date: string | null;
  link?: string | null;
}

interface UserEnrollment {
  batch_name: string;
  subject_name: string;
}

export const StudentJoinClass = () => {
  const { profile, user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Restore: Active Meeting State for Embedded Jitsi
  const [activeMeeting, setActiveMeeting] = useState<{
    roomName: string;
    subject: string;
    batch: string;
    scheduleId: string;
  } | null>(null);

  // Update clock for real-time status updates
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Every minute
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch User Enrollments
  const { data: enrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['studentEnrollments', user?.id],
    queryFn: async () => {
      // Support both profile.user_id and auth.user.id
      const userId = user?.id;
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', userId);
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // 2. Fetch Schedules (Optimized: Only for enrolled batches)
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['mySchedules', enrollments],
    queryFn: async () => {
      if (!enrollments || enrollments.length === 0) return [];
      
      // Extract unique batches to filter query
      const myBatches = [...new Set(enrollments.map(e => e.batch_name))];

      const { data, error } = await supabase
        .from('schedules')
        .select('id, subject, batch, day_of_week, start_time, end_time, date, link')
        .in('batch', myBatches); // Filter DB side for performance

      if (error) throw error;
      return data || [];
    },
    enabled: !!enrollments && enrollments.length > 0
  });

  // 3. Filter and Process Schedules for Today
  const todaysClasses = useMemo(() => {
    if (!schedules || !enrollments || enrollments.length === 0) return [];
    
    const today = new Date();
    const todayDayOfWeek = getDay(today); // 0 = Sun
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Create a Set for O(1) enrollment lookup
    const enrolledCombinations = new Set(
      enrollments.map(e => `${e.batch_name}|${e.subject_name}`)
    );
    
    return schedules.filter(schedule => {
      // A. Check Enrollment (Batch AND Subject)
      const isEnrolled = enrolledCombinations.has(`${schedule.batch}|${schedule.subject}`);
      if (!isEnrolled) return false;
      
      // B. Check Date/Day
      if (schedule.date) {
        // Fix: Direct string comparison avoids timezone issues with 'new Date()'
        return schedule.date === todayStr; 
      } else {
        // Recurring class
        return schedule.day_of_week === todayDayOfWeek;
      }
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, enrollments]);

  // 4. Categorize Classes (Live, Upcoming, Completed)
  const { liveClasses, upcomingClasses, completedClasses } = useMemo(() => {
    const now = new Date();
    const live: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const completed: Schedule[] = [];

    todaysClasses.forEach(cls => {
      // Robust time parsing
      const startTime = parse(cls.start_time, 'HH:mm:ss', now);
      const endTime = parse(cls.end_time, 'HH:mm:ss', now);
      
      // Allow joining 15 mins early
      const joinTime = new Date(startTime.getTime() - 15 * 60000);

      if (isBefore(now, joinTime)) {
        upcoming.push(cls);
      } else if (isAfter(now, endTime)) {
        completed.push(cls);
      } else {
        live.push(cls);
      }
    });

    return { liveClasses: live, upcomingClasses: upcoming, completedClasses: completed };
  }, [todaysClasses, currentTime]); // Re-run when currentTime changes

  const formatTime = (time: string) => {
    const parsed = parse(time, 'HH:mm:ss', new Date());
    return format(parsed, 'h:mm a');
  };

  const handleJoinClass = (cls: Schedule) => {
    // Generate room name deterministically (Batch_Subject)
    const roomName = generateJitsiRoomName(cls.batch, cls.subject);
    
    setActiveMeeting({
      roomName,
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

      {/* 1. Live Classes Section */}
      {liveClasses.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-green-700">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            Live Now
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {liveClasses.map((cls) => (
              <Card key={cls.id} className="border-green-500 bg-green-50/50 shadow-md hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-green-900">{cls.subject}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="bg-white border-green-200">{cls.batch}</Badge>
                        {cls.date && <Badge className="bg-green-200 text-green-800 hover:bg-green-300">Extra Class</Badge>}
                      </div>
                      <p className="text-sm mt-3 flex items-center gap-2 font-medium text-green-800">
                        <Clock className="h-4 w-4" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    <Button 
                      size="lg" 
                      onClick={() => handleJoinClass(cls)}
                      className="bg-green-600 hover:bg-green-700 shadow-sm w-full md:w-auto"
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

      {/* 2. Upcoming Classes Section */}
      {upcomingClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Upcoming Today
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingClasses.map((cls) => (
              <Card key={cls.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{cls.subject}</h3>
                      <p className="text-muted-foreground text-sm">{cls.batch}</p>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">Upcoming</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                    <Clock className="h-4 w-4" />
                    {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 3. Completed Classes Section */}
      {completedClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
             <Clock className="h-5 w-5" />
             Completed
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedClasses.map((cls) => (
              <Card key={cls.id} className="opacity-60 bg-muted/20 hover:opacity-100 transition-opacity">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold line-through decoration-muted-foreground/50">{cls.subject}</h3>
                      <p className="text-muted-foreground text-sm">{cls.batch}</p>
                    </div>
                    <Badge variant="outline">Ended</Badge>
                  </div>
                  <p className="text-sm mt-2 text-muted-foreground">
                    {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {todaysClasses.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Calendar className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">No Classes Today</h3>
            <p className="text-muted-foreground text-center mt-2 max-w-sm">
              You don't have any scheduled classes for today. Check your schedule for upcoming sessions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Embedded Jitsi Meeting Overlay */}
      {activeMeeting && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
             <div className="h-full w-full max-w-7xl mx-auto flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">{activeMeeting.subject}</h2>
                        <p className="text-muted-foreground">{activeMeeting.batch} • Live Class</p>
                    </div>
                    <Button variant="destructive" onClick={() => setActiveMeeting(null)}>
                        Leave Class
                    </Button>
                </div>
                <div className="flex-1 border rounded-lg overflow-hidden shadow-2xl bg-black">
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
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
