// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentCurrentClass.tsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Clock, Calendar, AlertTriangle } from 'lucide-react'; // Added AlertTriangle for warning
import { format, differenceInSeconds, nextDay, parseISO } from 'date-fns'; // Added parseISO

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link?: string;
}

interface OngoingClass {
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
}

// Define the structure for an enrollment record from the new table
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

interface StudentCurrentClassProps {
    onTabChange: (tab: string) => void;
}

// Countdown Timer Component
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

  // 1. Fetch user's specific enrollments from the new table
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  // 2. Fetch all schedules based on specific enrolled combinations
  const { data: allSchedules, isLoading: isLoadingAllSchedules } = useQuery<Schedule[]>({
    queryKey: ['allStudentSchedules', profile?.user_id, userEnrollments],
    queryFn: async (): Promise<Schedule[]> => {
      if (!profile?.user_id || !userEnrollments || userEnrollments.length === 0) return [];

      let query = supabase.from('schedules').select('*');

      const combinationFilters = userEnrollments
          .map(enrollment => `(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

      if (combinationFilters.length > 0) {
          query = query.or(combinationFilters.join(','));
      } else {
          return [];
      }

      const { data, error } = await query;
      if (error) {
          console.error("Error fetching all schedules:", error);
          return [];
      }
      return data || [];
    },
    enabled: !!profile?.user_id && !!userEnrollments && userEnrollments.length > 0,
  });


  // 3. Find the next upcoming class from all schedules
  const nextUpcomingClass = useMemo(() => {
    if (!allSchedules || allSchedules.length === 0) return null;

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    let upcomingCandidates: (Schedule & { nextOccurrence: Date })[] = [];

    allSchedules.forEach(schedule => {
      const [startHour, startMin] = schedule.start_time.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMin;

      let occurrence = nextDay(now, schedule.day_of_week);
      occurrence.setHours(startHour, startMin, 0, 0);

      // If the class is today and already passed, consider next week's occurrence
      if (schedule.day_of_week === currentDay && startTimeMinutes <= currentTimeMinutes) {
        occurrence.setDate(occurrence.getDate() + 7);
      }
      
      // Filter out past occurrences, or if the occurrence is too far in the future (e.g., more than a week)
      if (occurrence > now) {
         upcomingCandidates.push({ ...schedule, nextOccurrence: occurrence });
      }
    });

    // Sort to find the nearest upcoming class
    upcomingCandidates.sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());

    return upcomingCandidates.length > 0 ? upcomingCandidates[0] : null;
  }, [allSchedules]);


  // 4. Fetch ongoing class (existing logic)
  const { data: ongoingClass, isLoading: isLoadingOngoingClass } = useQuery<OngoingClass | null>({
    queryKey: ['current-ongoing-class', profile?.user_id, userEnrollments],
    queryFn: async (): Promise<OngoingClass | null> => {
      if (!profile?.user_id || !userEnrollments || userEnrollments.length === 0) return null;

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentTime = now.toTimeString().slice(0, 8);

      let query = supabase
        .from('schedules')
        .select(`
          subject,
          batch,
          start_time,
          end_time,
          meeting_links!inner (
            link
          )
        `);

      const combinationFilters = userEnrollments
          .map(enrollment => `(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

      if (combinationFilters.length > 0) {
          query = query.or(combinationFilters.join(','));
      } else {
          return null;
      }

      query = query
        .eq('day_of_week', currentDay)
        .lte('start_time', currentTime)
        .gte('end_time', currentTime)
        .eq('meeting_links.is_active', true)
        .limit(1);

      const { data: scheduleData, error: scheduleError } = await query;

      if (scheduleError) throw scheduleError;

      if (!scheduleData || scheduleData.length === 0) return null;

      const schedule = scheduleData[0];
      return {
        subject: schedule.subject,
        batch: schedule.batch,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        meeting_link: (schedule.meeting_links as any)?.link || ''
      };
    },
    enabled: !!profile?.user_id && !!userEnrollments && userEnrollments.length > 0,
    refetchInterval: 30000
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isLoading = isLoadingEnrollments || isLoadingOngoingClass || isLoadingAllSchedules;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-lg text-gray-600">Loading class status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-white min-h-screen flex items-center justify-center">
      <div className="max-w-3xl w-full mx-auto text-center">
        
        {ongoingClass ? (
          <Card className="relative p-10 overflow-hidden rounded-3xl shadow-2xl border-none bg-gradient-to-br from-green-500 to-emerald-600 text-white animate-fade-in-up">
            {/* Animated background circles */}
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
                    {nextUpcomingClass.link && (
                        <Button
                            onClick={() => window.open(nextUpcomingClass.link!, '_blank')}
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
              onClick={() => onTabChange('schedule')} // Redirect to schedule tab
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
