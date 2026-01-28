import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users, RefreshCw } from 'lucide-react';
import { format, getDay, parse, isBefore, isAfter } from 'date-fns';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';

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
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Active Meeting State
  const [activeMeeting, setActiveMeeting] = useState<{
    roomName: string;
    subject: string;
    batch: string;
    scheduleId: string;
  } | null>(null);

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch Student's Batches ONLY
  // We don't care about subject enrollments, just give us the batches the student is in.
  const { data: myBatches, isLoading: isLoadingBatches } = useQuery({
    queryKey: ['studentBatches', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name')
        .eq('user_id', user.id);
      
      if (error) throw error;
      // Return unique list of batches
      return [...new Set(data?.map(item => item.batch_name) || [])];
    },
    enabled: !!user?.id
  });

  // 2. Fetch Schedules for those Batches
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['studentSchedules', myBatches],
    queryFn: async () => {
      if (!myBatches || myBatches.length === 0) return [];
      
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .in('batch', myBatches); // Get everything for these batches

      if (error) throw error;
      return data || [];
    },
    enabled: !!myBatches && myBatches.length > 0
  });

  // 3. Simple Filtering for "Today"
  const todaysClasses = useMemo(() => {
    if (!schedules) return [];
    
    const now = new Date();
    const todayDayOfWeek = getDay(now); // 0 = Sunday
    const todayDateStr = format(now, 'yyyy-MM-dd'); // e.g. "2024-05-20"
    
    return schedules.filter(schedule => {
      // RULE 1: If it has a specific date, it MUST match today's date string.
      if (schedule.date) {
        return schedule.date === todayDateStr;
      }
      
      // RULE 2: If it has NO date (recurring), it matches the day of week.
      return schedule.day_of_week === todayDayOfWeek;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules]);

  // 4. Categorize (Live / Upcoming / Completed)
  const { liveClasses, upcomingClasses, completedClasses } = useMemo(() => {
    const now = currentTime;
    const live: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const completed: Schedule[] = [];

    todaysClasses.forEach(cls => {
      const startTime = parse(cls.start_time, 'HH:mm:ss', now);
      const endTime = parse(cls.end_time, 'HH:mm:ss', now);
      
      // Allow joining 10 mins early
      const joinWindowStart = new Date(startTime.getTime() - 10 * 60000);

      if (isBefore(now, joinWindowStart)) {
        upcoming.push(cls);
      } else if (isAfter(now, endTime)) {
        completed.push(cls);
      } else {
        live.push(cls);
      }
    });

    return { liveClasses: live, upcomingClasses: upcoming, completedClasses: completed };
  }, [todaysClasses, currentTime]);

  const formatTime = (time: string) => {
    const parsed = parse(time, 'HH:mm:ss', new Date());
    return format(parsed, 'h:mm a');
  };

  const handleJoinClass = (cls: Schedule) => {
    setActiveMeeting({
      roomName: generateJitsiRoomName(cls.batch, cls.subject),
      subject: cls.subject,
      batch: cls.batch,
      scheduleId: cls.id
    });
  };

  const isLoading = isLoadingBatches || isLoadingSchedules;

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

  // Fallback if not enrolled in any batch
  if (!myBatches || myBatches.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Batches Found</h3>
            <p className="text-muted-foreground text-center mt-2">
              You are not enrolled in any batches. Please contact admin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Join Class</h1>
          <p className="text-muted-foreground">
             Classes for <span className="font-medium text-foreground">{myBatches.join(', ')}</span> • {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <div className="text-right hidden md:block">
            <Badge variant="outline" className="text-sm py-1 px-3">
                <Clock className="h-3 w-3 mr-2" />
                {format(currentTime, 'h:mm a')}
            </Badge>
        </div>
      </div>

      {/* 1. Live Classes */}
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
                        <Badge variant="outline" className="bg-white border-green-200 text-green-700">{cls.batch}</Badge>
                        {cls.date && <Badge className="bg-green-200 text-green-800 hover:bg-green-300 border-0">Extra Class</Badge>}
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

      {/* 2. Upcoming Classes */}
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
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                        {cls.date ? 'Extra Class' : 'Upcoming'}
                    </Badge>
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

      {/* 3. Completed Classes */}
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
        <Card className="border-dashed bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Calendar className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">No Classes Today</h3>
            <p className="text-muted-foreground text-center mt-2 max-w-sm">
              You don't have any classes scheduled for <span className="font-medium">{myBatches.join(', ')}</span> today.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Schedule
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Embedded Jitsi Meeting Overlay */}
      {activeMeeting && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm p-2 md:p-6 animate-in fade-in duration-200 flex flex-col">
             <div className="w-full max-w-[1400px] mx-auto flex flex-col h-full">
                <div className="flex justify-between items-center mb-4 px-2">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-foreground">{activeMeeting.subject}</h2>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-primary">● Live</span>
                            <span>{activeMeeting.batch}</span>
                        </div>
                    </div>
                    <Button variant="destructive" onClick={() => setActiveMeeting(null)}>
                        Leave Class
                    </Button>
                </div>
                <div className="flex-1 border rounded-xl overflow-hidden shadow-2xl bg-black relative">
                    <JitsiMeeting
                      roomName={activeMeeting.roomName}
                      displayName={user?.user_metadata?.full_name || user?.user_metadata?.name || 'Student'}
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
