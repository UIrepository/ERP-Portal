import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ExternalLink, Clock, Calendar, Video, Radio, CheckCircle2, ArrowRight } from 'lucide-react';
import { format, differenceInSeconds, isSameDay } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

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
  nextOccurrence?: Date;
}

interface OngoingClass {
  id: string;
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
}

interface StudentCurrentClassProps {
    onTabChange: (tab: string) => void;
}

// --- Helper: Stateless Countdown (Fixes "Not Moving" Issue) ---
const Countdown = ({ targetDate }: { targetDate: Date }) => {
  // We use the current time directly since the parent re-renders this component every second.
  // This prevents the interval cleanup bug that was freezing the timer.
  const now = new Date();
  const totalSeconds = differenceInSeconds(targetDate, now);
  
  if (totalSeconds <= 0) {
      return <Badge className="bg-green-600 text-white animate-pulse">Live Now!</Badge>;
  }

  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const isStartingSoon = hours === 0 && minutes < 15;

  return (
    <div className={`flex items-center gap-3 font-mono text-lg ${isStartingSoon ? 'text-orange-500 animate-pulse' : 'text-slate-700'}`}>
      <div className="flex flex-col items-center bg-white border border-gray-200 px-3 py-1 rounded-md shadow-sm min-w-[60px]">
         <span className="text-xl font-bold">{String(hours).padStart(2, '0')}</span>
         <span className="text-[10px] text-gray-400 uppercase tracking-wider">Hrs</span>
      </div>
      <span className="font-bold text-gray-300 pb-4">:</span>
      <div className="flex flex-col items-center bg-white border border-gray-200 px-3 py-1 rounded-md shadow-sm min-w-[60px]">
         <span className="text-xl font-bold">{String(minutes).padStart(2, '0')}</span>
         <span className="text-[10px] text-gray-400 uppercase tracking-wider">Min</span>
      </div>
      <span className="font-bold text-gray-300 pb-4">:</span>
      <div className="flex flex-col items-center bg-white border border-gray-200 px-3 py-1 rounded-md shadow-sm min-w-[60px]">
         <span className="text-xl font-bold text-indigo-600">{String(seconds).padStart(2, '0')}</span>
         <span className="text-[10px] text-gray-400 uppercase tracking-wider">Sec</span>
      </div>
    </div>
  );
};

export const StudentCurrentClass = ({ onTabChange }: StudentCurrentClassProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  // Real-time clock: This drives the whole page updates every second
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentTimeStr = format(now, 'HH:mm:ss');
  const todayDateStr = format(now, 'yyyy-MM-dd');

  // --- 1. Fetch ALL Schedules ---
  const { data: allSchedules, isLoading: isLoadingAllSchedules, isError: isAllSchedulesError } = useQuery<Schedule[]>({
    queryKey: ['allStudentSchedulesRPC', profile?.user_id, todayDateStr],
    queryFn: async (): Promise<Schedule[]> => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase.rpc('get_schedules_with_links_filtered_by_enrollment', { 
          p_user_id: profile.user_id,
          p_target_date: todayDateStr 
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // --- 2. Fetch LIVE Classes ---
  const { data: ongoingClasses, isLoading: isLoadingOngoingClass } = useQuery<OngoingClass[] | null>({
    queryKey: ['ongoingClassRPC', profile?.user_id, todayDateStr],
    queryFn: async (): Promise<OngoingClass[] | null> => {
      if (!profile?.user_id) return null;
      const { data, error } = await supabase.rpc('get_schedules_with_links_filtered_by_enrollment', {
        p_user_id: profile.user_id,
        p_target_date: todayDateStr, 
        p_current_time: format(new Date(), 'HH:mm:ss'),
        p_is_active_link: true
      });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const nowTime = new Date();
      const bufferMinutes = 15; 
      
      // Strict Time Window Check
      const validClasses = data.filter((schedule: any) => {
          const [h, m] = schedule.start_time.split(':');
          const startTime = new Date(nowTime);
          startTime.setHours(Number(h), Number(m), 0, 0);
          const validJoinTime = new Date(startTime.getTime() - bufferMinutes * 60000);
          return nowTime >= validJoinTime; 
      });

      // Strict Deduplication (Subject + Start Time)
      const uniqueMap = new Map();
      validClasses.forEach((cls: any) => {
          const key = `${cls.subject}-${cls.start_time}`;
          if (!uniqueMap.has(key)) {
              uniqueMap.set(key, cls);
          }
      });

      return Array.from(uniqueMap.values()).map((schedule: any) => ({
        id: schedule.id,
        subject: schedule.subject,
        batch: schedule.batch,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        meeting_link: schedule.meeting_link_url || schedule.link || ''
      }));
    },
    enabled: !!profile?.user_id,
    refetchInterval: 30000 
  });

  // --- Realtime Sync ---
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

  // --- Logic for Sections ---
  const { pastClasses, futureClasses, nextClass } = useMemo(() => {
    if (!allSchedules) return { pastClasses: [], futureClasses: [], nextClass: null };

    // Deduplicate Full List
    const uniqueSchedules = new Map();
    allSchedules.forEach(s => {
       const key = `${s.subject}-${s.start_time}`;
       if (!uniqueSchedules.has(key)) uniqueSchedules.set(key, s);
    });
    const todaysClasses = Array.from(uniqueSchedules.values());

    const isLive = (s: Schedule) => {
        if (!ongoingClasses) return false;
        return ongoingClasses.some(o => o.subject === s.subject && o.start_time === s.start_time);
    };

    const past: Schedule[] = [];
    const future: Schedule[] = [];

    todaysClasses.forEach(schedule => {
        if (isLive(schedule)) return; 

        if (schedule.end_time < currentTimeStr) {
            past.push(schedule);
        } else if (schedule.start_time > currentTimeStr) {
            const [h, m] = schedule.start_time.split(':').map(Number);
            const dateObj = new Date(now);
            dateObj.setHours(h, m, 0, 0);
            future.push({ ...schedule, nextOccurrence: dateObj } as any);
        }
    });

    past.sort((a, b) => b.start_time.localeCompare(a.start_time));
    future.sort((a, b) => a.start_time.localeCompare(b.start_time));

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

  if (isLoadingAllSchedules || isLoadingOngoingClass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // --- UI RENDER FUNCTIONS ---

  const renderLiveSection = () => (
    ongoingClasses && ongoingClasses.length > 0 && (
      <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
         <div className="flex items-center gap-3 mb-5">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-600"></span>
            </span>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Happening Now</h2>
         </div>
         <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {ongoingClasses.map((cls, idx) => (
                <Card key={idx} className="relative overflow-hidden border-none shadow-2xl bg-gradient-to-br from-green-600 to-emerald-800 text-white transform hover:scale-[1.02] transition-all duration-300 group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 transition-transform group-hover:scale-110"><Video size={140} /></div>
                    <CardContent className="p-8 relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <Badge className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-sm px-3 py-1 flex items-center gap-2">
                                    <Radio className="h-3 w-3 animate-pulse text-red-300" /> LIVE
                                </Badge>
                                <span className="text-green-50 text-xs font-bold tracking-wider uppercase bg-black/20 px-3 py-1 rounded-full">
                                    {cls.batch}
                                </span>
                            </div>
                            
                            <h3 className="text-3xl font-extrabold mb-1 tracking-tight">{cls.subject}</h3>
                            <p className="text-green-100 text-sm mb-6 opacity-90 font-medium">Instructor is live</p>
                            
                            <div className="flex items-center gap-3 text-sm font-bold bg-black/20 backdrop-blur-md p-4 rounded-xl mb-6 border border-white/10">
                                <Clock className="h-5 w-5 text-green-300" />
                                <span>{formatTime(cls.start_time)} - {formatTime(cls.end_time)}</span>
                            </div>
                        </div>

                        {cls.meeting_link ? (
                            <Button 
                                onClick={() => window.open(cls.meeting_link, '_blank')}
                                className="w-full bg-white text-emerald-900 hover:bg-green-50 font-bold rounded-xl h-14 text-lg shadow-xl hover:shadow-2xl transition-all active:scale-95"
                            >
                                <ExternalLink className="mr-2 h-5 w-5" /> Join Class Now
                            </Button>
                        ) : (
                            <div className="text-center p-4 bg-yellow-500/20 border border-yellow-200/30 rounded-xl text-yellow-50 text-sm font-medium">
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
    <div className="mb-12">
        {nextClass ? (
            <>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-indigo-600" /> Upcoming Classes
                </h2>
                
                {/* UP NEXT CARD */}
                <div className="bg-gradient-to-br from-indigo-50 to-white border-l-4 border-l-indigo-600 shadow-md rounded-r-xl rounded-l-none mb-8 p-1">
                    <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="text-center md:text-left space-y-3 flex-1">
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 mb-2 border border-indigo-200">
                                UP NEXT
                            </div>
                            <h3 className="text-4xl font-bold text-gray-800 tracking-tight">{nextClass.subject}</h3>
                            <p className="text-gray-500 font-medium text-lg flex items-center justify-center md:justify-start gap-2">
                                <span className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-600">{nextClass.batch}</span>
                            </p>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-600 font-semibold mt-2">
                                <Clock className="h-5 w-5" />
                                <span>{formatTime(nextClass.start_time)} - {formatTime(nextClass.end_time)}</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm min-w-[240px]">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3">Starts In</p>
                            <Countdown targetDate={nextClass.nextOccurrence} />
                        </div>

                        {nextClass.meeting_link_url && (
                             <Button 
                                onClick={() => window.open(nextClass.meeting_link_url, '_blank')}
                                size="lg"
                                className="w-full md:w-auto shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 h-12"
                             >
                                Open Class Link <ArrowRight className="ml-2 h-4 w-4" /> 
                             </Button>
                        )}
                    </CardContent>
                </div>

                {/* LATER TODAY LIST */}
                {futureClasses.length > 1 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="h-px bg-gray-200 flex-1"></div>
                            <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Later Today</span>
                            <div className="h-px bg-gray-200 flex-1"></div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {futureClasses.slice(1).map(cls => (
                                <div key={cls.id} className="group bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">{cls.subject}</div>
                                        <Badge variant="outline" className="text-gray-500 border-gray-200 bg-gray-50">{cls.batch}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-3">
                                        <Clock className="h-4 w-4 text-indigo-400" />
                                        <span className="font-mono text-gray-700">{formatTime(cls.start_time)}</span>
                                        <span className="text-gray-300">|</span>
                                        <span className="text-gray-400">{formatTime(cls.end_time)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
        ) : (
            !ongoingClasses && (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-300 mx-auto max-w-2xl">
                    <div className="bg-indigo-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-10 w-10 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">All Caught Up!</h3>
                    <p className="text-gray-500">You have no more classes scheduled for the rest of the day.</p>
                </div>
            )
        )}
    </div>
  );

  const renderPastSection = () => (
    pastClasses.length > 0 && (
        <div className="mt-16">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-gray-100 p-2 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-gray-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Completed Classes</h2>
            </div>
            
            <Card className="border border-gray-200 shadow-sm overflow-hidden rounded-xl">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[40%] text-gray-600 font-semibold pl-6">Subject</TableHead>
                            <TableHead className="text-gray-600 font-semibold">Batch</TableHead>
                            <TableHead className="text-gray-600 font-semibold">Timing</TableHead>
                            <TableHead className="text-right text-gray-600 font-semibold pr-6">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pastClasses.map((cls) => (
                            <TableRow key={cls.id} className="hover:bg-gray-50 transition-colors group">
                                <TableCell className="font-medium text-gray-900 pl-6 py-4">
                                    {cls.subject}
                                </TableCell>
                                <TableCell className="text-gray-500">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-medium border border-gray-200">
                                        {cls.batch}
                                    </span>
                                </TableCell>
                                <TableCell className="text-gray-500 font-mono text-sm">
                                    {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Finished
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
  );

  return (
    <div className="p-4 md:p-8 bg-gray-50/30 min-h-screen">
        <div className="max-w-6xl mx-auto">
            {/* Header Section */}
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 pb-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Today's Schedule</h1>
                    <div className="flex items-center text-gray-500 font-medium">
                        <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                        {format(now, 'EEEE, MMMM do, yyyy')}
                    </div>
                </div>
                <Button variant="outline" onClick={() => onTabChange('schedule')} className="hover:bg-white hover:text-indigo-600 transition-colors">
                    View Full Schedule <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>

            {renderLiveSection()}
            {renderFutureSection()}
            {renderPastSection()}
        </div>
    </div>
  );
};
