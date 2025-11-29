import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Clock, Calendar, AlertTriangle, Video } from 'lucide-react';
import { format, differenceInSeconds, startOfDay, isSameDay } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link?: string;
  meeting_link_url?: string;
  date?: string;
}

interface OngoingClass {
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
}

interface StudentCurrentClassProps {
    onTabChange: (tab: string) => void;
}

const Countdown = ({ targetDate }: { targetDate: Date }) => {
  const calculateTimeLeft = () => {
    const totalSeconds = differenceInSeconds(targetDate, new Date());
    if (totalSeconds <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true, isStartingSoon: false };
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const isStartingSoon = days === 0 && hours === 0 && minutes < 15 && totalSeconds > 0;
    return { days, hours, minutes, seconds, isLive: false, isStartingSoon };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.isLive) {
    return <Badge className="bg-green-500 text-white animate-pulse">Live Now!</Badge>;
  }

  return (
    <div className={`flex items-center justify-center gap-2 font-mono text-lg ${timeLeft.isStartingSoon ? 'text-red-500 animate-pulse-fast' : 'text-gray-700'}`}>
      <Clock className="h-5 w-5" />
      <span className="font-semibold">Starts in:</span>
      <span>{String(timeLeft.days).padStart(2, '0')}d</span>
      <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
      <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
      <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
    </div>
  );
};

export const StudentCurrentClass = ({ onTabChange }: StudentCurrentClassProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const now = useMemo(() => new Date(), []);
  const currentDay = now.getDay();
  const currentTimeStr = format(now, 'HH:mm:ss');

  // --- 1. Fetch ALL Schedules (History + Future) ---
  // Note: We do NOT pass p_current_time here, so the backend returns the full day history.
  const { data: allSchedules, isLoading: isLoadingAllSchedules, isError: isAllSchedulesError } = useQuery<Schedule[]>({
    queryKey: ['allStudentSchedulesRPC', profile?.user_id],
    queryFn: async (): Promise<Schedule[]> => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase.rpc('get_schedules_with_links_filtered_by_enrollment', { 
          p_user_id: profile.user_id 
      });
      if (error) {
          console.error("Error fetching all schedules via RPC:", error);
          throw error;
      }
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // --- 2. Fetch Ongoing Classes (Live Now) ---
  const { data: ongoingClasses, isLoading: isLoadingOngoingClass, isError: isOngoingClassError } = useQuery<OngoingClass[] | null>({
    queryKey: ['ongoingClassRPC', profile?.user_id],
    queryFn: async (): Promise<OngoingClass[] | null> => {
      if (!profile?.user_id) return null;
      
      const todayDateStr = format(new Date(), 'yyyy-MM-dd'); 

      const { data, error } = await supabase.rpc('get_schedules_with_links_filtered_by_enrollment', {
        p_user_id: profile.user_id,
        p_day_of_week: new Date().getDay(),
        p_current_time: format(new Date(), 'HH:mm:ss'),
        p_is_active_link: true,
        p_target_date: todayDateStr 
      });

      if (error) {
        console.error("Error fetching ongoing class via RPC:", error);
        throw error;
      }
      
      if (!data || data.length === 0) return null;

      // Map response to our OngoingClass interface
      return data.map((schedule: any) => ({
        subject: schedule.subject,
        batch: schedule.batch,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        meeting_link: schedule.meeting_link_url || schedule.link || ''
      }));
    },
    enabled: !!profile?.user_id,
  });

  // --- Realtime Updates ---
  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel('ongoing-class-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ongoingClassRPC', profile?.user_id] });
          queryClient.invalidateQueries({ queryKey: ['allStudentSchedulesRPC', profile?.user_id] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_links' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ongoingClassRPC', profile?.user_id] });
          queryClient.invalidateQueries({ queryKey: ['allStudentSchedulesRPC', profile?.user_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, profile?.user_id]);

  // --- Derived State: Next Upcoming Class ---
  const nextUpcomingClass = useMemo(() => {
    if (!allSchedules || allSchedules.length === 0) return null;
    const now = new Date();
    const futureSchedules = allSchedules.map(schedule => {
        const [hour, minute] = schedule.start_time.split(':').map(Number);
        let nextOccurrence;

        if (schedule.date) {
            nextOccurrence = new Date(`${schedule.date}T00:00:00`);
        } else {
            const today = startOfDay(now);
            nextOccurrence = new Date(today);
            let dayDifference = schedule.day_of_week - today.getDay();
            
            // Logic to find next instance of this recurring class
            if (dayDifference < 0 || (dayDifference === 0 && (hour * 60 + minute) < (now.getHours() * 60 + now.getMinutes()))) {
                dayDifference += 7;
            }
            nextOccurrence.setDate(today.getDate() + dayDifference);
        }
        nextOccurrence.setHours(hour, minute, 0, 0);
        return { ...schedule, nextOccurrence };
    }).filter(s => s.nextOccurrence >= now)
      .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());

    return futureSchedules.length > 0 ? futureSchedules[0] : null;
  }, [allSchedules]);
  
  // --- Derived State: Today's Schedule List ---
  const todaysOtherClasses = useMemo(() => {
    if (!allSchedules) return [];
    
    return allSchedules.filter(schedule => {
      const isToday = schedule.date 
        ? isSameDay(new Date(schedule.date), now) 
        : schedule.day_of_week === currentDay;
      
      if (!isToday) return false;
      
      // Filter out classes that are currently LIVE so they don't appear twice
      if (ongoingClasses && ongoingClasses.length > 0) {
          const isOngoing = ongoingClasses.some(ongoing => 
              schedule.subject === ongoing.subject &&
              schedule.batch === ongoing.batch &&
              schedule.start_time === ongoing.start_time
          );
          if (isOngoing) return false;
      }

      return true;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [allSchedules, ongoingClasses, now, currentDay]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isLoadingInitialData = isLoadingAllSchedules || isLoadingOngoingClass;
  const hasErrors = isAllSchedulesError || isOngoingClassError;

  // --- Render Helpers ---
  const renderNextUpcoming = () => (
    nextUpcomingClass ? (
        <div className="space-y-6">
            <p className="text-xl font-semibold text-gray-700">
                Your Next Class: <span className="text-primary">{nextUpcomingClass.subject} ({nextUpcomingClass.batch})</span>
            </p>
            <p className="text-lg text-gray-600">
                {format(nextUpcomingClass.nextOccurrence, "eeee, MMMM do 'at' h:mm a")}
            </p>
            <Countdown targetDate={nextUpcomingClass.nextOccurrence} />
            {nextUpcomingClass.meeting_link_url && (
                <Button
                    onClick={() => window.open(nextUpcomingClass.meeting_link_url!, '_blank')}
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-white mt-6"
                >
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Go to Next Class
                </Button>
            )}
        </div>
    ) : (
        todaysOtherClasses.length === 0 && (
        <div className="space-y-4">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500" />
            <p className="text-xl font-semibold text-gray-700">No Upcoming Classes Found</p>
            <p className="text-gray-600">It looks like there are no scheduled classes for your current enrollments.</p>
        </div>
        )
    )
  );

  const renderTodaysSchedule = () => (
    todaysOtherClasses && todaysOtherClasses.length > 0 ? (
        <div className="w-full mt-4 md:mt-12">
            {!isMobile && <h4 className="text-xl font-semibold text-gray-700 mb-4">Today's Schedule</h4>}
            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                {todaysOtherClasses.map(schedule => {
                    const isFinished = currentTimeStr >= schedule.end_time;
                    return (
                        <Card key={schedule.id} className={`p-4 text-left bg-white/80 backdrop-blur-sm ${isFinished ? 'opacity-70' : ''}`}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-gray-800">{schedule.subject}</p>
                                    <p className="text-sm text-gray-500">{schedule.batch}</p>
                                    <p className="text-sm text-gray-500 mt-1">{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</p>
                                </div>
                                {isFinished ? (
                                    <Badge variant="secondary" className="bg-gray-200 text-gray-600">Finished</Badge>
                                ) : (
                                    schedule.meeting_link_url ? (
                                        <Button onClick={() => window.open(schedule.meeting_link_url, '_blank')}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Join Class
                                        </Button>
                                    ) : null
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    ) : (
        !nextUpcomingClass && (
             <div className="space-y-4 pt-4">
                <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500" />
                <p className="text-xl font-semibold text-gray-700">No other classes today</p>
            </div>
        )
    )
  );


  if (isLoadingInitialData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-lg text-gray-600">Loading class status...</p>
        </div>
      </div>
    );
  }

  if (!allSchedules || allSchedules.length === 0 || hasErrors) {
    return (
      <div className="p-6 bg-gradient-to-br from-gray-50 to-white min-h-screen flex items-center justify-center">
        <Card className="p-12 text-center rounded-3xl shadow-xl border-2 border-dashed border-gray-300 bg-white">
          <div className="mb-8">
            <AlertTriangle className="h-20 w-20 mx-auto text-red-500" />
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-4">
            {hasErrors ? "Error Loading Schedules" : "No Schedules Found"}
          </h3>
          <p className="text-gray-600 mb-8 max-w-lg mx-auto">
            {hasErrors 
              ? "There was an issue fetching your class schedules. Please try again later or contact support."
              : "It looks like there are no class schedules associated with your enrollments. Please contact your administrator."
            }
          </p>
          <Button 
            onClick={() => onTabChange('dashboard')}
            size="lg" 
            variant="outline" 
            className="text-primary border-primary hover:bg-primary hover:text-white"
          >
            <Calendar className="h-5 w-5 mr-2" />
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-white min-h-screen flex items-center justify-center">
      <div className="max-w-6xl w-full mx-auto text-center">
        {ongoingClasses && ongoingClasses.length > 0 ? (
          <div className="space-y-8">
            {ongoingClasses.length > 1 && (
                 <div className="mb-4">
                    <h2 className="text-3xl font-bold text-gray-800">Multiple Live Classes</h2>
                    <p className="text-gray-600">You have multiple classes scheduled for this time slot.</p>
                 </div>
            )}
            
            <div className={`grid gap-8 ${ongoingClasses.length === 1 ? 'grid-cols-1 max-w-3xl mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
              {ongoingClasses.map((cls, index) => (
                <Card key={index} className="relative p-10 overflow-hidden rounded-3xl shadow-2xl border-none bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                    <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
                    <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
                    <div className="relative z-10">
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="w-5 h-5 bg-white rounded-full animate-ping"></div>
                        <span className="font-extrabold text-xl md:text-2xl drop-shadow-md">LIVE CLASS</span>
                    </div>
                    <h3 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight drop-shadow-lg">{cls.subject}</h3>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-8 text-green-100">
                        <div className="flex items-center gap-3 text-lg font-semibold">
                        <Clock className="h-6 w-6" />
                        <span>{formatTime(cls.start_time)} - {formatTime(cls.end_time)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-lg font-semibold">
                        <Calendar className="h-6 w-6" />
                        <span>{cls.batch}</span>
                        </div>
                    </div>
                    {cls.meeting_link ? (
                        <Button 
                        onClick={() => window.open(cls.meeting_link, '_blank')}
                        className="bg-white text-green-700 hover:bg-gray-100 hover:text-green-800 px-10 py-4 text-xl font-bold rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 w-full md:w-auto"
                        size="lg"
                        >
                        <ExternalLink className="h-6 w-6 mr-3" />
                        Join Class
                        </Button>
                    ) : (
                        <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 rounded-lg p-5 mt-6 shadow-md">
                        <p className="text-lg font-medium">Meeting link not available.</p>
                        </div>
                    )}
                    </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card className="p-6 md:p-12 text-center rounded-3xl shadow-xl border-2 border-dashed border-gray-300 bg-white max-w-3xl mx-auto">
            <div className="mb-8"><Clock className="h-20 w-20 mx-auto text-gray-400" /></div>
            <h3 className="text-3xl font-bold text-gray-800 mb-4">No Ongoing Class Right Now</h3>
            <p className="text-gray-600 mb-8 max-w-lg mx-auto">Here's a look at what's scheduled for today.</p>

            {isMobile ? (
                <Tabs defaultValue="next-up" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="next-up">Next Up</TabsTrigger>
                        <TabsTrigger value="todays-schedule">Today's Schedule</TabsTrigger>
                    </TabsList>
                    <TabsContent value="next-up" className="pt-6">
                        {renderNextUpcoming()}
                    </TabsContent>
                    <TabsContent value="todays-schedule" className="pt-2">
                        {renderTodaysSchedule()}
                    </TabsContent>
                </Tabs>
            ) : (
                <>
                    {renderNextUpcoming()}
                    {renderTodaysSchedule()}
                </>
            )}

            <Button 
              onClick={() => onTabChange('schedule')}
              size="lg" 
              variant="outline" 
              className="text-primary border-primary hover:bg-primary hover:text-white mt-8"
            >
              <Calendar className="h-5 w-5 mr-2" />
              View Your Full Schedule
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
