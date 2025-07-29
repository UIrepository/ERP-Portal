import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink, Video } from 'lucide-react';
import { format, differenceInSeconds, nextDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// Countdown Timer Component
const Countdown = ({ targetDate }: { targetDate: Date }) => {
  const calculateTimeLeft = () => {
    const totalSeconds = differenceInSeconds(targetDate, new Date());
    if (totalSeconds <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return { days, hours, minutes, seconds };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const isClassStartingSoon = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes < 15;
  const isClassLive = Object.values(timeLeft).every(val => val === 0);

  if (isClassLive) {
    return <Badge className="bg-green-500 text-white">Live Now</Badge>;
  }

  return (
    <div className={`flex items-center gap-2 font-mono ${isClassStartingSoon ? 'text-red-500 animate-pulse' : ''}`}>
      <Clock className="h-4 w-4" />
      <span>Starts in:</span>
      <span>{String(timeLeft.days).padStart(2, '0')}d</span>
      <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
      <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
      <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
    </div>
  );
};

export const TeacherYourClasses = () => {
  const { profile } = useAuth();
  const batches = Array.isArray(profile?.batch) ? profile.batch : [profile?.batch].filter(Boolean);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['teacher-upcoming-classes', batches, profile?.subjects],
    queryFn: async () => {
      if (!batches.length || !profile?.subjects) return [];
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .in('batch', batches)
        .in('subject', profile.subjects)
        .not('link', 'is', null);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const upcomingClasses = useMemo(() => {
    const now = new Date();
    return schedules.map(schedule => {
      const [hour, minute] = schedule.start_time.split(':').map(Number);
      let nextOccurrence = nextDay(now, schedule.day_of_week);
      nextOccurrence.setHours(hour, minute, 0, 0);

      // If the next occurrence is in the past for this week, get next week's occurrence
      if (nextOccurrence < now) {
        nextOccurrence.setDate(nextOccurrence.getDate() + 7);
      }
      return { ...schedule, nextOccurrence };
    }).sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());
  }, [schedules]);

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <Clock className="mr-3 h-8 w-8 text-primary" />
          Your Upcoming Classes
        </h1>
        <p className="text-gray-500 mt-1">Countdown to your next scheduled classes.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : upcomingClasses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {upcomingClasses.map(cls => (
            <Card key={cls.id} className="bg-white">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{cls.subject}</span>
                  <Badge variant="secondary">{cls.batch}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Next on: {format(cls.nextOccurrence, "eeee, MMMM do 'at' h:mm a")}
                </div>
                <Countdown targetDate={cls.nextOccurrence} />
                <Button className="w-full" onClick={() => window.open(cls.link!, '_blank')}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Join Class
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
          <Video className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">No Upcoming Classes Found</h3>
          <p className="text-muted-foreground mt-2">
            It looks like you don't have any classes with meeting links scheduled.
          </p>
        </div>
      )}
    </div>
  );
};
