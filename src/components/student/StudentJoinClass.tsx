import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users, Lock, Loader2 } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter } from 'date-fns';
import { JitsiMeeting } from '@/components/JitsiMeeting';

// 🛑 REMOVED jitsiUtils import
// 🛑 Helper moved here (though not strictly needed if we rely on active_classes DB)

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date: string | null;
}

export const StudentJoinClass = () => {
  const { profile, user, session } = useAuth();
  
  // Active Class State (Realtime)
  const [activeClass, setActiveClass] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);

  // 1. Fetch Schedules (For list view)
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['allSchedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('schedules').select('*');
      if (error) throw error;
      return data || [];
    }
  });

  // 2. Fetch User Enrollments
  const { data: enrollments, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ['studentEnrollments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data } = await supabase.from('user_enrollments').select('*').eq('user_id', profile.user_id);
      return data || [];
    }
  });

  // 3. LISTEN FOR ACTIVE LIVE CLASSES (Realtime)
  useEffect(() => {
    const fetchActiveClass = async () => {
        if (!enrollments || enrollments.length === 0) return;
        const myBatches = enrollments.map(e => e.batch_name);
        
        const { data } = await supabase
            .from('active_classes')
            .select('*')
            .in('batch', myBatches)
            .maybeSingle();
        setActiveClass(data);
    };

    fetchActiveClass();

    const channel = supabase.channel('public:active_classes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'active_classes' }, 
        () => fetchActiveClass()) 
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [enrollments]);

  // Filter Schedules Logic
  const todaysClasses = useMemo(() => {
    if (!schedules || !enrollments || enrollments.length === 0) return [];
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const enrolledSet = new Set(enrollments.map(e => `${e.batch_name}|${e.subject_name}`));
    
    return schedules.filter(schedule => {
      if (!enrolledSet.has(`${schedule.batch}|${schedule.subject}`)) return false;
      if (schedule.date) return isToday(new Date(schedule.date));
      return schedule.day_of_week === todayDayOfWeek;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, enrollments]);

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

    return { liveClasses, upcomingClasses, completedClasses };
  }, [todaysClasses]);

  const formatTime = (time: string) => format(parse(time, 'HH:mm:ss', new Date()), 'h:mm a');

  // RENDER
  if (isJoined && activeClass) {
      return (
          <JitsiMeeting
              roomName={activeClass.room_id}
              displayName={profile?.name || "Student"}
              subject={activeClass.subject}
              batch={activeClass.batch}
              userRole="student"
              onClose={() => setIsJoined(false)}
          />
      );
  }

  // Active Class Card (Top Priority)
  if (activeClass && !isJoined) {
    return (
      <div className="p-6">
        <Card className="bg-gradient-to-r from-blue-900 to-indigo-900 border-blue-500 shadow-xl animate-in fade-in">
          <CardHeader>
             <CardTitle className="text-white flex items-center gap-2">
                 <Video className="w-5 h-5 text-green-400 animate-pulse" />
                 Live Now: {activeClass.subject}
             </CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-blue-200 mb-4 text-sm">Batch: {activeClass.batch}</p>
             <Button onClick={() => setIsJoined(true)} className="w-full bg-green-600 hover:bg-green-700 font-bold h-12 text-lg">
                 Join Live Class
             </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingSchedules || isLoadingEnrollments) return <Skeleton className="m-6 h-64" />;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Classes</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {upcomingClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" /> Upcoming</h2>
          <div className="grid gap-4">
            {upcomingClasses.map((cls) => (
              <Card key={cls.id}>
                <CardContent className="p-6 flex justify-between items-center">
                   <div>
                       <h3 className="font-bold">{cls.subject}</h3>
                       <p className="text-sm text-muted-foreground">{cls.batch}</p>
                       <p className="text-xs mt-1">{formatTime(cls.start_time)}</p>
                   </div>
                   <Badge variant="secondary">Scheduled</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {todaysClasses.length === 0 && !activeClass && (
        <Card>
            <CardContent className="py-12 text-center text-muted-foreground">No classes today.</CardContent>
        </Card>
      )}
    </div>
  );
};
