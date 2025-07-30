import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parse, isWithinInterval, isAfter, getDay, set } from 'date-fns';
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

// A single card representing a class meeting
const MeetingCard = ({ schedule }: { schedule: Schedule }) => (
  <Card className="bg-white hover:shadow-md transition-shadow">
    <CardContent className="p-4 flex items-center justify-between">
      <div>
        <h4 className="font-bold">{schedule.subject}</h4>
        <div className="text-sm text-muted-foreground flex items-center mt-1">
          <Badge variant="secondary" className="mr-2">
            {schedule.batch}
          </Badge>
          |
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

// A list container for a specific category of meetings
const MeetingList = ({ title, schedules }: { title: string; schedules: Schedule[] }) => {
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const timeA = parse(a.start_time, 'HH:mm:ss', new Date()).getTime();
      const timeB = parse(b.start_time, 'HH:mm:ss', new Date()).getTime();
      // For upcoming, sort from nearest to furthest. For past, sort from most recent to oldest.
      return title === 'Upcoming (Today)' ? timeA - timeB : timeB - timeA;
    });
  }, [schedules, title]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          {title === 'Ongoing' && <Video className="h-5 w-5 mr-2 text-green-500" />}
          {title === 'Upcoming (Today)' && <Calendar className="h-5 w-5 mr-2 text-blue-500" />}
          {title === 'Past (Today)' && <Clock className="h-5 w-5 mr-2 text-gray-500" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 h-[60vh] overflow-y-auto p-4">
        {sortedSchedules.length > 0 ? (
          sortedSchedules.map(schedule => <MeetingCard key={schedule.id} schedule={schedule} />)
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground text-center py-4">No {title.split(' ')[0].toLowerCase()} classes today.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main component for the meeting manager page
export const AdminMeetingManager = () => {
  const [now, setNow] = useState(new Date());
  const queryClient = useQueryClient();

  // Keep the current time updated
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Set up real-time subscription to the schedules table
  useEffect(() => {
    const channel = supabase
      .channel('schedules-realtime-meetings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['all-meeting-links-daily'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch all schedules with a meeting link
  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['all-meeting-links-daily'],
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase.from('schedules').select('*').not('link', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Categorize today's schedules into ongoing, upcoming, and past
  const categorizedSchedules = useMemo(() => {
    const todayDay = getDay(now);
    const ongoing: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const past: Schedule[] = [];

    const todaySchedules = schedules.filter(schedule => schedule.day_of_week === todayDay);

    todaySchedules.forEach(schedule => {
      const startTime = parse(schedule.start_time, 'HH:mm:ss', new Date());
      const endTime = parse(schedule.end_time, 'HH:mm:ss', new Date());

      const classStartDateTime = set(now, { hours: startTime.getHours(), minutes: startTime.getMinutes(), seconds: 0 });
      const classEndDateTime = set(now, { hours: endTime.getHours(), minutes: endTime.getMinutes(), seconds: 0 });

      if (isWithinInterval(now, { start: classStartDateTime, end: classEndDateTime })) {
        ongoing.push(schedule);
      } else if (isAfter(classStartDateTime, now)) {
        upcoming.push(schedule);
      } else {
        past.push(schedule);
      }
    });

    return { ongoing, upcoming, past };
  }, [schedules, now]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Today's Meeting Links</h2>
        <p className="text-gray-600 mt-1">
          A real-time overview of all scheduled meetings for today, {format(now, 'PPPP')}.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <MeetingList title="Ongoing" schedules={categorizedSchedules.ongoing} />
        <MeetingList title="Upcoming (Today)" schedules={categorizedSchedules.upcoming} />
        <MeetingList title="Past (Today)" schedules={categorizedSchedules.past} />
      </div>
    </div>
  );
};
