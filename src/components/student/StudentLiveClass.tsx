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
      // We initially fetch loosely (Day Match OR Date Match) to capture all potential candidates
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

      // STRICT FILTERING LOGIC
      // Ensure we don't show future/past dates just because the weekday matches
      const validSchedules = (schedulesData || []).filter(schedule => {
        // Rule 1: If a specific date is defined, it MUST match today.
        // This handles cases like "Next Monday" vs "Today (Monday)".
        if (schedule.date) {
          return schedule.date === todayDateStr;
        }
        
        // Rule 2: If it is a recurring class (date is null), the day_of_week MUST match.
        // (Supabase OR query might return a date-match that has a different weekday, though rare)
        return schedule.day_of_week === currentDayOfWeek;
      });

      // Map schedules to their specific subject links
      return validSchedules.map(schedule => {
        // Find a link specifically for this subject
        const subjectLink = meetingLinks?.find(l => l.subject === schedule.subject);
        
        // Priority: Specific Schedule Link > General Subject Link
        const finalLink = schedule.link || subjectLink?.link || null;

        return {
          ...schedule,
          meeting_link_url: finalLink,
        };
      });
    },
    enabled: !!batch,
    refetchInterval: 30000 // Refetch every 30s to keep live status accurate
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
    
    // Add 15 min buffer before and after for "Live" status
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
      <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
        <div className="bg-white p-3 rounded-full shadow-sm mb-3">
          <Video className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">No Live Class</h3>
        <p className="text-xs text-slate-500 max-w-[200px] mx-auto mt-1">
          No classes are currently live. Check your schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {ongoingClasses.map((classItem) => (
        <div
          key={classItem.id}
          className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100 p-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-200"
        >
          {/* Live Badge */}
          <div className="absolute top-4 right-4 z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-500 shadow-sm animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              Live
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 border border-emerald-100">
              <Video className="h-6 w-6 text-emerald-600" />
            </div>
            
            <div className="flex-1 min-w-0 pr-16">
              <h3 className="text-lg font-bold text-slate-900 truncate">
                {classItem.subject}
              </h3>
              <p className="text-slate-500 text-sm font-medium">
                {formatTime(classItem.start_time)} - {formatTime(classItem.end_time)}
              </p>
            </div>
          </div>
          
          <div className="mt-4">
            <Button
              onClick={() => handleJoinClass(classItem.meeting_link_url)}
              disabled={!classItem.meeting_link_url}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm h-10 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Join Class Now
            </Button>
            
            {!classItem.meeting_link_url && (
              <p className="mt-2 text-center text-[10px] font-medium text-amber-600 bg-amber-50 py-1 rounded">
                Link will be available shortly...
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
