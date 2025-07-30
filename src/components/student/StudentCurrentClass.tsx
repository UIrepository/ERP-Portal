// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentCurrentClass.tsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { format, differenceInSeconds, nextDay } from 'date-fns';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link?: string; // Direct link from schedules table (if exists)
  meeting_link_url?: string; // New field for the link returned by RPC function
}

interface OngoingClass {
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  meeting_link: string; // This will now come from meeting_link_url
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
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
  const now = useMemo(() => new Date(), []); // Memoize current date/time for queries
  const currentDay = now.getDay();
  const currentTimeStr = format(now, 'HH:mm:ss'); // Format to 'HH:mm:ss' for TIME type in Postgres

  // RPC call to get ALL relevant schedules for the user
  const { data: allSchedules, isLoading: isLoadingAllSchedules, isError: isAllSchedulesError } = useQuery<Schedule[]>({
    queryKey: ['allStudentSchedulesRPC', profile?.user_id],
    queryFn: async (): Promise<Schedule[]> => {
      if (!profile?.user_id) return [];
      
      const { data, error } = await supabase.rpc('get_schedules_with_links_filtered_by_enrollment', {
        p_user_id: profile.user_id,
        p_day_of_week: null, // Get all days
        p_current_time: null, // Don't filter by time yet
        p_is_active_link: false // Don't filter by active link yet
      });

      if (error) {
          console.error("Error fetching all schedules via RPC:", error);
          throw error;
      }
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // RPC call to get the ONGOING class
  const { data: ongoingClass, isLoading: isLoadingOngoingClass, isError: isOngoingClassError } = useQuery<OngoingClass | null>({
    queryKey: ['ongoingClassRPC', profile?.user_id, currentDay, currentTimeStr],
    queryFn: async (): Promise<OngoingClass | null> => {
      if (!profile?.user_id) return null;

      const { data, error } = await supabase.rpc('get_schedules_with_links_filtered_by_enrollment', {
        p_user_id: profile.user_id,
        p_day_of_week: currentDay,
        p_current_time: currentTimeStr,
        p_is_active_link: true // Filter for active meeting links
      });

      if (error) {
        console.error("Error fetching ongoing class via RPC:", error);
        throw error;
      }
      if (!data || data.length === 0) return null;

      const schedule = data[0];
      return {
        subject: schedule.subject,
        batch: schedule.batch,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        meeting_link: schedule.meeting_link_url || schedule.link || '' // Use meeting_link_url from RPC, fallback to direct link
      };
    },
    enabled: !!profile?.user_id,
    refetchInterval: 30000,
    retry: 1
  });

  const nextUpcomingClass = useMemo(() => {
    if (!allSchedules || allSchedules.length === 0) return null;

    const now = new Date();
    const futureSchedules = allSchedules.filter(schedule => {
      const [startHour, startMin] = schedule.start_time.split(':').map(Number);
      let occurrence = nextDay(now, schedule.day_of_week);
      occurrence.setHours(startHour, startMin, 0, 0);

      if (format(occurrence, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd') && occurrence <= now) {
        occurrence.setDate(occurrence.getDate() + 7);
      }
      return occurrence > now;
    });

    futureSchedules.sort((a, b) => {
      const getOccurrenceTime = (schedule: Schedule) => {
        const [startHour, startMin] = schedule.start_time.split(':').map(Number);
        let occurrence = nextDay(now, schedule.day_of_week);
        occurrence.setHours(startHour, startMin, 0, 0);
        if (format(occurrence, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd') && occurrence <= now) {
            occurrence.setDate(occurrence.getDate() + 7);
        }
        return occurrence.getTime();
      };
      return getOccurrenceTime(a) - getOccurrenceTime(b);
    });

    return futureSchedules.length > 0 ? {
        ...futureSchedules[0],
        nextOccurrence: (() => {
            const [startHour, startMin] = futureSchedules[0].start_time.split(':').map(Number);
            let occurrence = nextDay(now, futureSchedules[0].day_of_week);
            occurrence.setHours(startHour, startMin, 0, 0);
            if (format(occurrence, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd') && occurrence <= now) {
                occurrence.setDate(occurrence.getDate() + 7);
            }
            return occurrence;
        })()
    } : null;
  }, [allSchedules, now]);


  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isLoadingInitialData = isLoadingAllSchedules || isLoadingOngoingClass;
  const hasErrors = isAllSchedulesError || isOngoingClassError;

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
        <Card className="p-12 text-center rounded-3xl shadow-xl border-2 border-dashed border-gray-300 bg-white transform transition-all duration-500 hover:scale-105">
          <div className="mb-8">
            <AlertTriangle className="h-20 w-20 mx-auto text-red-500 animate-fade-in-up" />
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-4 animate-fade-in-up animation-delay-200">
            {hasErrors ? "Error Loading Schedules" : "No Schedules Found"}
          </h3>
          <p className="text-gray-600 mb-8 max-w-lg mx-auto animate-fade-in-up animation-delay-400">
            {hasErrors 
              ? "There was an issue fetching your class schedules. Please try again later or contact support."
              : "It looks like there are no class schedules associated with your enrollments. Please contact your administrator."
            }
          </p>
          <Button 
            onClick={() => onTabChange('dashboard')}
            size="lg" 
            variant="outline" 
            className="text-primary border-primary hover:bg-primary hover:text-white animate-fade-in-up animation-delay-600"
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
      <div className="max-w-3xl w-full mx-auto text-center">
        
        {ongoingClass ? (
          <Card className="relative p-10 overflow-hidden rounded-3xl shadow-2xl border-none bg-gradient-to-br from-green-500 to-emerald-600 text-white animate-fade-in-up">
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="w-5 h-5 bg-white rounded-full animate-ping"></div>
                <span className="font-extrabold text-2xl drop-shadow-md">LIVE CLASS IN PROGRESS</span>
              </div>
              
              <h3 className="text-5xl font-bold mb-4 tracking-tight drop-shadow-lg">
                {ongoingClass.subject}
              </h3>
              
              <div className="flex items-center justify-center gap-8 mb-8 text-green-100">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <Clock className="h-6 w-6" />
                  <span>
                    {formatTime(ongoingClass.start_time)} - {formatTime(ongoingClass.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <Calendar className="h-6 w-6" />
                  <span>
                    {ongoingClass.batch}
                  </span>
                </div>
              </div>

              {ongoingClass.meeting_link ? (
                <Button 
                  onClick={() => window.open(ongoingClass.meeting_link, '_blank')}
                  className="bg-white text-green-700 hover:bg-gray-100 hover:text-green-800 px-10 py-4 text-xl font-bold rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95"
                  size="lg"
                >
                  <ExternalLink className="h-6 w-6 mr-3" />
                  Join Class Now
                </Button>
              ) : (
                <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 rounded-lg p-5 mt-6 shadow-md">
                  <p className="text-lg font-medium">Meeting link not available for this session.</p>
                  <p className="text-sm mt-2 opacity-90">Please check your schedule or contact support if this persists.</p>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-12 text-center rounded-3xl shadow-xl border-2 border-dashed border-gray-300 bg-white transform transition-all duration-500 hover:scale-105">
            <div className="mb-8">
              <Clock className="h-20 w-20 mx-auto text-gray-400 animate-fade-in-up" />
            </div>
            <h3 className="text-3xl font-bold text-gray-800 mb-4 animate-fade-in-up animation-delay-200">
              No Ongoing Class Right Now
            </h3>
            <p className="text-gray-600 mb-8 max-w-lg mx-auto animate-fade-in-up animation-delay-400">
              Relax and prepare for your next session.
            </p>
            
            {nextUpcomingClass ? (
                <div className="space-y-6">
                    <p className="text-xl font-semibold text-gray-700 animate-fade-in-up animation-delay-500">
                        Your Next Class: <span className="text-primary">{nextUpcomingClass.subject} ({nextUpcomingClass.batch})</span>
                    </p>
                    <p className="text-lg text-gray-600 animate-fade-in-up animation-delay-600">
                        {format(nextUpcomingClass.nextOccurrence, "eeee, MMMM do 'at' h:mm a")}
                    </p>
                    <Countdown targetDate={nextUpcomingClass.nextOccurrence} />
                    {nextUpcomingClass.meeting_link_url && (
                        <Button
                            onClick={() => window.open(nextUpcomingClass.meeting_link_url!, '_blank')}
                            size="lg"
                            className="bg-primary hover:bg-primary/90 text-white mt-6 animate-fade-in-up animation-delay-800"
                        >
                            <ExternalLink className="h-5 w-5 mr-2" />
                            Go to Next Class
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in-up animation-delay-500">
                    <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500" />
                    <p className="text-xl font-semibold text-gray-700">No Upcoming Classes Found</p>
                    <p className="text-gray-600">
                        It looks like there are no scheduled classes for your current enrollments.
                    </p>
                </div>
            )}

            <Button 
              onClick={() => onTabChange('schedule')}
              size="lg" 
              variant="outline" 
              className="text-primary border-primary hover:bg-primary hover:text-white mt-8 animate-fade-in-up animation-delay-1000"
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
