import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, getDay, startOfWeek, addDays, isSameDay, subDays } from 'date-fns';
import { AlertTriangle, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

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
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Full Class Schedule</h2>
          <p className="text-gray-600 mt-1">A real-time overview of all scheduled classes.</p>
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
                                  const recurringClass = schedules.find(s => !s.date && s.day_of_week === getDay(date) && s.start_time === time);
                                  const dateSpecificClass = schedules.find(s => s.date && isSameDay(new Date(s.date), date) && s.start_time === time);
                                  const classInfo = dateSpecificClass || recurringClass;
                                  const dayExams = exams.filter(e => isSameDay(new Date(e.date), date));
                                  return (
                                      <div key={dayIndex} className={`p-2 border-r last:border-r-0 ${isSameDay(date, today) ? 'bg-blue-50' : ''}`}>
                                          {classInfo && (
                                            <Card key={classInfo.id} className="bg-white shadow-md hover:shadow-lg transition-shadow mb-2">
                                                <CardContent className="p-3">
                                                    <p className="font-bold text-gray-800 text-sm">{classInfo.subject}</p>
                                                    <Badge variant="secondary" className="mt-1">{classInfo.batch}</Badge>
                                                    {classInfo.date && <Badge variant="outline" className="mt-1 ml-1">{format(new Date(classInfo.date), 'MMM d')}</Badge>}
                                                </CardContent>
                                            </Card>
                                          )}
                                          {dayExams.map(exam => (
                                              <Card key={exam.id} className="bg-rose-50 border-l-4 border-rose-400 shadow-md hover:shadow-lg transition-shadow">
                                                  <CardContent className="p-3">
                                                      <div className="flex items-center gap-2">
                                                        <BookOpen className="h-4 w-4 text-rose-600" />
                                                        <p className="font-bold text-gray-800 text-sm">{exam.name}</p>
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
