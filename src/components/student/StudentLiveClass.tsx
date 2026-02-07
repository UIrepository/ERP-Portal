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
  is_jitsi_live?: boolean;
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

      // 1. Get Schedules (Base Plan)
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

      // 2. Get Static Meeting Links (Fallback)
      let linkQuery = supabase
        .from('meeting_links')
        .select('*')
        .eq('batch', batch)
        .eq('is_active', true);
      
      if (subject) {
        linkQuery = linkQuery.eq('subject', subject);
      }
      const { data: meetingLinks } = await linkQuery;

      // 3. Get ACTIVE JITSI CLASSES (Primary Source for Live Classes)
      let activeClassQuery = supabase
        .from('active_classes')
        .select('*')
        .eq('batch', batch)
        .eq('is_active', true);

      if (subject) {
        activeClassQuery = activeClassQuery.eq('subject', subject);
      }
      const { data: activeClasses } = await activeClassQuery;

      // STRICT FILTERING LOGIC
      const validSchedules = (schedulesData || []).filter(schedule => {
        // Rule 1: Specific Date Priority (e.g. Rescheduled class)
        if (schedule.date) {
          return schedule.date === todayDateStr;
        }
        // Rule 2: Recurring Schedule (must match today's weekday)
        return schedule.day_of_week === currentDayOfWeek;
      });

      // Map schedules to the best available link
      return validSchedules.map(schedule => {
        // Check if there is a LIVE Jitsi class for this subject
        const activeJitsi = activeClasses?.find(ac => ac.subject === schedule.subject);
        
        // Check if there is a static link
        const subjectLink = meetingLinks?.find(l => l.subject === schedule.subject);
        
        // PRIORITY: Active Jitsi > Schedule Specific Link > Static Subject Link
        const finalLink = activeJitsi?.room_url || schedule.link || subjectLink?.link || null;

        return {
          ...schedule,
          meeting_link_url: finalLink,
          is_jitsi_live: !!activeJitsi // Flag to show "Live" UI distinctively
        };
      });
    },
    enabled: !!batch,
    refetchInterval: 10000 // Refetch often to catch when teacher starts class
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
    
    // Buffer: 15 mins before, 15 mins after
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
          No classes are currently live.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {ongoingClasses.map((classItem) => (
        <div
          key={classItem.id}
          className={`relative overflow-hidden rounded-2xl bg-white border p-5 shadow-sm transition-all hover:shadow-md ${
            classItem.is_jitsi_live ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-100'
          }`}
        >
          {/* Live Badge */}
          <div className="absolute top-4 right-4 z-10">
            {classItem.is_jitsi_live ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-red-500 shadow-sm animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  Live Now
                </span>
            ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100">
                  Scheduled
                </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                classItem.is_jitsi_live ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
            }`}>
              <Video className={`h-6 w-6 ${classItem.is_jitsi_live ? 'text-red-500' : 'text-slate-500'}`} />
            </div>
            
            <div className="flex-1 min-w-0 pr-20">
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
              className={`w-full font-semibold shadow-sm h-10 transition-all ${
                  classItem.meeting_link_url 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {classItem.meeting_link_url ? "Join Class" : "Waiting for Teacher..."}
            </Button>
            
            {!classItem.meeting_link_url && (
              <p className="mt-2 text-center text-[10px] font-medium text-amber-600 bg-amber-50 py-1 rounded">
                Teacher hasn't started the class yet.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
