import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, getDay, startOfWeek, addDays, isSameDay, subDays } from 'date-fns';
import { AlertTriangle, ChevronLeft, ChevronRight, BookOpen, Layers, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';

// Interface for the schedule data
interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date?: string; // Optional date for specific, non-recurring classes
}

// Interface for exam data
interface Exam {
  id: string;
  name: string;
  date: string;
  subject: string;
  batch: string;
  type: string;
}

// Static data for rendering the schedule grid
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Color palette for subjects
const subjectColorClasses = [
    'bg-sky-200',
    'bg-emerald-200',
    'bg-amber-200',
    'bg-violet-200',
    'bg-rose-200',
    'bg-cyan-200', // Turquoise-like color
    'bg-fuchsia-200',
    'bg-lime-200',
    'bg-teal-200',
    'bg-blue-200',
    'bg-green-200',
    'bg-yellow-200',
    'bg-purple-200',
    'bg-red-200',
    'bg-indigo-200',
    'bg-pink-200',
    'bg-orange-200',
];

// Skeleton component for a better loading experience
const ScheduleSkeleton = () => (
    <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
            <Card key={i}>
                <div className="p-4 space-y-3">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-24 w-full mt-2" />
                </div>
            </Card>
        ))}
    </div>
);

export const ScheduleManagement = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [displayDate, setDisplayDate] = useState(new Date());
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [batchOpen, setBatchOpen] = useState(false);
  const queryClient = useQueryClient();

  // --- Real-time Clock ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); // Update every second
    return () => clearInterval(timer);
  }, []);

  // --- Real-time Subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime-schedules-and-exams')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        (payload) => {
          console.log('Schedule change detected!', payload);
          queryClient.invalidateQueries({ queryKey: ['admin-all-schedules'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exams' },
        (payload) => {
          console.log('Exam change detected!', payload);
          queryClient.invalidateQueries({ queryKey: ['admin-all-exams'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // --- Data Fetching ---
  const { data: schedules, isLoading: isLoadingSchedules, isError: isErrorSchedules, error: errorSchedules } = useQuery<Schedule[]>({
    queryKey: ['admin-all-schedules'],
    queryFn: async (): Promise<Schedule[]> => {
        const { data, error } = await supabase.from('schedules').select('*').order('date', { nullsFirst: false }).order('day_of_week').order('start_time');
        if (error) {
          console.error("Error fetching schedules:", error);
          throw error;
        }
        return data || [];
    },
  });

  const { data: exams, isLoading: isLoadingExams, isError: isErrorExams, error: errorExams } = useQuery<Exam[]>({
    queryKey: ['admin-all-exams'],
    queryFn: async (): Promise<Exam[]> => {
        const { data, error } = await supabase.from('exams').select('*').order('date');
        if (error) {
          console.error("Error fetching exams:", error);
          throw error;
        }
        return data || [];
    },
  });

  const isLoading = isLoadingSchedules || isLoadingExams;
  const isError = isErrorSchedules || isErrorExams;
  const error = errorSchedules || errorExams;

  // --- Batch filter ---
  const uniqueBatches = useMemo(() => {
    const set = new Set<string>();
    schedules?.forEach(s => s.batch && set.add(s.batch));
    exams?.forEach(e => e.batch && set.add(e.batch));
    return Array.from(set).sort();
  }, [schedules, exams]);

  const filteredSchedules = useMemo(
    () => (batchFilter === 'all' ? schedules : schedules?.filter(s => s.batch === batchFilter)) || [],
    [schedules, batchFilter],
  );
  const filteredExams = useMemo(
    () => (batchFilter === 'all' ? exams : exams?.filter(e => e.batch === batchFilter)) || [],
    [exams, batchFilter],
  );

  // --- Data Processing ---
  const weekDates = useMemo(() => {
    const start = startOfWeek(displayDate);
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [displayDate]);

  const timeSlots = useMemo(() => {
    const slots = new Set<string>();
    filteredSchedules.forEach(s => slots.add(s.start_time));
    return Array.from(slots).sort();
  }, [filteredSchedules]);
  
  const subjectColorMap = useMemo(() => {
    const allSubjects = new Set<string>();
    if (schedules) schedules.forEach(s => allSubjects.add(s.subject));
    if (exams) exams.forEach(e => allSubjects.add(e.subject));

    const uniqueSubjects = Array.from(allSubjects).sort();
    const colorMap = new Map<string, string>();
    uniqueSubjects.forEach((subject, index) => {
        colorMap.set(subject, subjectColorClasses[index % subjectColorClasses.length]);
    });
    return colorMap;
  }, [schedules, exams]);

  const getSubjectColorClass = (subject: string) => {
    return subjectColorMap.get(subject) || 'bg-gray-200';
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const today = new Date();

  const handlePreviousWeek = () => {
    setDisplayDate(subDays(displayDate, 7));
  };

  const handleNextWeek = () => {
    setDisplayDate(addDays(displayDate, 7));
  };

  // --- Rendering ---
  return (
    <div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Full Class Schedule</h2>
          {/* Batch filter — searchable */}
          <div className="mt-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500 shrink-0" />
            <Popover open={batchOpen} onOpenChange={setBatchOpen}>
              <PopoverTrigger asChild>
                <button className="flex w-full sm:w-[300px] items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-left hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                  <span className={cn('truncate', batchFilter === 'all' ? 'text-slate-500' : 'text-slate-800')}>
                    {batchFilter === 'all' ? 'All batches' : batchFilter}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search batch…" />
                  <CommandList className="max-h-72">
                    <CommandEmpty>No batch found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="All batches" onSelect={() => { setBatchFilter('all'); setBatchOpen(false); }} className="cursor-pointer">
                        <Check className={cn('mr-2 h-4 w-4', batchFilter === 'all' ? 'opacity-100 text-indigo-600' : 'opacity-0')} />
                        All batches
                      </CommandItem>
                      {uniqueBatches.map((b) => (
                        <CommandItem key={b} value={b} onSelect={() => { setBatchFilter(b); setBatchOpen(false); }} className="cursor-pointer">
                          <Check className={cn('mr-2 h-4 w-4', batchFilter === b ? 'opacity-100 text-indigo-600' : 'opacity-0')} />
                          <span className="text-sm">{b}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {batchFilter !== 'all' && (
              <button onClick={() => setBatchFilter('all')} className="text-xs font-normal text-slate-500 hover:text-slate-800 whitespace-nowrap">
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                    <p className="text-sm text-gray-500">{format(weekDates[0], 'MMM d')} - {format(weekDates[6], 'MMM d, yyyy')}</p>
                </div>
                <Button variant="outline" size="icon" onClick={handleNextWeek}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">{format(currentTime, 'p')}</p>
            </div>
        </div>
      </div>

      {isLoading ? (
        <ScheduleSkeleton />
      ) : isError ? (
        <Card className="text-center py-20 bg-white rounded-lg border-dashed border-2 border-red-400 shadow-sm">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-destructive">Failed to Load Schedule</h3>
            <p className="text-muted-foreground mt-2">
                This may be due to a Row Level Security (RLS) policy preventing access.
            </p>
            <p className="text-sm text-gray-500 mt-4">
                <strong>Error:</strong> {error?.message}
            </p>
        </Card>
      ) : (
      <div className="bg-white p-2 rounded-md border border-slate-200 shadow-sm overflow-x-auto">
          <div className="min-w-[1000px]">
              <div className="grid grid-cols-[72px_repeat(7,1fr)]">
                  <div className="text-center font-normal text-gray-500 py-1.5 text-sm">Time</div>
                  {weekDates.map((date, index) => (
                      <div key={index} className={`text-center font-normal py-1.5 text-sm ${isSameDay(date, today) ? 'text-primary' : 'text-gray-500'}`}>
                          <div>{DAYS[getDay(date)]}</div>
                          <div className="text-xs">{format(date, 'MMM d')}</div>
                      </div>
                  ))}
              </div>
              <div className="relative">
                  {timeSlots.map(time => {
                      const sampleScheduleForSlot = filteredSchedules.find(s => s.start_time === time);
                      const endTime = sampleScheduleForSlot ? sampleScheduleForSlot.end_time : '';
                      return (
                          <div key={time} className="grid grid-cols-[72px_repeat(7,1fr)] border-t">
                              <div className="text-center text-[11px] font-normal text-gray-600 py-2.5 px-1.5 border-r leading-tight">
                                {formatTime(time)} - {endTime ? formatTime(endTime) : ''}
                              </div>
                              {weekDates.map((date, dayIndex) => {
                                  const recurringClasses = filteredSchedules.filter(s => !s.date && s.day_of_week === getDay(date) && s.start_time === time);
                                  const dateSpecificClasses = filteredSchedules.filter(s => s.date && isSameDay(new Date(s.date), date) && s.start_time === time);
                                  const classesInfo = [...dateSpecificClasses, ...recurringClasses];
                                  const dayExams = filteredExams.filter(e => isSameDay(new Date(e.date), date));
                                  return (
                                      <div key={dayIndex} className={`p-1.5 border-r last:border-r-0 ${isSameDay(date, today) ? 'bg-blue-50' : ''}`}>
                                          {classesInfo.map(classInfo => (
                                            <div key={classInfo.id} className={cn("rounded-[4px] mb-1.5 p-2", getSubjectColorClass(classInfo.subject))}>
                                                <p className="font-normal text-gray-800 text-[13px] break-words leading-snug">{classInfo.subject}</p>
                                                {batchFilter === 'all' && <span className="mt-1 inline-block rounded-[3px] bg-white/70 px-1.5 py-0.5 text-[10px] font-normal text-slate-600">{classInfo.batch}</span>}
                                            </div>
                                          ))}
                                          {dayExams.map(exam => (
                                              <div key={exam.id} className="rounded-[4px] mb-1.5 p-2 bg-rose-100 border-l-2 border-rose-400">
                                                  <div className="flex items-center gap-1.5">
                                                    <BookOpen className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                                    <p className="font-normal text-gray-800 text-[13px] break-words leading-snug">{exam.name}</p>
                                                  </div>
                                                  <span className="mt-1 inline-block rounded-[3px] bg-white/70 px-1.5 py-0.5 text-[10px] font-normal text-rose-700">{exam.batch}</span>
                                                  <span className="mt-1 ml-1 inline-block rounded-[3px] border border-slate-300 px-1.5 py-0.5 text-[10px] font-normal text-slate-600">{exam.subject}</span>
                                              </div>
                                          ))}
                                      </div>
                                  );
                              })}
                          </div>
                      );
                  })}
              </div>
          </div>
      </div>
      )}
    </div>
  );
};
