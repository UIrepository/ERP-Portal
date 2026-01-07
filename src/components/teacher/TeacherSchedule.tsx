// src/components/teacher/TeacherSchedule.tsx
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, getDay, startOfWeek, addDays, isSameDay, subDays } from 'date-fns';
import { AlertTriangle, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// Interface for the schedule data
interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date?: string;
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
    'bg-cyan-200',
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

export const TeacherSchedule = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [displayDate, setDisplayDate] = useState(new Date());
  const queryClient = useQueryClient();

  // --- Real-time Clock ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Real-time Subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('teacher-realtime-schedules-and-exams')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        (payload) => {
          console.log('Schedule change detected!', payload);
          queryClient.invalidateQueries({ queryKey: ['teacher-all-schedules'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exams' },
        (payload) => {
          console.log('Exam change detected!', payload);
          queryClient.invalidateQueries({ queryKey: ['teacher-all-exams'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // --- Data Fetching ---
  const { data: schedules, isLoading: isLoadingSchedules, isError: isErrorSchedules, error: errorSchedules } = useQuery<Schedule[]>({
    queryKey: ['teacher-all-schedules'],
    queryFn: async (): Promise<Schedule[]> => {
        // Fetch ALL schedules to match Admin view as requested
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .order('date', { nullsFirst: false })
            .order('day_of_week')
            .order('start_time');
            
        if (error) {
          console.error("Error fetching schedules:", error);
          throw error;
        }
        return data || [];
    },
  });

  const { data: exams, isLoading: isLoadingExams, isError: isErrorExams, error: errorExams } = useQuery<Exam[]>({
    queryKey: ['teacher-all-exams'],
    queryFn: async (): Promise<Exam[]> => {
        const { data, error } = await supabase
            .from('exams')
            .select('*')
            .order('date');
            
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

  // --- Data Processing ---
  const weekDates = useMemo(() => {
    const start = startOfWeek(displayDate);
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [displayDate]);

  const timeSlots = useMemo(() => {
    if (!schedules) return [];
    const slots = new Set<string>();
    schedules.forEach(s => slots.add(s.start_time));
    return Array.from(slots).sort();
  }, [schedules]);
  
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Class Schedule</h2>
          <p className="text-muted-foreground mt-1">Overview of all scheduled classes and exams.</p>
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
                This may be due to a Row Level Security (RLS) policy preventing access or a network error.
            </p>
            <p className="text-sm text-gray-500 mt-4">
                <strong>Error:</strong> {error?.message}
            </p>
        </Card>
      ) : (
      <div className="bg-white p-4 rounded-2xl shadow-lg overflow-x-auto">
          <div className="min-w-[1000px]">
              <div className="grid grid-cols-[80px_repeat(7,1fr)]">
                  <div className="text-center font-semibold text-gray-500 py-2">Time</div>
                  {weekDates.map((date, index) => (
                      <div key={index} className={`text-center font-semibold py-2 ${isSameDay(date, today) ? 'text-primary' : 'text-gray-500'}`}>
                          <div>{DAYS[getDay(date)]}</div>
                          <div className="text-xs font-normal">{format(date, 'MMM d')}</div>
                      </div>
                  ))}
              </div>
              <div className="relative">
                  {timeSlots.map(time => {
                      const sampleScheduleForSlot = schedules?.find(s => s.start_time === time);
                      const endTime = sampleScheduleForSlot ? sampleScheduleForSlot.end_time : '';
                      return (
                          <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] border-t">
                              <div className="text-center text-xs font-medium text-gray-700 py-4 px-2 border-r">
                                {formatTime(time)} - {endTime ? formatTime(endTime) : ''}
                              </div>
                              {weekDates.map((date, dayIndex) => {
                                  const recurringClasses = schedules.filter(s => !s.date && s.day_of_week === getDay(date) && s.start_time === time);
                                  const dateSpecificClasses = schedules.filter(s => s.date && isSameDay(new Date(s.date), date) && s.start_time === time);
                                  const classesInfo = [...dateSpecificClasses, ...recurringClasses];
                                  const dayExams = exams.filter(e => isSameDay(new Date(e.date), date));
                                  return (
                                      <div key={dayIndex} className={`p-2 border-r last:border-r-0 ${isSameDay(date, today) ? 'bg-blue-50' : ''}`}>
                                          {classesInfo.map(classInfo => (
                                            <Card key={classInfo.id} className={cn("shadow-md hover:shadow-lg transition-shadow mb-2", getSubjectColorClass(classInfo.subject))}>
                                                <CardContent className="p-3">
                                                    <p className="font-bold text-gray-800 text-sm break-words">{classInfo.subject}</p>
                                                    <Badge variant="secondary" className="mt-1">{classInfo.batch}</Badge>
                                                </CardContent>
                                            </Card>
                                          ))}
                                          {dayExams.map(exam => (
                                              <Card key={exam.id} className="bg-rose-100 border-l-4 border-rose-400 shadow-md hover:shadow-lg transition-shadow">
                                                  <CardContent className="p-3">
                                                      <div className="flex items-center gap-2">
                                                        <BookOpen className="h-4 w-4 text-rose-600" />
                                                        <p className="font-bold text-gray-800 text-sm break-words">{exam.name}</p>
                                                      </div>
                                                      <Badge variant="destructive" className="mt-1">{exam.batch}</Badge>
                                                      <Badge variant="outline" className="mt-1 ml-1">{exam.subject}</Badge>
                                                  </CardContent>
                                              </Card>
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
