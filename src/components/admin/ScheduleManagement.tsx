import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, getDay, startOfWeek, addDays, isSameDay } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

// Interface for the schedule data
interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

// Static data for rendering the schedule grid
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const [currentDate] = useState(new Date());
  const queryClient = useQueryClient();

  // --- Real-time Subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime-schedules')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        (payload) => {
          console.log('Schedule change detected!', payload);
          queryClient.invalidateQueries({ queryKey: ['admin-all-schedules'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // --- Data Fetching ---
  const { data: schedules, isLoading, isError, error } = useQuery<Schedule[]>({
    queryKey: ['admin-all-schedules'],
    queryFn: async (): Promise<Schedule[]> => {
        const { data, error } = await supabase.from('schedules').select('*').order('day_of_week').order('start_time');
        if (error) {
          console.error("Error fetching schedules:", error);
          throw error;
        }
        return data || [];
    },
  });

  // --- Data Processing ---
  const weekDates = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [currentDate]);

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

  // --- Rendering ---
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Full Class Schedule</h2>
          <p className="text-gray-600 mt-1">A complete, real-time overview of all scheduled classes.</p>
        </div>
      </div>
        
      {isLoading ? (
        <ScheduleSkeleton />
      ) : isError ? (
        <Card className="text-center py-20 bg-white rounded-lg border-dashed border-2 border-red-400 shadow-sm">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-destructive">Failed to Load Schedule</h3>
            <p className="text-muted-foreground mt-2">
                This is likely due to a Row Level Security (RLS) policy preventing access.
            </p>
            <p className="text-sm text-gray-500 mt-4">
                <strong>Error:</strong> {error?.message}
            </p>
        </Card>
      ) : (
      <div className="bg-white p-4 rounded-2xl shadow-lg">
          <div className="grid grid-cols-8">
              <div className="text-center font-semibold text-gray-500 py-2">Time</div>
              {weekDates.map((date, index) => (
                  <div key={index} className={`text-center font-semibold py-2 ${isSameDay(date, today) ? 'text-primary' : 'text-gray-500'}`}>
                      <div>{DAYS[getDay(date)]}</div>
                      <div className="text-xs font-normal">{format(date, 'MMM d')}</div>
                  </div>
              ))}
          </div>
          <div className="relative">
              {timeSlots.map(time => (
                  <div key={time} className="grid grid-cols-8 border-t">
                      <div className="text-center text-sm font-medium text-gray-700 py-4 px-2 border-r">{formatTime(time)}</div>
                      {weekDates.map((date, dayIndex) => {
                          const classInfo = schedules.filter(s => s.day_of_week === getDay(date) && s.start_time === time);
                          return (
                              <div key={dayIndex} className={`p-2 border-r last:border-r-0 ${isSameDay(date, today) ? 'bg-blue-50' : ''}`}>
                                  {classInfo.length > 0 && classInfo.map(info => (
                                    <Card key={info.id} className="bg-white shadow-md hover:shadow-lg transition-shadow mb-2">
                                        <CardContent className="p-3">
                                            <p className="font-bold text-gray-800 text-sm">{info.subject}</p>
                                            <Badge variant="secondary" className="mt-1">{info.batch}</Badge>
                                        </CardContent>
                                    </Card>
                                  ))}
                              </div>
                          );
                      })}
                  </div>
              ))}
          </div>
      </div>
      )}
    </div>
  );
};
