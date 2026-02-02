import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, isWithinInterval } from 'date-fns';
import { Video, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface StudentLiveClassProps {
  batch: string | null;
  subject?: string | null;
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

  // Fetch schedules for today matching batch (and subject if provided)
  const { data: schedules, isLoading } = useQuery<ScheduleWithLink[]>({
    queryKey: ['studentLiveClass', batch, subject, todayDateStr],
    queryFn: async () => {
      if (!batch) return [];

      // Build query for schedules
      let query = supabase
        .from('schedules')
        .select('*')
        .eq('batch', batch)
        .or(`day_of_week.eq.${currentDayOfWeek},date.eq.${todayDateStr}`);

      if (subject) {
        query = query.eq('subject', subject);
      }

      const { data: schedulesData, error } = await query;

      if (error) throw error;

      // Get meeting links for this batch
      let linkQuery = supabase
        .from('meeting_links')
        .select('*')
        .eq('batch', batch)
        .eq('is_active', true);
      
      if (subject) {
        linkQuery = linkQuery.eq('subject', subject);
      }

      const { data: meetingLinks } = await linkQuery;

      // Map schedules to their specific subject links
      return (schedulesData || []).map(schedule => {
        // Find a link specifically for this subject
        const subjectLink = meetingLinks?.find(l => l.subject === schedule.subject);
        return {
          ...schedule,
          meeting_link_url: schedule.link || subjectLink?.link || null,
        };
      });
    },
    enabled: !!batch
  });

  const now = new Date();

  // Filter only Ongoing classes
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
      <div className="w-full">
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (ongoingClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Video className="h-12 w-12 text-slate-200 mb-3" />
        <h3 className="text-lg font-semibold text-slate-700">No Live Class</h3>
        <p className="text-slate-500 max-w-xs mx-auto">
          There are no classes currently running.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {ongoingClasses.map((classItem) => (
        <div
          key={classItem.id}
          className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-6 shadow-sm transition-all hover:shadow-md"
        >
          {/* Live Pulse Indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
              Live Now
            </span>
          </div>

          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 border border-slate-100">
              <Video className="h-8 w-8 text-slate-600" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold mb-1 leading-tight text-slate-900">
                {classItem.subject}
              </h3>
              <p className="text-slate-500 text-sm font-medium mb-3">
                {formatTime(classItem.start_time)} - {formatTime(classItem.end_time)}
              </p>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleJoinClass(classItem.meeting_link_url)}
                  disabled={!classItem.meeting_link_url}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Join Class
                </Button>
                {!classItem.meeting_link_url && (
                  <span className="text-amber-600 text-xs italic font-medium bg-amber-50 px-2 py-1 rounded-md">
                    Waiting for link...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
