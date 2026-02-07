import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Clock, Video } from 'lucide-react';
import { format, getDay, startOfWeek, addDays, isSameDay, subDays, parse, isWithinInterval } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link?: string;
  date?: string; 
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Updated palette for thin left-border accents
const subjectBorderColors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-lime-500',
    'bg-teal-500',
    'bg-fuchsia-500',
];

const ScheduleSkeleton = () => (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] min-w-[800px]">
             <div className="h-14 bg-gray-50 border-b border-r border-gray-200" />
             {[...Array(7)].map((_, i) => (
                 <div key={i} className="h-14 border-b border-r border-gray-200 bg-gray-50 p-4">
                     <Skeleton className="h-4 w-8 mx-auto" />
                 </div>
             ))}
             {[...Array(5)].map((_, r) => (
                 <>
                    <div key={`time-${r}`} className="h-32 border-b border-r border-gray-200 p-4">
                        <Skeleton className="h-4 w-12 ml-auto" />
                    </div>
                    {[...Array(7)].map((_, c) => (
                        <div key={`cell-${r}-${c}`} className="h-32 border-b border-r border-gray-200 p-2">
                             {Math.random() > 0.7 && <Skeleton className="h-20 w-full rounded-md" />}
                        </div>
                    ))}
                 </>
             ))}
        </div>
    </div>
);

export const StudentSchedule = () => {
  const { profile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [displayDate, setDisplayDate] = useState(new Date());

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); 
    return () => clearInterval(timer);
  }, []);

  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) return [];
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  useEffect(() => {
    if (selectedBatchFilter !== 'all' && !availableBatches.includes(selectedBatchFilter)) {
        setSelectedBatchFilter('all');
    }
  }, [selectedBatchFilter, availableBatches]);

  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['student-schedule-direct', userEnrollments, selectedBatchFilter],
    queryFn: async (): Promise<Schedule[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];
        let query = supabase.from('schedules').select('*');
        const batchesToFilter = selectedBatchFilter === 'all'
            ? Array.from(new Set(userEnrollments.map(e => e.batch_name)))
            : [selectedBatchFilter];
        if (batchesToFilter.length === 0) return [];
        query = query.in('batch', batchesToFilter);
        query = query.order('date', { nullsFirst: false }).order('day_of_week').order('start_time');
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  const isLoading = isLoadingEnrollments || isLoadingSchedules;

  const weekDates = useMemo(() => {
    const start = startOfWeek(displayDate, { weekStartsOn: 1 }); // Start on Monday
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [displayDate]);

  const timeSlots = useMemo(() => {
    if (!schedules) return [];
    const slots = new Set<string>();
    schedules.forEach(s => slots.add(s.start_time));

    const visibleSlots = Array.from(slots).filter(time => {
        return weekDates.some(date => {
            const dayIndex = getDay(date);
            const hasRecurringClass = schedules.some(s =>
                !s.date && s.start_time === time && s.day_of_week === dayIndex
            );
            const hasDateSpecificClass = schedules.some(s =>
                s.date && s.start_time === time && isSameDay(new Date(s.date), date)
            );
            return hasRecurringClass || hasDateSpecificClass;
        });
    });

    return visibleSlots.sort();
  }, [schedules, weekDates]);

  const subjectColorMap = useMemo(() => {
    if (!schedules) return new Map();
    const uniqueSubjects = Array.from(new Set(schedules.map(s => s.subject))).sort();
    const colorMap = new Map<string, string>();
    uniqueSubjects.forEach((subject, index) => {
        colorMap.set(subject, subjectBorderColors[index % subjectBorderColors.length]);
    });
    return colorMap;
  }, [schedules]);

  const getSubjectBorderColor = (subject: string) => {
    return subjectColorMap.get(subject) || 'bg-gray-400';
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isClassLive = (schedule: Schedule, classDate: Date) => {
    // Basic date check first
    if (!isSameDay(classDate, currentTime)) return false;

    // Time parsing
    const [startH, startM] = schedule.start_time.split(':').map(Number);
    const [endH, endM] = schedule.end_time.split(':').map(Number);
    
    const startTime = new Date(currentTime);
    startTime.setHours(startH, startM, 0);
    
    const endTime = new Date(currentTime);
    endTime.setHours(endH, endM, 0);

    return isWithinInterval(currentTime, { start: startTime, end: endTime });
  };

  const handlePreviousWeek = () => setDisplayDate(subDays(displayDate, 7));
  const handleNextWeek = () => setDisplayDate(addDays(displayDate, 7));

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen font-sans text-slate-900 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Class Schedule</h1>
          <p className="text-sm text-slate-500 font-medium">{format(displayDate, 'MMMM yyyy')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-gray-50/80 p-1.5 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
          {/* Batch Filter */}
          <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
            <SelectTrigger className="h-8 w-[180px] border-none bg-transparent shadow-none focus:ring-0 text-xs font-semibold text-slate-700">
              <SelectValue placeholder="All Batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {availableBatches.map((batch) => (
                <SelectItem key={batch} value={batch}>{batch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="h-5 w-px bg-gray-300 mx-1 hidden sm:block"></div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-white" onClick={handlePreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-semibold text-slate-700 min-w-[100px] text-center tabular-nums">
                  {format(weekDates[0], 'd MMM')} — {format(weekDates[6], 'd MMM')}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-white" onClick={handleNextWeek}>
                  <ChevronRight className="h-4 w-4" />
              </Button>
          </div>

          <div className="h-5 w-px bg-gray-300 mx-1 hidden sm:block"></div>

          {/* Real-time Timer */}
          <div className="px-2 flex items-center gap-2 text-slate-600 bg-white border border-gray-200 rounded-md h-7 shadow-sm">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-mono font-medium tabular-nums tracking-wide">
                {format(currentTime, 'HH:mm:ss')}
            </span>
          </div>
        </div>
      </header>

      {/* CALENDAR GRID */}
      {isLoading ? <ScheduleSkeleton /> : (
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto relative">
          <div className="grid min-w-[900px] grid-cols-[80px_repeat(7,1fr)] bg-slate-50">
            
            {/* Header Row */}
            <div className="p-4 border-b border-r border-gray-200 bg-gray-50/50 sticky left-0 z-20"></div>
            {weekDates.map((date, index) => {
                const isToday = isSameDay(date, currentTime);
                return (
                    <div key={index} className={cn(
                        "p-3 text-center border-b border-r border-gray-200 last:border-r-0 transition-colors",
                        isToday ? "bg-white" : "bg-gray-50/50"
                    )}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{format(date, 'EEE')}</div>
                        <div className={cn(
                            "text-lg font-medium",
                            isToday ? "text-indigo-600" : "text-slate-700"
                        )}>{format(date, 'dd')}</div>
                    </div>
                );
            })}

            {/* Time Slots Rows */}
            {timeSlots.map((time, timeIndex) => (
                <>
                    {/* Time Label */}
                    <div key={`time-${time}`} className="sticky left-0 z-10 bg-white p-3 text-right text-[11px] font-medium text-slate-400 border-r border-b border-gray-200 flex flex-col justify-start pt-6">
                        {formatTime(time)}
                    </div>

                    {/* Day Cells for this Time Slot */}
                    {weekDates.map((date, dayIndex) => {
                        const dayNum = getDay(date);
                        
                        // Filter classes for this specific cell (Date + Time)
                        const cellClasses = schedules?.filter(s => {
                            const isTimeMatch = s.start_time === time;
                            const isRecurring = !s.date && s.day_of_week === dayNum;
                            const isDateSpecific = s.date && isSameDay(new Date(s.date), date);
                            return isTimeMatch && (isRecurring || isDateSpecific);
                        }) || [];

                        return (
                            <div key={`cell-${dayIndex}-${timeIndex}`} className="p-2 border-r border-b border-gray-200 last:border-r-0 bg-white min-h-[140px] hover:bg-slate-50/30 transition-colors relative">
                                {cellClasses.map(classInfo => {
                                    const isLive = isClassLive(classInfo, date);
                                    
                                    return (
                                        <div 
                                          key={classInfo.id} 
                                          className={cn(
                                            "relative bg-white border rounded-md p-3 mb-2 shadow-sm transition-all group overflow-hidden",
                                            isLive ? "border-indigo-200 shadow-md ring-1 ring-indigo-50" : "border-gray-200 hover:border-gray-300"
                                          )}
                                        >
                                            {/* Accent Left Border */}
                                            <div className={cn("absolute left-0 top-3 bottom-3 w-[3px] rounded-r-sm", getSubjectBorderColor(classInfo.subject))} />

                                            <div className="pl-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="text-xs font-semibold text-slate-900 truncate pr-2 flex items-center">
                                                        {isLive && (
                                                            <span className="relative flex h-2 w-2 mr-2">
                                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                            </span>
                                                        )}
                                                        {classInfo.subject}
                                                    </h3>
                                                </div>
                                                
                                                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
                                                    <span>{classInfo.batch}</span>
                                                    {/* Updated End Time Block */}
                                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-[2px] text-[9px] font-medium text-slate-600">
                                                        Upto {formatTime(classInfo.end_time)}
                                                    </span>
                                                </div>

                                                {/* Live Join Button */}
                                                {classInfo.link && (
                                                    <Button 
                                                        size="sm" 
                                                        variant={isLive ? "default" : "outline"}
                                                        className={cn(
                                                            "w-full h-7 text-[10px] font-medium",
                                                            isLive ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-slate-600 border-slate-200 hover:bg-slate-50"
                                                        )}
                                                        asChild
                                                    >
                                                        <a href={classInfo.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5">
                                                            {isLive ? <Video className="h-3 w-3" /> : null}
                                                            {isLive ? "Join Live" : "Join Class"}
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </>
            ))}
            
            {/* Empty State if no schedules */}
            {timeSlots.length === 0 && (
                <div className="col-span-8 py-16 flex flex-col items-center justify-center text-slate-400">
                    <p className="text-sm">No classes scheduled for this week.</p>
                </div>
            )}
          </div>
      </div>
      )}
    </div>
  );
};
