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
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg transition-transform hover:scale-[1.01]"
        >
          {/* Live Pulse Indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-1 rounded-full">Live Now</span>
          </div>

          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <Video className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold mb-1 leading-tight">{classItem.subject}</h3>
              <p className="text-emerald-100 text-sm font-medium mb-3">
                {formatTime(classItem.start_time)} - {formatTime(classItem.end_time)}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleJoinClass(classItem.meeting_link_url)}
                  disabled={!classItem.meeting_link_url}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold border-0 shadow-sm"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Join Class
                </Button>
                {!classItem.meeting_link_url && (
                  <span className="text-emerald-100 text-xs italic">Waiting for link...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
