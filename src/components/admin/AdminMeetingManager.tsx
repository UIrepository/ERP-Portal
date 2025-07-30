import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Import Tabs
import { Link as LinkIcon, ExternalLink, Copy, Search, CalendarCheck, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isPast, isFuture, isWithinInterval, addDays, setHours, setMinutes, setSeconds, getDay, nextDay, startOfDay } from 'date-fns';

interface MeetingLink {
  link: string;
  subject: string;
  batch: string;
}

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link: string; // This is the foreign key to meeting_links.link
}

// Combined interface for display
interface SessionDetails extends MeetingLink {
  scheduleId: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  calculatedOccurrence: Date; // Calculated date for sorting/categorizing
}

const LinksSkeleton = () => (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4 rounded-xl">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-4/5" />
                    <div className="flex gap-2 justify-end">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            </Card>
        ))}
    </div>
);


export const AdminMeetingManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('ongoing'); // State for tabs

  // Set up real-time subscription for schedules and meeting_links
  useEffect(() => {
    const schedulesChannel = supabase
      .channel('realtime-schedules-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          console.log('Real-time update: schedules changed');
          queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
        }
      )
      .subscribe();

    const meetingLinksChannel = supabase
      .channel('realtime-meeting-links-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_links' },
        () => {
          console.log('Real-time update: meeting_links changed');
          queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(schedulesChannel);
      supabase.removeChannel(meetingLinksChannel);
    };
  }, [queryClient]);

  // Fetch both schedules and meeting_links
  const { data: rawSchedules = [], isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['admin-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('day_of_week')
        .order('start_time');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rawMeetingLinks = [], isLoading: isLoadingMeetingLinks } = useQuery<MeetingLink[]>({
    queryKey: ['admin-meeting-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_links')
        .select('link, subject, batch'); // Select only available columns
      if (error) throw error;
      return data || [];
    },
  });

  const allSessions = useMemo(() => {
    if (!rawSchedules || !rawMeetingLinks) return [];

    const meetingLinkMap = new Map<string, MeetingLink>();
    rawMeetingLinks.forEach(ml => meetingLinkMap.set(ml.link, ml));

    const now = new Date();
    const sessions: SessionDetails[] = [];

    rawSchedules.forEach(schedule => {
      // Find the corresponding meeting link details
      const meetingLinkDetails = meetingLinkMap.get(schedule.link || '');

      if (meetingLinkDetails) {
        const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
        const [endHour, endMinute] = schedule.end_time.split(':').map(Number);

        // Calculate next occurrence for categorization and display
        let calculatedOccurrence = nextDay(now, schedule.day_of_week);
        calculatedOccurrence = setHours(calculatedOccurrence, startHour);
        calculatedOccurrence = setMinutes(calculatedOccurrence, startMinute);
        calculatedOccurrence = setSeconds(calculatedOccurrence, 0);

        // If the occurrence for "this week" is already in the past, get next week's occurrence
        const currentDayOfWeek = getDay(now);
        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
        const scheduleStartTimeInMinutes = startHour * 60 + startMinute;

        if (schedule.day_of_week < currentDayOfWeek || 
            (schedule.day_of_week === currentDayOfWeek && scheduleStartTimeInMinutes < currentTimeInMinutes)) {
          calculatedOccurrence = addDays(calculatedOccurrence, 7);
        }

        sessions.push({
          link: meetingLinkDetails.link,
          subject: schedule.subject,
          batch: schedule.batch,
          scheduleId: schedule.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          calculatedOccurrence: calculatedOccurrence,
        });
      }
    });

    // Sort sessions by their calculated occurrence time
    return sessions.sort((a, b) => a.calculatedOccurrence.getTime() - b.calculatedOccurrence.getTime());
  }, [rawSchedules, rawMeetingLinks]);

  const categorizedSessions = useMemo(() => {
    const now = new Date();
    const ongoing: SessionDetails[] = [];
    const upcoming: SessionDetails[] = [];
    const past: SessionDetails[] = [];

    allSessions.forEach(session => {
      const startDateTime = session.calculatedOccurrence;
      const endDateTime = setHours(setMinutes(setSeconds(startDateTime, 0), parseInt(session.end_time.split(':')[1]), 0), parseInt(session.end_time.split(':')[0]));

      if (isWithinInterval(now, { start: startDateTime, end: endDateTime })) {
        ongoing.push(session);
      } else if (isFuture(startDateTime)) {
        upcoming.push(session);
      } else {
        // For past sessions, we need to consider if it's the most recent past occurrence
        // This is complex for recurring schedules, so for simplicity, we'll just show past from today
        // A more robust solution might involve filtering to only show past sessions for the current week, or specific days
        const sessionDateOnly = startOfDay(session.calculatedOccurrence);
        const todayDateOnly = startOfDay(now);
        if (sessionDateOnly <= todayDateOnly) { // Check if it's past *today's* occurrence
            past.push(session);
        }
      }
    });
    
    // Sort upcoming from nearest to furthest
    upcoming.sort((a, b) => a.calculatedOccurrence.getTime() - b.calculatedOccurrence.getTime());
    // Sort past from furthest to nearest
    past.sort((a, b) => b.calculatedOccurrence.getTime() - a.calculatedOccurrence.getTime());

    return { ongoing, upcoming, past };
  }, [allSessions]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isLoading = isLoadingSchedules || isLoadingMeetingLinks;

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link Copied',
      description: 'The session link has been copied to your clipboard.',
    });
  };
  
  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 min-h-full">
      {/* Header Section - Enhanced Design */}
      <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white animate-fade-in-up">
        {/* Animated background circles */}
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full animate-pulse-slow animation-delay-1000"></div>

        <div className="relative z-10 text-center">
            <div className="flex items-center justify-center mb-4">
                <CalendarCheck className="h-16 w-16 text-blue-100 drop-shadow-md" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-lg">
                Manage Online Sessions
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 drop-shadow-sm font-semibold">
                Central hub for all class session links.
            </p>
        </div>
      </div>

      {/* Tabs for Ongoing, Upcoming, Past */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white border border-gray-200 rounded-lg shadow-sm p-1">
          <TabsTrigger value="ongoing" className="text-base py-2">Ongoing ({categorizedSessions.ongoing.length})</TabsTrigger>
          <TabsTrigger value="upcoming" className="text-base py-2">Upcoming ({categorizedSessions.upcoming.length})</TabsTrigger>
          <TabsTrigger value="past" className="text-base py-2">Past ({categorizedSessions.past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ongoing" className="space-y-4 pt-4">
          {isLoading ? <LinksSkeleton /> : categorizedSessions.ongoing.length > 0 ? (
            categorizedSessions.ongoing.map((session) => (
              <Card key={session.link} className="bg-white border-green-500 border-2 shadow-lg rounded-xl">
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex-grow mb-4 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-green-100 p-2 rounded-full">
                        <Clock className="h-5 w-5 text-green-600 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">{session.subject}</h3>
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Calendar className="h-4 w-4 mr-1" />
                          {format(session.calculatedOccurrence, 'PPP')}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-11">
                      <Badge variant="secondary">{session.batch}</Badge>
                      <Badge className="bg-green-500 text-white animate-pulse">LIVE NOW</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 truncate pl-11">{session.link}</p>
                  </div>
                  <div className="flex gap-2 justify-end shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleCopyLink(session.link)} className="text-blue-700 border-blue-300 hover:bg-blue-50">
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                    <Button size="sm" onClick={() => window.open(session.link, '_blank')} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <ExternalLink className="h-4 w-4 mr-2" /> Open Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="text-center py-10 bg-white rounded-lg border-dashed border-2 shadow-sm">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground">No ongoing sessions.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4 pt-4">
          {isLoading ? <LinksSkeleton /> : categorizedSessions.upcoming.length > 0 ? (
            categorizedSessions.upcoming.map((session) => (
              <Card key={session.link} className="bg-white hover:shadow-lg transition-shadow duration-300 rounded-xl">
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex-grow mb-4 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">{session.subject}</h3>
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Calendar className="h-4 w-4 mr-1" />
                          {format(session.calculatedOccurrence, 'PPP')}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-11">
                      <Badge variant="secondary">{session.batch}</Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {format(session.calculatedOccurrence, 'EEEE')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 truncate pl-11">{session.link}</p>
                  </div>
                  <div className="flex gap-2 justify-end shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleCopyLink(session.link)} className="text-blue-700 border-blue-300 hover:bg-blue-50">
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                    <Button size="sm" onClick={() => window.open(session.link, '_blank')} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <ExternalLink className="h-4 w-4 mr-2" /> Open Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="text-center py-10 bg-white rounded-lg border-dashed border-2 shadow-sm">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground">No upcoming sessions.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4 pt-4">
          {isLoading ? <LinksSkeleton /> : categorizedSessions.past.length > 0 ? (
            categorizedSessions.past.map((session) => (
              <Card key={session.link} className="bg-white opacity-70 rounded-xl">
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex-grow mb-4 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-gray-100 p-2 rounded-full">
                        <LinkIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">{session.subject}</h3>
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Calendar className="h-4 w-4 mr-1" />
                          {format(session.calculatedOccurrence, 'PPP')}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-11">
                      <Badge variant="outline">{session.batch}</Badge>
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Past</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 truncate pl-11">{session.link}</p>
                  </div>
                  <div className="flex gap-2 justify-end shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleCopyLink(session.link)} className="text-blue-700 border-blue-300 hover:bg-blue-50">
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                    <Button size="sm" onClick={() => window.open(session.link, '_blank')} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <ExternalLink className="h-4 w-4 mr-2" /> Open Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="text-center py-10 bg-white rounded-lg border-dashed border-2 shadow-sm">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground">No past sessions to display.</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
