import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, getDay, parse, isWithinInterval, isAfter, isBefore, set } from 'date-fns';
import { ExternalLink, Clock, Calendar, Video } from 'lucide-react';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link: string;
}

const MeetingCard = ({ schedule }: { schedule: Schedule }) => (
    <Card className="bg-white hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-center justify-between">
            <div>
                <h4 className="font-bold">{schedule.subject}</h4>
                <div className="text-sm text-muted-foreground flex items-center mt-1">
                    <Badge variant="secondary" className="mr-2">{schedule.batch}</Badge> | 
                    <Clock className="h-3 w-3 mx-2" />
                    {format(parse(schedule.start_time, 'HH:mm:ss', new Date()), 'h:mm a')}
                </div>
            </div>
            <Button asChild size="sm">
                <a href={schedule.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Join
                </a>
            </Button>
        </CardContent>
    </Card>
);

const MeetingList = ({ title, schedules }: { title: string, schedules: Schedule[] }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center">
                {title === "Ongoing" && <Video className="h-5 w-5 mr-2 text-green-500" />}
                {title === "Upcoming" && <Calendar className="h-5 w-5 mr-2 text-blue-500" />}
                {title === "Past" && <Clock className="h-5 w-5 mr-2 text-gray-500" />}
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
            {schedules.length > 0 ? (
                schedules.map(schedule => <MeetingCard key={schedule.id} schedule={schedule} />)
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No {title.toLowerCase()} classes.</p>
            )}
        </CardContent>
    </Card>
);

export const AdminMeetingManager = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['all-meeting-links'],
    queryFn: async (): Promise<Schedule[]> => {
        const { data, error } = await supabase.from('schedules').select('*').not('link', 'is', null);
        if (error) throw error;
        return data || [];
    },
  });
  
  const categorizedSchedules = useMemo(() => {
    const todayDay = getDay(now);
    const ongoing: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const past: Schedule[] = [];

    schedules.forEach(schedule => {
      if (schedule.day_of_week === todayDay) {
        const startTime = parse(schedule.start_time, 'HH:mm:ss', now);
        const endTime = parse(schedule.end_time, 'HH:mm:ss', now);
        
        const scheduleStart = set(now, { hours: startTime.getHours(), minutes: startTime.getMinutes(), seconds: 0 });
        const scheduleEnd = set(now, { hours: endTime.getHours(), minutes: endTime.getMinutes(), seconds: 0 });

        if (isWithinInterval(now, { start: scheduleStart, end: scheduleEnd })) {
          ongoing.push(schedule);
        } else if (isAfter(scheduleStart, now)) {
          upcoming.push(schedule);
        } else if (isBefore(scheduleEnd, now)) {
          past.push(schedule);
        }
      }
    });

    return { ongoing, upcoming, past };
  }, [schedules, now]);
  
  if (isLoading) {
      return (
          <div className="p-6 space-y-6">
              <Skeleton className="h-8 w-1/3" />
              <div className="grid md:grid-cols-3 gap-6">
                  <Skeleton className="h-48" />
                  <Skeleton className="h-48" />
                  <Skeleton className="h-48" />
              </div>
          </div>
      )
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Class Meeting Links</h2>
          <p className="text-gray-600 mt-1">All scheduled meetings, sorted by their current status.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <MeetingList title="Ongoing" schedules={categorizedSchedules.ongoing} />
        <MeetingList title="Upcoming" schedules={categorizedSchedules.upcoming} />
        <MeetingList title="Past" schedules={categorizedSchedules.past} />
      </div>
    </div>
  );
};
