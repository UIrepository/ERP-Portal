import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Clock, Calendar, AlertTriangle, Video, CheckCircle2 } from 'lucide-react';
import { format, differenceInSeconds, startOfDay, isSameDay, parse } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// --- Interfaces ---
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

// --- Helper Component: Countdown ---
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
    <div className={`flex items-center gap-2 font-mono text-lg ${timeLeft.isStartingSoon ? 'text-red-500 animate-pulse-fast' : 'text-gray-700'}`}>
      <Clock className="h-5 w-5" />
      <span className="font-semibold">Starts in:</span>
      <div className="flex gap-1">
        {timeLeft.days > 0 && <span>{String(timeLeft.days).padStart(2, '0')}d</span>}
        <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
        <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
        <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
      </div>
    </div>
  );
};

// --- Main Component ---
export const StudentCurrentClass = ({ onTabChange }: StudentCurrentClassProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  // Real-time clock for updates
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentTimeStr = format(now, 'HH:mm:ss');
  const todayDateStr = format(now, 'yyyy-MM-dd'); 

  // --- 1. Fetch All Schedules ---
  const { data: allSchedules, isLoading: isLoadingAllSchedules, isError: isAllSchedulesError } = useQuery<Schedule[]>({
    queryKey: ['allStudentSchedulesRPC', profile?.user_id],
    queryFn: async (): Promise<Schedule[]> => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase.rpc('get_schedules_with_links_filtered_by_enrollment', { 
          p_user_id: profile.user_id 
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // --- 2. Fetch Live Classes ---
  const { data: ongoingClasses, isLoading: isLoadingOngoingClass } = useQuery<OngoingClass[] | null>({
    queryKey: ['ongoingClassRPC', profile?.user_id],
    queryFn: async (): Promise<OngoingClass[] | null> => {
      if (!profile?.user_id) return null;
      const { data, error } = await supabase.rpc('get_schedules_with_links_filtered_by_enrollment', {
        p_user_id: profile.user_id,
        p_day_of_week: new Date().getDay(),
        p_current_time: format(new Date(), 'HH:mm:ss'),
        p_is_active_link: true,
        p_target_date: todayDateStr 
      });
      if (error) throw error;
      if (!data || data.length === 0) return null;
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

  // --- 3. Realtime Subscription ---
  useEffect(() => {
    if (!profile?.user_id) return;
    const channel = supabase.channel('class-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
          queryClient.invalidateQueries({ queryKey: ['ongoingClassRPC'] });
          queryClient.invalidateQueries({ queryKey: ['allStudentSchedulesRPC'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_links' }, () => {
          queryClient.invalidateQueries({ queryKey: ['ongoingClassRPC'] });
          queryClient.invalidateQueries({ queryKey: ['allStudentSchedulesRPC'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, profile?.user_id]);

  // --- 4. Filtering Logic (Past vs Future) ---
  const { pastClasses, futureClasses, nextClass } = useMemo(() => {
    if (!allSchedules) return { pastClasses: [], futureClasses: [], nextClass: null };

    // Filter for TODAY only
    const todaysClasses = allSchedules.filter(schedule => {
        return schedule.date 
            ? isSameDay(new Date(schedule.date), now) 
            : schedule.day_of_week === now.getDay();
    });

    // Helper to check if a class is "Live" right now (to exclude it from Past/Future lists)
    const isLive = (s: Schedule) => {
        if (!ongoingClasses) return false;
        return ongoingClasses.some(o => o.subject === s.subject && o.batch === s.batch && o.start_time === s.start_time);
    };

    const past: Schedule[] = [];
    const future: Schedule[] = [];

    todaysClasses.forEach(schedule => {
        if (isLive(schedule)) return; // Skip if it's currently live

        if (schedule.end_time < currentTimeStr) {
            past.push(schedule);
        } else if (schedule.start_time > currentTimeStr) {
            // Add Date object for sorting/countdown
            const [h, m] = schedule.start_time.split(':').map(Number);
            const dateObj = new Date(now);
            dateObj.setHours(h, m, 0, 0);
            
            future.push({ ...schedule, nextOccurrence: dateObj } as any);
        }
    });

    // Sort
    past.sort((a, b) => b.start_time.localeCompare(a.start_time)); // Most recent past class first
    future.sort((a, b) => a.start_time.localeCompare(b.start_time)); // Soonest future class first

    return {
        pastClasses: past,
        futureClasses: future,
        nextClass: future.length > 0 ? (future[0] as any) : null
    };
  }, [allSchedules, ongoingClasses, now, currentTimeStr]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isLoading = isLoadingAllSchedules || isLoadingOngoingClass;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!allSchedules || allSchedules.length === 0 || isAllSchedulesError) {
    return (
      <div className="p-8 text-center bg-gray-50 min-h-screen flex items-center justify-center">
        <Card className="p-12 text-center rounded-3xl shadow-xl border-dashed">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">No Schedules Found</h3>
            <p className="text-gray-600 mb-6">You don't have any classes scheduled for your enrollments.</p>
            <Button onClick={() => onTabChange('dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  // --- Render Functions ---

  const renderLiveSection = () => (
    ongoingClasses && ongoingClasses.length > 0 && (
      <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
         <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-2xl font-bold text-gray-900">Live Now</h2>
         </div>
         <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {ongoingClasses.map((cls, idx) => (
                <Card key={idx} className="relative overflow-hidden border-none shadow-2xl bg-gradient-to-br from-green-600 to-emerald-700 text-white">
                    <div className="absolute top-0 right-0 p-4 opacity-20"><Video size={100} /></div>
                    <CardContent className="p-6 relative z-10">
                        <Badge className="bg-red-500 hover:bg-red-600 text-white border-none mb-4 animate-pulse">
                            ● LIVE CLASS
                        </Badge>
                        <h3 className="text-3xl font-bold mb-2">{cls.subject}</h3>
                        <p className="text-green-100 mb-6 font-medium">{cls.batch}</p>
                        <div className="flex items-center gap-4 text-sm font-semibold bg-white/10 p-3 rounded-lg mb-6 w-fit">
                            <Clock className="h-4 w-4" />
                            {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                        </div>
                        {cls.meeting_link ? (
                            <Button 
                                onClick={() => window.open(cls.meeting_link, '_blank')}
                                className="w-full bg-white text-green-700 hover:bg-gray-100 font-bold rounded-xl h-12 text-lg shadow-lg"
                            >
                                <ExternalLink className="mr-2 h-5 w-5" /> Join Now
                            </Button>
                        ) : (
                            <div className="text-center p-3 bg-yellow-400/20 rounded-xl text-yellow-100 text-sm">
                                Link unavailable
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
         </div>
      </div>
    )
  );

  const renderFutureSection = () => (
    <div className="mb-10">
        {nextClass ? (
            <>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" /> Up Next
                </h2>
                {/* Main "Up Next" Card */}
                <Card className="border-l-4 border-l-primary shadow-md bg-white mb-6">
                    <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-center md:text-left space-y-2">
                            <Badge variant="outline" className="border-primary text-primary mb-2">
                                Upcoming
                            </Badge>
                            <h3 className="text-3xl font-bold text-gray-800">{nextClass.subject}</h3>
                            <p className="text-gray-500 font-medium">{nextClass.batch}</p>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-gray-600 mt-2">
                                <Clock className="h-4 w-4" />
                                <span>{formatTime(nextClass.start_time)} - {formatTime(nextClass.end_time)}</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center bg-gray-50 p-6 rounded-2xl border border-gray-100 min-w-[200px]">
                            <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider mb-2">Starts In</p>
                            <Countdown targetDate={nextClass.nextOccurrence} />
                        </div>

                        {nextClass.meeting_link_url && (
                             <Button 
                                onClick={() => window.open(nextClass.meeting_link_url, '_blank')}
                                size="lg"
                                className="w-full md:w-auto shadow-lg"
                             >
                                <ExternalLink className="mr-2 h-4 w-4" /> 
                                Open Link
                             </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Other Future Classes List */}
                {futureClasses.length > 1 && (
                    <div className="space-y-3 pl-2 md:pl-4 border-l-2 border-dashed border-gray-200">
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Later Today</p>
                        {futureClasses.slice(1).map(cls => (
                            <div key={cls.id} className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <p className="font-bold text-gray-800">{cls.subject}</p>
                                    <p className="text-xs text-gray-500">{cls.batch}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm text-primary font-medium">{formatTime(cls.start_time)}</p>
                                    <p className="text-xs text-gray-400">{formatTime(cls.end_time)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        ) : (
            // No future classes
            !ongoingClasses && (
                <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed">
                    <div className="bg-green-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800">All Caught Up!</h3>
                    <p className="text-gray-500">No more classes scheduled for today.</p>
                </div>
            )
        )}
    </div>
  );

  const renderPastSection = () => (
    pastClasses.length > 0 && (
        <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-gray-400" /> Completed Today
            </h2>
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3">Subject</th>
                                <th className="px-6 py-3">Batch</th>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pastClasses.map((cls) => (
                                <tr key={cls.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{cls.subject}</td>
                                    <td className="px-6 py-4 text-gray-500">{cls.batch}</td>
                                    <td className="px-6 py-4 font-mono text-gray-600">
                                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-500 hover:bg-gray-200">
                                            Finished
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
  );

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Today's Schedule</h1>
                    <p className="text-gray-500">{format(now, 'EEEE, MMMM do, yyyy')}</p>
                </div>
                <Button variant="outline" onClick={() => onTabChange('schedule')}>
                    <Calendar className="mr-2 h-4 w-4" /> Full Week View
                </Button>
            </div>

            {/* Live Classes (Priority) */}
            {renderLiveSection()}

            {/* Upcoming Classes */}
            {renderFutureSection()}

            {/* Past Classes Table */}
            {renderPastSection()}
        </div>
    </div>
  );
};
