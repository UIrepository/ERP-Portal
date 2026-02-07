import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, isWithinInterval, differenceInMinutes } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button'; // Ensure Button is imported
import { toast } from 'sonner';

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
  const { profile, user } = useAuth();
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  const todayDateStr = format(today, 'yyyy-MM-dd');

  // Fetch schedules logic
  const { data: schedules, isLoading } = useQuery<ScheduleWithLink[]>({
    queryKey: ['studentLiveClass', batch, subject, todayDateStr],
    queryFn: async () => {
      if (!batch) return [];

      // 1. Get Schedules
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

      // 2. Get Static Meeting Links
      let linkQuery = supabase
        .from('meeting_links')
        .select('*')
        .eq('batch', batch)
        .eq('is_active', true);
      
      if (subject) {
        linkQuery = linkQuery.eq('subject', subject);
      }
      const { data: meetingLinks } = await linkQuery;

      // 3. Get Active Classes (To check if teacher is inside)
      let activeClassQuery = supabase
        .from('active_classes')
        .select('*')
        .eq('batch', batch)
        .eq('is_active', true);

      if (subject) {
        activeClassQuery = activeClassQuery.eq('subject', subject);
      }
      const { data: activeClasses } = await activeClassQuery;

      // 4. Filter Valid Schedules
      const validSchedules = (schedulesData || []).filter(schedule => {
        if (schedule.date) {
          return schedule.date === todayDateStr;
        }
        return schedule.day_of_week === currentDayOfWeek;
      });

      // 5. Map Links & Status
      return validSchedules.map(schedule => {
        const activeJitsi = activeClasses?.find(ac => ac.subject === schedule.subject);
        const subjectLink = meetingLinks?.find(l => l.subject === schedule.subject);
        
        // Base Jitsi Link
        const roomName = generateJitsiRoomName(schedule.batch, schedule.subject);
        const generatedJitsiLink = `https://meet.jit.si/${roomName}`;
        
        const dbLink = activeJitsi?.room_url || schedule.link || subjectLink?.link;

        let finalLink = null;
        if (dbLink) {
          if (dbLink.includes('meet.jit.si')) {
             finalLink = generatedJitsiLink;
          } else {
             finalLink = dbLink;
          }
        } else {
          finalLink = generatedJitsiLink;
        }

        return {
          ...schedule,
          meeting_link_url: finalLink,
          is_jitsi_live: !!activeJitsi // True only if teacher has started class
        };
      });
    },
    enabled: !!batch,
    refetchInterval: 5000 // Faster refresh to catch when teacher starts
  });

  const now = new Date();

  // Logic to separate "Live Now" from "Upcoming"
  const liveClasses: ScheduleWithLink[] = [];
  const upcomingClasses: ScheduleWithLink[] = [];

  schedules?.forEach(schedule => {
    const [startHour, startMin] = schedule.start_time.split(':').map(Number);
    const [endHour, endMin] = schedule.end_time.split(':').map(Number);
    
    const startTime = new Date(today);
    startTime.setHours(startHour, startMin, 0, 0);
    
    const endTime = new Date(today);
    endTime.setHours(endHour, endMin, 0, 0);
    
    const bufferStart = addMinutes(startTime, -15);
    const bufferEnd = addMinutes(endTime, 15);
    
    if (isWithinInterval(now, { start: bufferStart, end: bufferEnd })) {
      liveClasses.push(schedule);
    } 
    else if (now < startTime && differenceInMinutes(startTime, now) < 240) {
      upcomingClasses.push(schedule);
    }
  });

  upcomingClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));

  const handleJoinClass = (item: ScheduleWithLink) => {
    if (!item.meeting_link_url) return;

    // Check if it's a Jitsi link
    if (item.meeting_link_url.includes('meet.jit.si')) {
      
      // 1. Construct Safe URL for Students
      const urlObj = new URL(item.meeting_link_url);
      
      // 2. Append Configuration Hash
      // This forces the "Stop Live Stream" button to disappear for students
      const configParams = [
        `config.liveStreamingEnabled=false`,
        `config.prejoinPageEnabled=false`,
        `config.disableRemoteMute=true`, // Prevent students muting others
        `userInfo.displayName="${profile?.name || user?.email || 'Student'}"`
      ];

      // Jitsi reads config from the hash
      urlObj.hash = configParams.join('&');

      window.open(urlObj.toString(), '_blank');
    } else {
      // Zoom or Google Meet
      window.open(item.meeting_link_url, '_blank');
    }
  };

  const formatTimeRange = (start: string, end: string) => {
    const formatSingle = (t: string) => {
      const [h, m] = t.split(':');
      const date = new Date();
      date.setHours(Number(h), Number(m));
      return format(date, 'h:mm a');
    };
    return `${formatSingle(start)} — ${formatSingle(end)}`;
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-[4px]" />;
  }

  // Combine lists for rendering in grid, prioritizing live classes
  const allClasses = [...liveClasses, ...upcomingClasses];

  return (
    <div className="w-full font-sans antialiased text-slate-900 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold tracking-tight text-slate-900">
           Live Class Sessions
        </h1>
      </div>

      {allClasses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Render Live Classes */}
          {liveClasses.map((item) => (
             <div key={item.id} className="bg-white border border-slate-200 rounded-[4px] p-6 flex flex-col justify-between min-h-[180px] transition-colors hover:border-slate-300 shadow-sm">
                <div className="mb-5">
                   <div className="flex items-center gap-1.5 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600">
                        Live Now
                      </span>
                   </div>
                   <h2 className="text-[16px] font-semibold text-slate-900 mb-1 leading-tight">
                      {item.subject}
                   </h2>
                   <p className="text-[13px] font-normal text-slate-500">
                      {item.batch}
                   </p>
                </div>

                <div className="flex items-center justify-between mt-auto">
                   <span className="text-[13px] font-normal text-slate-900">
                      {formatTimeRange(item.start_time, item.end_time)}
                   </span>
                   
                   {/* CRITICAL FIX: 
                     Only show "Join Class" if the teacher is actually LIVE.
                     This forces the teacher to join first, making THEM the moderator.
                   */}
                   {item.is_jitsi_live ? (
                       <button 
                         onClick={() => handleJoinClass(item)}
                         className="bg-slate-900 text-white px-4 py-2 text-[12px] font-normal rounded-[4px] hover:bg-slate-800 transition-opacity"
                       >
                         Join Class
                       </button>
                   ) : (
                       <Button disabled variant="secondary" className="text-[12px] h-9 opacity-70">
                         Waiting for Teacher...
                       </Button>
                   )}
                </div>
             </div>
          ))}

          {/* Render Upcoming Classes */}
          {upcomingClasses.map((item) => (
             <div key={item.id} className="bg-white border border-slate-200 rounded-[4px] p-6 flex flex-col justify-between min-h-[180px] transition-colors hover:border-slate-300 shadow-sm">
                <div className="mb-5">
                   <div className="flex items-center gap-1.5 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Upcoming
                      </span>
                   </div>
                   <h2 className="text-[16px] font-semibold text-slate-900 mb-1 leading-tight">
                      {item.subject}
                   </h2>
                   <p className="text-[13px] font-normal text-slate-500">
                      {item.batch}
                   </p>
                </div>

                <div className="flex items-center justify-between mt-auto">
                   <span className="text-[13px] font-normal text-slate-900">
                      {formatTimeRange(item.start_time, item.end_time)}
                   </span>
                   
                    {/* Allow joining early only if teacher started early */}
                   {item.is_jitsi_live ? (
                       <button 
                         onClick={() => handleJoinClass(item)}
                         className="bg-slate-900 text-white px-4 py-2 text-[12px] font-normal rounded-[4px] hover:bg-slate-800 transition-opacity"
                       >
                         Join Early
                       </button>
                   ) : (
                       <span className="text-[12px] font-normal text-slate-500 bg-[#f9fafb] px-2.5 py-1 border border-slate-200 rounded-[4px]">
                          Starts later
                       </span>
                   )}
                </div>
             </div>
          ))}

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-slate-200 rounded-[4px] bg-slate-50/50">
           <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-lg opacity-40">☕</span>
           </div>
           <h3 className="text-sm font-semibold text-slate-900">No classes scheduled</h3>
           <p className="text-xs text-slate-500 mt-1">There are no live or upcoming sessions for today.</p>
        </div>
      )}
    </div>
  );
};
