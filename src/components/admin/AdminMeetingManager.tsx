import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parse, isWithinInterval, isAfter, startOfWeek, addDays, set } from 'date-fns';
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
const MeetingCard = ({ schedule, day }: { schedule: Schedule; day: string }) => (
  <Card className="bg-white hover:shadow-md transition-shadow">
    <CardContent className="p-4 flex items-center justify-between">
      <div>
        <h4 className="font-bold">{schedule.subject}</h4>
        <div className="text-sm text-muted-foreground flex items-center mt-1">
          <Badge variant="secondary" className="mr-2">
            {schedule.batch}
          </Badge>
          |
          <Calendar className="h-3 w-3 mx-2" /> {day} |
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

// A list container for a specific category of meetings (Ongoing, Upcoming, Past)
const MeetingList = ({ title, schedules, now }: { title: string; schedules: Schedule[]; now: Date }) => {
  const getScheduleDateTime = (s: Schedule) => {
    const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Use Sunday as the start of the week
    const scheduleDate = addDays(weekStart, s.day_of_week);
    const startTime = parse(s.start_time, 'HH:mm:ss', new Date());
    return set(scheduleDate, { hours: startTime.getHours(), minutes: startTime.getMinutes() });
  };

  // Sort the schedules based on their category
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const dateA = getScheduleDateTime(a);
      const dateB = getScheduleDateTime(b);
      // For upcoming, sort from nearest to furthest. For past, sort from most recent to oldest.
      return title === 'Upcoming' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });
  }, [schedules, now, title]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          {title === 'Ongoing' && <Video className="h-5 w-5 mr-2 text-green-500" />}
          {title === 'Upcoming' && <Calendar className="h-5 w-5 mr-2 text-blue-500" />}
          {title === 'Past' && <Clock className="h-5 w-5 mr-2 text-gray-500" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 h-[60vh] overflow-y-auto p-4">
        {sortedSchedules.length > 0 ? (
          sortedSchedules.map(schedule => {
            const dayName = format(addDays(startOfWeek(now, { weekStartsOn: 0 }), schedule.day_of_week), 'EEEE');
            return <MeetingCard key={schedule.id} schedule={schedule} day={dayName} />;
          })
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground text-center py-4">No {title.toLowerCase()} classes for this week.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// The main component for the meeting manager page
export const AdminMeetingManager = () => {
  const [now, setNow] = useState(new Date());

  // Keep the current time updated
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Fetch all schedules that have a meeting link
  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['all-meeting-links'],
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase.from('schedules').select('*').not('link', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Categorize schedules into ongoing, upcoming, and past
  const categorizedSchedules = useMemo(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Week starts on Sunday
    const ongoing: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const past: Schedule[] = [];

    schedules.forEach(schedule => {
      const scheduleDay = addDays(weekStart, schedule.day_of_week);
      const startTime = parse(schedule.start_time, 'HH:mm:ss', new Date());
      const endTime = parse(schedule.end_time, 'HH:mm:ss', new Date());

      const classStartDateTime = set(scheduleDay, { hours: startTime.getHours(), minutes: startTime.getMinutes() });
      const classEndDateTime = set(scheduleDay, { hours: endTime.getHours(), minutes: endTime.getMinutes() });

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
        <h2 className="text-3xl font-bold text-gray-900">Class Meeting Links</h2>
        <p className="text-gray-600 mt-1">All scheduled meetings, sorted by their current status for the week.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <MeetingList title="Ongoing" schedules={categorizedSchedules.ongoing} now={now} />
        <MeetingList title="Upcoming" schedules={categorizedSchedules.upcoming} now={now} />
        <MeetingList title="Past" schedules={categorizedSchedules.past} now={now} />
      </div>
    </div>
  );
};
