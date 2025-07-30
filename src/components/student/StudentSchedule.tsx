// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentSchedule.tsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  link?: string; // Schedule might have its own link
  // meeting_link_url?: string; // Removed as RPC is no longer used for this component
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

  // Fetch user's specific enrollments
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

  // Available batches for the filter dropdown (all batches user is enrolled in)
  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  // Reset selected batch filter if it becomes invalid (e.g., after enrollments load or change)
  if (selectedBatchFilter !== 'all' && !availableBatches.includes(selectedBatchFilter)) {
      setSelectedBatchFilter('all');
  }

  // Directly fetch schedules from the 'schedules' table
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['student-schedule-direct', userEnrollments, selectedBatchFilter],
    queryFn: async (): Promise<Schedule[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];

        let query = supabase.from('schedules').select('*');

        // Determine which batches to filter by
        let batchesToFilter = selectedBatchFilter === 'all'
            ? Array.from(new Set(userEnrollments.map(e => e.batch_name))) // If 'All Batches', use all enrolled batches
            : [selectedBatchFilter]; // Otherwise, use the single selected batch

        if (batchesToFilter.length === 0) {
          // If after filtering, there are no batches to query for, return empty
          return [];
        }

        // Apply the filter for batch names using .in()
        query = query.in('batch', batchesToFilter);
        
        // Add additional ordering
        query = query.order('day_of_week').order('start_time');

        const { data, error } = await query;
      
        if (error) {
            console.error("Error fetching schedules directly:", error);
            throw error;
        }
        return data || [];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0 // Enable only if enrollments are loaded and exist
  });

  const isLoading = isLoadingEnrollments || isLoadingSchedules;

  if (isLoading) {
    return <ScheduleSkeleton />;
  }

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

  const isCurrentTime = (dayIndex: number, startTime: string, endTime: string) => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMin;
    const endTimeMinutes = endHour * 60 + endMin;

    return dayIndex === currentDay && 
           currentTimeMinutes >= startTimeMinutes && 
           currentTimeMinutes <= endTimeMinutes;
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

      {/* Filter Section - Only Batch Filter */}
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

      <div className="grid gap-6">
        {DAYS.map((day, index) => (
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
                      className={`p-4 border-b last:border-b-0 transition-colors ${
                        isCurrentTime(schedule.day_of_week, schedule.start_time, schedule.end_time)
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
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
                            {isCurrentTime(schedule.day_of_week, schedule.start_time, schedule.end_time) && (
                              <Badge variant="default" className="bg-blue-600">Live</Badge>
                            )}
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 mt-1">
                            {schedule.subject}
                          </h4>
                          <Badge variant="outline" className="mt-2">
                            {schedule.batch}
                          </Badge>
                        </div>
                        {schedule.link && ( // Display Join Class button if link exists on schedule table
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
    </div>
  );
};
