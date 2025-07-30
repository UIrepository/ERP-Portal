// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentSchedule.tsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added for filters
import { Calendar, Clock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton'; // Added for loading state

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link?: string;
}

interface OngoingClass {
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
}

// Define the structure for an enrollment record from the new table
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
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all'); // New filter state
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all'); // New filter state

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch user's specific enrollments from the new table
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

  // Extract unique batches and subjects from the fetched enrollments for filter dropdowns
  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.subject_name) || [])).sort();
  }, [userEnrollments]);

  // 2. Fetch schedules based on specific enrolled combinations and selected filters
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['student-schedule', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
    queryFn: async (): Promise<Schedule[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];

        let query = supabase.from('schedules').select('*');

        // Dynamically build OR conditions for each specific enrolled combination
        const combinationFilters = userEnrollments
            .filter(enrollment =>
                (selectedBatchFilter === 'all' || enrollment.batch_name === selectedBatchFilter) &&
                (selectedSubjectFilter === 'all' || enrollment.subject_name === selectedSubjectFilter)
            )
            .map(enrollment => `(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

        if (combinationFilters.length > 0) {
            query = query.or(combinationFilters.join(','));
        } else {
            return []; // Return empty if no combinations match filters
        }

        query = query.order('day_of_week').order('start_time');

        const { data, error } = await query;
      
        if (error) {
            console.error("Error fetching filtered schedules:", error);
            throw error; // Propagate error for react-query
        }
        return data || [];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  const { data: ongoingClass, isLoading: isLoadingOngoingClass } = useQuery<OngoingClass | null>({
    queryKey: ['ongoing-class', profile?.user_id, userEnrollments],
    queryFn: async (): Promise<OngoingClass | null> => {
      if (!profile?.user_id || !userEnrollments || userEnrollments.length === 0) return null;

      const now = new Date();
      const currentDay = now.getDay();
      const currentTimeStr = now.toTimeString().slice(0, 8);

      let query = supabase
        .from('schedules')
        .select(`
          subject,
          batch,
          start_time,
          end_time,
          meeting_links!inner (
            link
          )
        `);

      // Dynamically build OR conditions for each specific enrolled combination for ongoing class
      const combinationFilters = userEnrollments
          .map(enrollment => `(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

      if (combinationFilters.length > 0) {
          query = query.or(combinationFilters.join(','));
      } else {
          return null;
      }

      query = query
        .eq('day_of_week', currentDay)
        .lte('start_time', currentTimeStr)
        .gte('end_time', currentTimeStr)
        .eq('meeting_links.is_active', true)
        .limit(1);

      const { data: scheduleData, error: scheduleError } = await query;

      if (scheduleError) throw scheduleError;

      if (!scheduleData || scheduleData.length === 0) return null;

      const schedule = scheduleData[0];
      return {
        subject: schedule.subject,
        batch: schedule.batch,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        meeting_link: (schedule.meeting_links as any)?.link || ''
      };
    },
    enabled: !!profile?.user_id && !!userEnrollments && userEnrollments.length > 0,
    refetchInterval: 30000 // Refetch every 30 seconds
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

  const isLoading = isLoadingEnrollments || isLoadingSchedules || isLoadingOngoingClass;

  if (isLoading) {
    return <ScheduleSkeleton />;
  }

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

      {ongoingClass && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-800 font-semibold">Live Class</span>
                </div>
                <h3 className="text-xl font-bold text-green-900">{ongoingClass.subject}</h3>
                <p className="text-green-700">
                  {formatTime(ongoingClass.start_time)} - {formatTime(ongoingClass.end_time)}
                </p>
                <Badge variant="outline" className="mt-2 border-green-300 text-green-800">
                  {ongoingClass.batch}
                </Badge>
              </div>
              {ongoingClass.meeting_link && (
                <Button 
                  onClick={() => window.open(ongoingClass.meeting_link, '_blank')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Join Class
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Section */}
      <div className="flex gap-4">
        {/* Select for Batch filter */}
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
        {/* Select for Subject filter */}
        <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
          <SelectTrigger className="w-48 h-10">
            <SelectValue placeholder="Filter by subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {availableSubjects.map((subject) => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
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
