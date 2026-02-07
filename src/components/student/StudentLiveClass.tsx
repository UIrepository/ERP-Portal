import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, isWithinInterval, parseISO, differenceInMinutes } from 'date-fns';
import { ExternalLink, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';

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

      // 3. Get Active Classes
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

      // 5. Map Links
      return validSchedules.map(schedule => {
        const activeJitsi = activeClasses?.find(ac => ac.subject === schedule.subject);
        const subjectLink = meetingLinks?.find(l => l.subject === schedule.subject);
        
        const generatedJitsiLink = `https://meet.jit.si/${generateJitsiRoomName(schedule.batch, schedule.subject)}`;
        const dbLink = activeJitsi?.room_url || schedule.link || subjectLink?.link;

        let finalLink = null;
        if (dbLink) {
          // If DB has a Jitsi link, ensure it matches the dynamic standard
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
          is_jitsi_live: !!activeJitsi
        };
      });
    },
    enabled: !!batch,
    refetchInterval: 10000 
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
    
    // Live: Buffer -15 min start, +15 min end
    const bufferStart = addMinutes(startTime, -15);
    const bufferEnd = addMinutes(endTime, 15);
    
    if (isWithinInterval(now, { start: bufferStart, end: bufferEnd })) {
      liveClasses.push(schedule);
    } 
    // Upcoming: Starts within the next 4 hours
    else if (now < startTime && differenceInMinutes(startTime, now) < 240) {
      upcomingClasses.push(schedule);
    }
  });

  // Sort upcoming by nearest time
  upcomingClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));

  const handleJoinClass = (meetingLink: string | null) => {
    if (meetingLink) {
      window.open(meetingLink, '_blank');
    }
  };

  const formatTimeRange = (start: string, end: string) => {
    const formatSingle = (t: string) => {
      const [h, m] = t.split(':');
      const date = new Date();
      date.setHours(Number(h), Number(m));
      return format(date, 'HH:mm');
    };
    return `${formatSingle(start)} — ${formatSingle(end)}`;
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // If absolutely nothing is happening today
  if (liveClasses.length === 0 && upcomingClasses.length === 0) {
    return (
      <div className="space-y-6">
         <div className="flex items-end justify-between px-2">
            <h2 className="text-4xl font-serif text-slate-800">No Sessions</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest border-b border-transparent pb-1 text-gray-400">
               Relax for now
            </span>
        </div>
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-none p-12 flex flex-col items-center justify-center text-center h-64">
           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
             <Lock className="w-5 h-5 text-slate-300" />
           </div>
           <h3 className="font-serif text-2xl text-slate-400 mb-1">Studio Offline</h3>
           <p className="text-xs font-bold uppercase tracking-widest text-slate-300">No classes scheduled for today</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex items-end justify-between px-1">
        <h2 className="font-serif text-4xl text-slate-900 tracking-tight">Now Playing</h2>
        <a href="#schedule" className="text-[10px] font-bold uppercase tracking-widest border-b border-black pb-1 hover:text-gray-500 hover:border-gray-500 transition-all">
            All Schedules
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: LIVE CLASS (Dark Theme) */}
        {liveClasses.length > 0 ? (
          liveClasses.map((classItem) => (
            <div 
              key={classItem.id}
              className="bg-black text-white rounded-none p-8 flex flex-col justify-between h-72 relative overflow-hidden group hover:shadow-2xl transition-all duration-500"
            >
              {/* Top Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  {/* Animated Bars */}
                  <div className="flex items-end gap-[3px] h-4">
                     <span className="w-1 bg-red-500 h-full animate-[pulse_0.8s_ease-in-out_infinite]"></span>
                     <span className="w-1 bg-red-500 h-2/3 animate-[pulse_1.2s_ease-in-out_infinite_0.1s]"></span>
                     <span className="w-1 bg-red-500 h-1/2 animate-[pulse_1s_ease-in-out_infinite_0.2s]"></span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">
                    Live Session
                  </span>
                </div>
                
                <h3 className="font-serif text-3xl md:text-4xl mb-2 leading-none">
                  {classItem.subject}
                </h3>
                {/* Faculty name removed as requested */}
                <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">
                  {classItem.batch}
                </p>
              </div>

              {/* Bottom Action */}
              <div className="relative z-10 flex items-center justify-between mt-4">
                <span className="text-[11px] font-medium text-gray-400 font-mono">
                  {formatTimeRange(classItem.start_time, classItem.end_time)}
                </span>
                <button 
                  onClick={() => handleJoinClass(classItem.meeting_link_url)}
                  disabled={!classItem.meeting_link_url}
                  className="bg-white text-black px-6 py-3 rounded-none text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-[#d4af37] hover:text-white transition-colors flex items-center gap-2"
                >
                  Enter Room <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              
              {/* Decorative Big Text Background */}
              <span className="absolute -bottom-10 -right-6 text-[140px] font-black text-white/[0.03] select-none pointer-events-none tracking-tighter italic">
                NOW
              </span>
            </div>
          ))
        ) : (
          // Empty State for Live (if only upcoming exists)
          <div className="bg-gray-100 border border-gray-200 rounded-none p-8 flex flex-col justify-between h-72 relative overflow-hidden">
             <div className="relative z-10 opacity-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    Offline
                  </span>
                </div>
                <h3 className="font-serif text-3xl text-gray-400 mb-2">Studio Empty</h3>
                <p className="text-gray-400 text-xs italic">No session currently live.</p>
             </div>
             <span className="absolute -bottom-10 -right-6 text-[140px] font-black text-black/[0.02] select-none pointer-events-none tracking-tighter italic">
                OFF
              </span>
          </div>
        )}

        {/* RIGHT COLUMN: UPCOMING CLASS (Light Theme) */}
        {upcomingClasses.length > 0 ? (
          <div className="bg-white border border-gray-100 rounded-none p-8 flex flex-col justify-between h-72 shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 block mb-6">
                Up Next
              </span>
              <h3 className="font-serif text-3xl mb-2 text-black leading-tight">
                {upcomingClasses[0].subject}
              </h3>
              <p className="text-gray-400 text-xs font-mono uppercase tracking-wider">
                {upcomingClasses[0].batch}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-gray-50 pt-6">
              <div className="flex flex-col">
                 <span className="text-[10px] font-bold uppercase text-gray-400 mb-1">Starts At</span>
                 <span className="text-lg font-serif text-black">
                    {format(new Date().setHours(...(upcomingClasses[0].start_time.split(':').map(Number) as [number, number])), 'h:mm a')}
                 </span>
              </div>
              <div className="w-12 h-12 border border-gray-100 rounded-none flex items-center justify-center text-gray-300 bg-gray-50">
                <Lock className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
           // Placeholder if no upcoming classes either
           <div className="bg-white border border-gray-100 rounded-none p-8 flex flex-col justify-center items-center h-72 text-center opacity-70">
              <div className="w-16 h-1 bg-gray-100 mb-4"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">
                 No upcoming sessions
              </p>
           </div>
        )}

      </div>
    </div>
  );
};
