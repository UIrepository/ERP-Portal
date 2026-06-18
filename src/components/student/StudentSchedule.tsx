import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

// Drop-in icon wrappers (premium Hugeicons, keeping the existing call sites)
const mkIcon = (icon: typeof ArrowLeft01Icon) =>
  ({ className }: { className?: string }) => <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} />;
const ChevronLeft = mkIcon(ArrowLeft01Icon);
const ChevronRight = mkIcon(ArrowRight01Icon);
import { format, getDay, startOfWeek, addDays, isSameDay, subDays } from 'date-fns';
import { istTodayStr, istMinutesNow, timeToMinutes } from '@/lib/timezone';
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
    <div className="border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] min-w-[800px]">
             <div className="h-14 bg-gray-50 border-b border-r border-slate-100" />
             {[...Array(7)].map((_, i) => (
                 <div key={i} className="h-14 border-b border-r border-slate-100 bg-gray-50 p-4">
                     <Skeleton className="h-4 w-8 mx-auto" />
                 </div>
             ))}
             {[...Array(5)].map((_, r) => (
                 <div key={`row-${r}`} className="contents">
                    <div className="h-32 border-b border-r border-slate-100 p-4">
                        <Skeleton className="h-4 w-12 ml-auto" />
                    </div>
                    {[...Array(7)].map((_, c) => (
                        <div key={`cell-${r}-${c}`} className="h-32 border-b border-r border-slate-100 p-2">
                             {Math.random() > 0.7 && <Skeleton className="h-20 w-full rounded-md" />}
                        </div>
                    ))}
                 </div>
             ))}
        </div>
    </div>
);

export const StudentSchedule = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [displayDate, setDisplayDate] = useState(new Date());
  
  // Initialize state from localStorage (or empty string if none exists)
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>(() => {
    return localStorage.getItem('ui_ssp_schedule_batch') || '';
  });

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); 
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch student's enrollments, ordered by newest first
  const { data: enrollments, isLoading: isEnrollmentsLoading } = useQuery({
    queryKey: ['student-enrollments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }); // Latest enrollments bubble to the top
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Extract unique batches (preserves the "newest first" order from the DB query)
  const studentBatches = useMemo(() => {
    if (!enrollments) return [];
    return Array.from(new Set(enrollments.map(e => e.batch_name))).filter(Boolean);
  }, [enrollments]);

  // Set default batch logic
  useEffect(() => {
    if (studentBatches.length > 0) {
      if (selectedBatchFilter === '') {
        // First load ever: Default to the most recent batch
        const latestBatch = studentBatches[0];
        setSelectedBatchFilter(latestBatch);
        localStorage.setItem('ui_ssp_schedule_batch', latestBatch);
      } else if (selectedBatchFilter !== 'all' && !studentBatches.includes(selectedBatchFilter)) {
        // Edge case: They have a saved batch in localStorage, but they were un-enrolled from it. Revert to latest.
        const latestBatch = studentBatches[0];
        setSelectedBatchFilter(latestBatch);
        localStorage.setItem('ui_ssp_schedule_batch', latestBatch);
      }
    }
  }, [studentBatches, selectedBatchFilter]);

  // Handle dropdown changes and persist to localStorage
  const handleBatchChange = (value: string) => {
    setSelectedBatchFilter(value);
    localStorage.setItem('ui_ssp_schedule_batch', value);
  };

  // 2. Fetch schedules based on selected filter OR all enrolled batches
  const { data: schedules, isLoading: isSchedulesLoading } = useQuery<Schedule[]>({
    queryKey: ['student-schedule', studentBatches, selectedBatchFilter],
    queryFn: async (): Promise<Schedule[]> => {
      if (studentBatches.length === 0) return [];

      let query = supabase.from('schedules').select('*');

      if (selectedBatchFilter !== 'all' && selectedBatchFilter !== '') {
        query = query.eq('batch', selectedBatchFilter);
      } else {
        query = query.in('batch', studentBatches);
      }

      const { data, error } = await query
        .order('date', { nullsFirst: false })
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      return data || [];
    },
    // Don't fire the query until the default selection logic has set a valid state
    enabled: studentBatches.length > 0 && selectedBatchFilter !== '', 
  });

  const isLoading = isEnrollmentsLoading || isSchedulesLoading;

  const weekDates = useMemo(() => {
    const start = startOfWeek(displayDate, { weekStartsOn: 1 });
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

  // Per-day class list for the mobile agenda view (no horizontal scrolling).
  const weekAgenda = useMemo(() => {
    return weekDates.map((date) => {
      const dayNum = getDay(date);
      const dayClasses = (schedules || [])
        .filter((s) => {
          const isRecurring = !s.date && s.day_of_week === dayNum;
          const isDateSpecific = s.date && isSameDay(new Date(s.date), date);
          return isRecurring || isDateSpecific;
        })
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      return { date, dayClasses };
    });
  }, [weekDates, schedules]);

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
    // "Live" only in the column that represents IST today; compare IST minutes.
    if (format(classDate, 'yyyy-MM-dd') !== istTodayStr()) return false;
    const startMin = timeToMinutes(schedule.start_time);
    const endMin = timeToMinutes(schedule.end_time);
    const nowMin = istMinutesNow();
    return nowMin >= startMin && nowMin <= endMin;
  };

  const handlePreviousWeek = () => setDisplayDate(subDays(displayDate, 7));
  const handleNextWeek = () => setDisplayDate(addDays(displayDate, 7));

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen font-sans text-slate-900 max-w-[1840px] mx-auto">
      
      {/* TOOLBAR */}
      <header className="mb-6">

        {/* ── Mobile toolbar: batch on its own row, then week-scroller + timer ── */}
        <div className="flex flex-col gap-2.5 md:hidden">
          {/* Row 1 — batch picker, full width */}
          {studentBatches.length > 0 && selectedBatchFilter && (
            <Select value={selectedBatchFilter} onValueChange={handleBatchChange}>
              <SelectTrigger className="h-auto min-h-[44px] w-full rounded-lg border border-slate-200 bg-gray-50/80 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm focus:ring-0 [&>span]:flex-1 [&>span]:min-w-0 [&>span]:line-clamp-2 [&>span]:whitespace-normal [&>span]:text-left [&>span]:leading-snug">
                <SelectValue placeholder="All My Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All My Batches</SelectItem>
                {studentBatches.map((batch) => (
                  <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Row 2 — week scroller (grows) + live timer beside it */}
          <div className="flex items-stretch gap-2">
            <div className="flex flex-1 items-center justify-between rounded-lg border border-slate-200 bg-gray-50/80 px-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-slate-900 hover:bg-white" onClick={handlePreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[13px] font-semibold text-slate-700 tabular-nums">
                {format(weekDates[0], 'd MMM')} — {format(weekDates[6], 'd MMM')}
              </span>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-slate-900 hover:bg-white" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3.5 text-white shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              <span className="text-[13px] font-semibold tabular-nums tracking-wider">
                {format(currentTime, 'h:mm:ss a')}
              </span>
            </div>
          </div>
        </div>

        {/* ── Desktop toolbar (single right-aligned compact bar) ── */}
        <div className="hidden md:flex md:justify-end">
          <div className="flex flex-wrap items-center gap-3 bg-gray-50/80 p-1.5 rounded-lg border border-slate-100 shadow-sm w-auto">
            {/* Dynamic Dropdown showing ONLY enrolled batches */}
            {studentBatches.length > 0 && selectedBatchFilter && (
              <Select value={selectedBatchFilter} onValueChange={handleBatchChange}>
                <SelectTrigger className="h-8 w-[180px] border-none bg-transparent shadow-none focus:ring-0 text-xs font-semibold text-slate-700">
                  <SelectValue placeholder="All My Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All My Batches</SelectItem>
                  {studentBatches.map((batch) => (
                    <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {studentBatches.length > 0 && <div className="h-5 w-px bg-gray-300 mx-1"></div>}

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

            <div className="h-5 w-px bg-gray-300 mx-1"></div>

            {/* Real-time Timer - premium dark pill with a live pulse dot, Inter tabular */}
            <div className="px-3 flex items-center gap-2 bg-slate-900 text-white rounded-md h-7 shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              <span className="text-xs font-semibold tabular-nums tracking-wider">
                  {format(currentTime, 'h:mm:ss a')}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* CALENDAR */}
      {isLoading ? <ScheduleSkeleton /> : (
      <>
      {/* ───────── Desktop: full 7-day grid ───────── */}
      <div className="hidden md:block border border-slate-100 rounded-md overflow-hidden bg-white shadow-sm overflow-x-auto relative">
          <div className="grid min-w-[900px] grid-cols-[80px_repeat(7,1fr)] bg-white">
            
            {/* Header Row */}
            <div className="p-4 border-b border-r border-slate-100 bg-gray-50/50 sticky left-0 z-20"></div>
            {weekDates.map((date, index) => {
                const isToday = format(date, 'yyyy-MM-dd') === istTodayStr();
                return (
                    <div key={index} className={cn(
                        "p-3 text-center border-b border-r border-slate-100 last:border-r-0 transition-colors",
                        isToday ? "bg-indigo-50/40" : "bg-white"
                    )}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{format(date, 'EEE')}</div>
                        <div className={cn(
                            "text-base font-semibold inline-flex items-center justify-center h-8 w-8 mx-auto rounded-full",
                            isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                        )}>{format(date, 'dd')}</div>
                    </div>
                );
            })}

            {/* Time Slots Rows */}
            {timeSlots.map((time, timeIndex) => (
                <div key={`row-${time}`} className="contents">
                    {/* Time Label */}
                    <div className="sticky left-0 z-10 bg-white px-2 text-center border-r border-b border-slate-100 flex flex-col items-center justify-start pt-6 tabular-nums">
                        <span className="text-[13px] font-semibold text-slate-700 leading-none">{formatTime(time).replace(/ [AP]M$/, '')}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{formatTime(time).slice(-2)}</span>
                    </div>

                    {/* Day Cells for this Time Slot */}
                    {weekDates.map((date, dayIndex) => {
                        const dayNum = getDay(date);
                        
                        const cellClasses = schedules?.filter(s => {
                            const isTimeMatch = s.start_time === time;
                            const isRecurring = !s.date && s.day_of_week === dayNum;
                            const isDateSpecific = s.date && isSameDay(new Date(s.date), date);
                            return isTimeMatch && (isRecurring || isDateSpecific);
                        }) || [];

                        return (
                            <div key={`cell-${dayIndex}-${timeIndex}`} className={cn(
                              "p-2 border-r border-b border-slate-100 last:border-r-0 min-h-[120px] hover:bg-slate-50/40 transition-colors relative",
                              format(date, 'yyyy-MM-dd') === istTodayStr() ? "bg-indigo-50/20" : "bg-white"
                            )}>
                                {cellClasses.map(classInfo => {
                                    const isLive = isClassLive(classInfo, date);
                                    
                                    return (
                                        <div 
                                          key={classInfo.id} 
                                          className={cn(
                                            "relative bg-white border rounded-md p-3 mb-2 shadow-sm transition-all group overflow-hidden",
                                            isLive ? "border-indigo-200 shadow-md ring-1 ring-indigo-50" : "border-slate-100 hover:border-gray-300"
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
                                                
                                                <div className="text-[10px] font-medium text-slate-600 mb-1 tabular-nums whitespace-nowrap">
                                                    {formatTime(classInfo.start_time)} – {formatTime(classInfo.end_time)}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate">{classInfo.batch}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            ))}
            
            {/* Empty States */}
            {studentBatches.length === 0 ? (
                 <div className="col-span-8 py-16 flex flex-col items-center justify-center text-slate-400">
                    <p className="text-sm">You are not currently enrolled in any batches. Please contact administration.</p>
                </div>
            ) : timeSlots.length === 0 ? (
                <div className="col-span-8 py-16 flex flex-col items-center justify-center text-slate-400">
                    <p className="text-sm">No classes scheduled for this filter/week.</p>
                </div>
            ) : null}
          </div>
      </div>

      {/* ───────── Mobile: vertical agenda (no horizontal scroll) ───────── */}
      <div className="md:hidden">
        {studentBatches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-16 px-6 text-center text-sm text-slate-400">
            You are not currently enrolled in any batches. Please contact administration.
          </div>
        ) : weekAgenda.every((d) => d.dayClasses.length === 0) ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-16 px-6 text-center text-sm text-slate-400">
            No classes scheduled for this week.
          </div>
        ) : (
          <div className="space-y-5">
            {weekAgenda
              .filter((d) => d.dayClasses.length > 0)
              .map(({ date, dayClasses }) => {
                const isToday = format(date, 'yyyy-MM-dd') === istTodayStr();
                return (
                  <section key={date.toISOString()}>
                    {/* Day header */}
                    <div className="mb-2.5 flex items-center gap-2.5">
                      <div className={cn(
                        "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
                        isToday ? "bg-brand text-white" : "bg-slate-100 text-slate-700"
                      )}>
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{format(date, 'EEE')}</span>
                        <span className="text-base font-bold tabular-nums">{format(date, 'dd')}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{format(date, 'EEEE')}</div>
                        <div className="text-xs text-slate-400">{format(date, 'd MMMM')}{isToday && ' · Today'}</div>
                      </div>
                      <div className="ml-auto text-[11px] font-medium text-slate-400">
                        {dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'}
                      </div>
                    </div>

                    {/* Class cards */}
                    <div className="space-y-2">
                      {dayClasses.map((classInfo) => {
                        const isLive = isClassLive(classInfo, date);
                        return (
                          <div key={classInfo.id} className={cn(
                            "relative flex items-center gap-3 overflow-hidden rounded-lg border bg-white p-3 shadow-sm",
                            isLive ? "border-brand/30 ring-1 ring-brand/10" : "border-slate-100"
                          )}>
                            {/* Accent left border */}
                            <div className={cn("absolute left-0 top-2 bottom-2 w-1 rounded-r-sm", getSubjectBorderColor(classInfo.subject))} />
                            <div className="min-w-0 flex-1 pl-2.5">
                              <div className="flex items-center gap-2">
                                {isLive && (
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                                  </span>
                                )}
                                <h3 className="truncate text-sm font-semibold text-slate-900">{classInfo.subject}</h3>
                              </div>
                              <div className="mt-0.5 truncate text-xs text-slate-400">{classInfo.batch}</div>
                            </div>
                            <div className="shrink-0 text-right tabular-nums">
                              <div className="text-xs font-semibold text-slate-700">{formatTime(classInfo.start_time)}</div>
                              <div className="text-[11px] text-slate-400">{formatTime(classInfo.end_time)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};
