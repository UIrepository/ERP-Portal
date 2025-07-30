import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
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
        query = query.order('date', { nullsFirst: true }).order('day_of_week').order('start_time');
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

  const groupedSchedules = useMemo(() => {
    if (!schedules) return {};
    return schedules.reduce((acc, schedule) => {
      const day = schedule.date ? format(new Date(`${schedule.date}T00:00:00`), 'eeee, MMMM do') : DAYS[schedule.day_of_week];
      if (!acc[day]) acc[day] = [];
      acc[day].push(schedule);
      return acc;
    }, {} as Record<string, Schedule[]>);
  }, [schedules]);
  
  const orderedDays = useMemo(() => {
      if (!groupedSchedules) return [];
      return Object.keys(groupedSchedules).sort((a, b) => {
          const aIsDay = DAYS.includes(a);
          const bIsDay = DAYS.includes(b);
          if (aIsDay && !bIsDay) return -1;
          if (!aIsDay && bIsDay) return 1;
          if (aIsDay && bIsDay) return DAYS.indexOf(a) - DAYS.indexOf(b);
          return new Date(a.split(', ')[1]).getTime() - new Date(b.split(', ')[1]).getTime();
      });
  }, [groupedSchedules]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };
  
  const isCurrentTime = (schedule: Schedule) => {
    const now = new Date();
    if (schedule.date && format(new Date(schedule.date), 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd')) {
        return false;
    }
    if (!schedule.date && schedule.day_of_week !== now.getDay()) {
        return false;
    }
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = schedule.start_time.split(':').map(Number);
    const [endHour, endMin] = schedule.end_time.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMin;
    const endTimeMinutes = endHour * 60 + endMin;
    return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Class Schedule</h2>
          <p className="text-gray-600 mt-1">Your weekly class timetable</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Current Time</p>
          <p className="text-lg font-semibold text-gray-900">{format(currentTime, 'PPp')}</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
          <SelectTrigger className="w-48 h-10">
            <SelectValue placeholder="Filter by batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {availableBatches.map((batch) => (
              <SelectItem key={batch} value={batch}>{batch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <ScheduleSkeleton /> : (
      <div className="grid gap-6">
        {orderedDays.map((day) => (
          <Card key={day} className="overflow-hidden">
            <CardHeader className="bg-white border-b">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                {day}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {groupedSchedules?.[day]?.length > 0 ? (
                <div className="space-y-0">
                  {groupedSchedules[day].map((schedule) => (
                    <div 
                      key={schedule.id} 
                      className={`p-4 border-b last:border-b-0 transition-colors ${ isCurrentTime(schedule) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50' }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span className="font-medium text-gray-900">
                                {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                              </span>
                            </div>
                            {isCurrentTime(schedule) && <Badge variant="default" className="bg-blue-600">Live</Badge>}
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 mt-1">{schedule.subject}</h4>
                          <Badge variant="outline" className="mt-2">{schedule.batch}</Badge>
                        </div>
                        {schedule.link && (
                          <Button size="sm" asChild>
                            <a href={schedule.link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" /> Join
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No classes scheduled for {day}</p>
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
