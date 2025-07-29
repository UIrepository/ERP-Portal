
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const StudentSchedule = () => {
  const { profile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: schedules } = useQuery({
    queryKey: ['student-schedule'],
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('day_of_week')
        .order('start_time');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const { data: ongoingClass } = useQuery({
    queryKey: ['ongoing-class'],
    queryFn: async (): Promise<OngoingClass | null> => {
      const { data, error } = await supabase
        .rpc('get_current_ongoing_class', {
          user_batch: profile?.batch,
          user_subjects: profile?.subjects || []
        });
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!profile?.batch && !!profile?.subjects,
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
