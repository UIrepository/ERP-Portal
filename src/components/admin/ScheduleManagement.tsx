import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, getDay } from 'date-fns';
import { User } from 'lucide-react';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
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
                     <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        ))}
    </div>
);

export const ScheduleManagement = () => {
  const [currentTime] = useState(new Date());
  const queryClient = useQueryClient();

  // --- Real-time Subscription ---
  // This useEffect hook sets up a listener for any changes (inserts, updates, deletes)
  // in the public 'schedules' table in your Supabase database.
  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime-schedules')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        (payload) => {
          // When a change is detected, invalidate the React Query cache for this query.
          // This automatically triggers a refetch of the data, ensuring the UI is always in sync.
          console.log('Schedule change detected!', payload);
          queryClient.invalidateQueries({ queryKey: ['admin-all-schedules'] });
        }
      )
      .subscribe();

    // Cleanup function to remove the channel subscription when the component unmounts.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);


  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['admin-all-schedules'],
    queryFn: async (): Promise<Schedule[]> => {
        const { data, error } = await supabase.from('schedules').select('*').order('day_of_week').order('start_time');
        if (error) throw error;
        return data || [];
    },
  });
  
  const { data: teacherEnrollments, isLoading: isLoadingEnrollments } = useQuery<any[]>({
      queryKey: ['teacher-enrollments-for-schedule'],
      queryFn: async () => {
          const { data, error } = await supabase
              .from('user_enrollments')
              .select(`
                  user_id,
                  batch_name,
                  subject_name,
                  profile:profiles ( name )
              `);

          if (error) {
              console.error('Error fetching teacher enrollments:', error);
              return [];
          }
          return data;
      }
  });
  
  const teacherMap = useMemo(() => {
      const map = new Map<string, string>();
      if (teacherEnrollments) {
          teacherEnrollments.forEach(enrollment => {
              const key = `${enrollment.batch_name}-${enrollment.subject_name}`;
              if(enrollment.profile) {
                map.set(key, enrollment.profile.name);
              }
          });
      }
      return map;
  }, [teacherEnrollments]);

  const timeSlots = useMemo(() => {
    const slots = new Set<string>();
    schedules?.forEach(s => slots.add(s.start_time));
    return Array.from(slots).sort();
  }, [schedules]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const today = getDay(currentTime);
  const isLoading = isLoadingSchedules || isLoadingEnrollments;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Full Class Schedule</h2>
          <p className="text-gray-600 mt-1">A complete overview of all scheduled classes.</p>
        </div>
      </div>
        
      {isLoading ? <ScheduleSkeleton /> : (
      <div className="bg-white p-4 rounded-2xl shadow-lg">
          <div className="grid grid-cols-8">
              <div className="text-center font-semibold text-gray-500 py-2">Time</div>
              {DAYS.map((day, index) => (
                  <div key={day} className={`text-center font-semibold py-2 ${index === today ? 'text-primary' : 'text-gray-500'}`}>
                      {day}
                  </div>
              ))}
          </div>
          <div className="relative">
              {timeSlots.map(time => (
                  <div key={time} className="grid grid-cols-8 border-t">
                      <div className="text-center text-sm font-medium text-gray-700 py-4 px-2 border-r">{formatTime(time)}</div>
                      {DAYS.map((day, dayIndex) => {
                          const classInfo = schedules?.filter(s => s.day_of_week === dayIndex && s.start_time === time);
                          return (
                              <div key={`${day}-${time}`} className={`p-2 border-r last:border-r-0 ${dayIndex === today ? 'bg-blue-50' : ''}`}>
                                  {classInfo && classInfo.length > 0 && classInfo.map(info => {
                                      const teacherName = teacherMap.get(`${info.batch}-${info.subject}`);
                                      return (
                                        <Card key={info.id} className="bg-white shadow-md hover:shadow-lg transition-shadow mb-2">
                                            <CardContent className="p-3">
                                                <p className="font-bold text-gray-800 text-sm">{info.subject}</p>
                                                <Badge variant="secondary" className="mt-1">{info.batch}</Badge>
                                                {teacherName && (
                                                    <div className="flex items-center text-xs text-muted-foreground mt-2">
                                                        <User className="h-3 w-3 mr-1" />
                                                        {teacherName}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                      );
                                  })}
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
