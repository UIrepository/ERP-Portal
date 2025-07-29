import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

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

export const TeacherSchedule = () => {
  const { profile } = useAuth();
  const batches = Array.isArray(profile?.batch) ? profile.batch : [profile?.batch].filter(Boolean);

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['teacher-schedule', batches],
    queryFn: async (): Promise<Schedule[]> => {
      if (!batches.length) return [];
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .in('batch', batches)
        .order('day_of_week')
        .order('start_time');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.batch
  });

  const groupedSchedules = schedules?.reduce((acc, schedule) => {
    const day = DAYS[schedule.day_of_week];
    if (!acc[day]) acc[day] = [];
    acc[day].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  return (
    <div className="space-y-8 p-6 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <Calendar className="mr-3 h-8 w-8 text-primary" />
          Full Batch Schedule
        </h1>
        <p className="text-gray-500 mt-1">Viewing schedules for batches: {batches.join(', ')}</p>
      </div>

      {/* Schedule Grid */}
      {isLoading ? (
        <ScheduleSkeleton />
      ) : (
        <div className="grid gap-6">
          {DAYS.map((day) => (
            <Card key={day} className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  {day}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {groupedSchedules?.[day]?.length > 0 ? (
                  <div className="space-y-4">
                    {groupedSchedules[day].map((schedule) => (
                      <div key={schedule.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{schedule.subject}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                          </div>
                        </div>
                        <Badge variant="secondary">{schedule.batch}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>No classes scheduled for {day}.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
