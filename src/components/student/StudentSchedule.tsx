import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, getDay, startOfWeek, addDays, isSameDay, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link?: string;
  date?: string; // Optional date for specific, non-recurring classes
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ScheduleSkeleton = () => (
    <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
);

export const StudentSchedule = () => {
  const { profile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [displayDate, setDisplayDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); // Update every second
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
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
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
        if (error) {
            console.error("Error fetching schedules directly:", error);
            throw error;
        }
        return data || [];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  const isLoading = isLoadingEnrollments || isLoadingSchedules;

  const weekDates = useMemo(() => {
    const start = startOfWeek(displayDate);
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

  return (
    <div className="p-2 sm:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Class Schedule</h2>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Your weekly class timetable</p>
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
                <p className="text-base sm:text-lg font-semibold text-gray-900">{format(currentTime, 'p')}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
          <SelectTrigger className="w-full sm:w-48 h-10 bg-white">
            <SelectValue placeholder="Filter by batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All My Batches</SelectItem>
            {availableBatches.map((batch) => (
              <SelectItem key={batch} value={batch}>{batch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <ScheduleSkeleton /> : (
      <div className="bg-white p-2 sm:p-4 rounded-2xl shadow-lg overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[minmax(100px,1fr)_repeat(7,minmax(120px,1fr))]">
                <div className="text-center font-semibold text-gray-500 py-2 sticky left-0 bg-white z-10">Time</div>
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
                        <div key={time} className="grid grid-cols-[minmax(100px,1fr)_repeat(7,minmax(120px,1fr))] border-t">
                            <div className="text-center text-xs font-medium text-gray-700 py-4 px-2 border-r sticky left-0 bg-white z-10">
                                {formatTime(time)} - {endTime ? formatTime(endTime) : ''}
                            </div>
                            {weekDates.map((date, dayIndex) => {
                                const recurringClass = schedules?.find(s => !s.date && s.day_of_week === getDay(date) && s.start_time === time);
                                const dateSpecificClass = schedules?.find(s => s.date && isSameDay(new Date(s.date), date) && s.start_time === time);
                                const classInfo = dateSpecificClass || recurringClass;
                                return (
                                    <div key={`${dayIndex}-${time}`} className={`p-2 border-r last:border-r-0 ${isSameDay(date, today) ? 'bg-blue-50' : ''}`}>
                                        {classInfo && (
                                            <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
                                                <CardContent className="p-3">
                                                    <p className="font-bold text-gray-800 text-sm">{classInfo.subject}</p>
                                                    <Badge variant="secondary" className="mt-1">{classInfo.batch}</Badge>
                                                    {classInfo.date && <Badge variant="outline" className="mt-1 ml-1">{format(new Date(classInfo.date), 'MMM d')}</Badge>}
                                                    {classInfo.link && (
                                                        <Button size="sm" asChild className="w-full mt-2">
                                                            <a href={classInfo.link} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="h-4 w-4 mr-1" /> Join
                                                            </a>
                                                        </Button>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        )}
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
