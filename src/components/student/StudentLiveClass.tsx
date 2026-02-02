import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, parseISO, addMinutes, isWithinInterval, isBefore } from 'date-fns';
import { Video, Clock, ExternalLink, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StudentLiveClassProps {
  batch: string;
  subject: string;
}

interface ScheduleWithLink {
  id: string;
  batch: string;
  subject: string;
  day_of_week: number;
  date: string | null;
  start_time: string;
  end_time: string;
  link: string | null;
  meeting_link_url: string | null;
}

export const StudentLiveClass = ({ batch, subject }: StudentLiveClassProps) => {
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  const todayDateStr = format(today, 'yyyy-MM-dd');

  // Fetch schedules for today matching batch and subject
  const { data: schedules, isLoading } = useQuery<ScheduleWithLink[]>({
    queryKey: ['studentLiveClass', batch, subject, todayDateStr],
    queryFn: async () => {
      // Get schedules for today's day of week or specific date
      const { data: schedulesData, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('batch', batch)
        .eq('subject', subject)
        .or(`day_of_week.eq.${currentDayOfWeek},date.eq.${todayDateStr}`);

      if (error) throw error;

      // Get meeting links for this batch/subject
      const { data: meetingLinks } = await supabase
        .from('meeting_links')
        .select('*')
        .eq('batch', batch)
        .eq('subject', subject)
        .eq('is_active', true)
        .limit(1);

      const meetingLink = meetingLinks?.[0]?.link || null;

      return (schedulesData || []).map(schedule => ({
        ...schedule,
        meeting_link_url: schedule.link || meetingLink,
      }));
    },
  });

  const now = new Date();

  // Categorize classes
  const ongoingClasses = schedules?.filter(schedule => {
    const [startHour, startMin] = schedule.start_time.split(':').map(Number);
    const [endHour, endMin] = schedule.end_time.split(':').map(Number);
    
    const startTime = new Date(today);
    startTime.setHours(startHour, startMin, 0, 0);
    
    const endTime = new Date(today);
    endTime.setHours(endHour, endMin, 0, 0);
    
    // Add 15 min buffer before and after
    const bufferStart = addMinutes(startTime, -15);
    const bufferEnd = addMinutes(endTime, 15);
    
    return isWithinInterval(now, { start: bufferStart, end: bufferEnd });
  }) || [];

  const upcomingClasses = schedules?.filter(schedule => {
    const [startHour, startMin] = schedule.start_time.split(':').map(Number);
    const startTime = new Date(today);
    startTime.setHours(startHour, startMin, 0, 0);
    
    // Only show future classes that aren't ongoing
    return isBefore(now, startTime) && !ongoingClasses.find(o => o.id === schedule.id);
  }).sort((a, b) => a.start_time.localeCompare(b.start_time)) || [];

  const handleJoinClass = (meetingLink: string | null) => {
    if (meetingLink) {
      window.open(meetingLink, '_blank');
    }
  };

  const formatTime = (time: string) => {
    const [hour, min] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, min);
    return format(date, 'h:mm a');
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Live Classes</h1>
        <p className="text-slate-500 mt-1">
          {format(today, 'EEEE, MMMM d, yyyy')} • {subject}
        </p>
      </div>

      {/* Ongoing Classes */}
      {ongoingClasses.length > 0 && (
        <div className="mb-8">
          {ongoingClasses.map((classItem) => (
            <div
              key={classItem.id}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-xl"
            >
              {/* Live Pulse Indicator */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <span className="text-sm font-semibold uppercase tracking-wide">Live Now</span>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Video className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold mb-1">{classItem.subject}</h3>
                  <p className="text-emerald-100 text-sm mb-4">
                    {formatTime(classItem.start_time)} - {formatTime(classItem.end_time)}
                  </p>
                  <Button
                    onClick={() => handleJoinClass(classItem.meeting_link_url)}
                    disabled={!classItem.meeting_link_url}
                    className="bg-white text-emerald-600 hover:bg-emerald-50 font-semibold"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Join Class
                  </Button>
                  {!classItem.meeting_link_url && (
                    <p className="text-emerald-100 text-xs mt-2">Meeting link not available yet</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming Classes */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-slate-500" />
          Upcoming Today
        </h2>

        {upcomingClasses.length > 0 ? (
          <div className="space-y-3">
            {upcomingClasses.map((classItem) => (
              <div
                key={classItem.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{classItem.subject}</h4>
                      <p className="text-sm text-slate-500">
                        {formatTime(classItem.start_time)} - {formatTime(classItem.end_time)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleJoinClass(classItem.meeting_link_url)}
                    disabled={!classItem.meeting_link_url}
                    className="text-slate-600"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Join
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : ongoingClasses.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <Video className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-700">No Classes Today</h3>
            <p className="text-slate-500 mt-1 text-sm">
              There are no {subject} classes scheduled for today
            </p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No more classes scheduled for today</p>
        )}
      </div>
    </div>
  );
};
