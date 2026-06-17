import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';
import { useAuth } from '@/hooks/useAuth';
import { useMergedSubjects } from '@/hooks/useMergedSubjects';
import { toast } from 'sonner';
import { StudentBackButton } from './StudentBackButton';

interface MergeRow {
  primary_batch: string;
  primary_subject: string;
  secondary_batch: string;
  secondary_subject: string;
}

interface StudentLiveClassProps {
  batch: string | null;
  subject?: string | null;
  enrolledSubjects?: string[];
  onBack?: () => void;
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

export const StudentLiveClass = ({ batch, subject, enrolledSubjects, onBack }: StudentLiveClassProps) => {
  const { profile, user } = useAuth();
  const { mergedPairs, orFilter, primaryPair } = useMergedSubjects(batch, subject);
  // Pin "today" and the live/upcoming window to IST (Asia/Kolkata = fixed
  // UTC+5:30) so it works regardless of the student's device timezone. Reads the
  // device's absolute clock (assumed time-synced) but interprets the wall clock
  // as IST. Previously this used the browser's local timezone, so a device on a
  // non-IST timezone computed the window in the wrong zone and showed
  // "no live classes" even when one was scheduled and live.
  const IST_OFFSET_MIN = 330;
  const istNow = new Date(Date.now() + IST_OFFSET_MIN * 60000); // read via getUTC* = IST wall clock
  const currentDayOfWeek = istNow.getUTCDay();
  const todayDateStr = istNow.toISOString().slice(0, 10);
  const istMinutesNow = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

  // Fetch all active merges so we can resolve primary pairs for ANY schedule
  const { data: activeMerges = [], isLoading: isMergesLoading } = useQuery<MergeRow[]>({
    queryKey: ['active-merges-for-student-live'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subject_merges').select('primary_batch, primary_subject, secondary_batch, secondary_subject')
        .eq('is_active', true);
      return (data as MergeRow[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Helper: resolve any batch+subject to its deterministic primary pair
  const getPrimaryPair = (b: string, s: string) => {
    const merge = activeMerges.find(m =>
      (m.primary_batch === b && m.primary_subject === s) ||
      (m.secondary_batch === b && m.secondary_subject === s)
    );
    if (!merge) return { batch: b, subject: s };
    const pairs = [
      { batch: merge.primary_batch, subject: merge.primary_subject },
      { batch: merge.secondary_batch, subject: merge.secondary_subject }
    ];
    return pairs.sort((a, bb) =>
      `${a.batch}|${a.subject}`.localeCompare(`${bb.batch}|${bb.subject}`)
    )[0];
  };

  // Fetch schedules logic
  const isBatchLevel = !subject;

  const { data: schedules, isLoading } = useQuery<ScheduleWithLink[]>({
    queryKey: ['studentLiveClass', batch, subject, todayDateStr, orFilter],
    queryFn: async () => {
      if (!batch) return [];

      let allSchedules: any[] = [];
      let allMeetingLinks: any[] = [];
      let allActiveClasses: any[] = [];

      if (isBatchLevel) {
        // Batch-level mode: fetch schedules/links/active classes filtered by enrolled subjects
        const subjectsFilter = enrolledSubjects && enrolledSubjects.length > 0 ? enrolledSubjects : [];
        if (subjectsFilter.length === 0) return [];
        
        const [schedRes, linksRes, activeRes] = await Promise.all([
          supabase.from('schedules').select('*').eq('batch', batch)
            .in('subject', subjectsFilter)
            .or(`day_of_week.eq.${currentDayOfWeek},date.eq.${todayDateStr}`),
          supabase.from('meeting_links').select('*').eq('batch', batch)
            .in('subject', subjectsFilter).eq('is_active', true),
          supabase.from('active_classes').select('*').eq('batch', batch)
            .in('subject', subjectsFilter).eq('is_active', true),
        ]);
        if (schedRes.data) allSchedules = schedRes.data;
        if (linksRes.data) allMeetingLinks = linksRes.data;
        if (activeRes.data) allActiveClasses = activeRes.data;
      } else {
        // Subject-level mode: use merged pairs (existing logic)
        if (!mergedPairs.length) return [];
        for (const pair of mergedPairs) {
          const { data, error } = await supabase
            .from('schedules').select('*')
            .eq('batch', pair.batch).eq('subject', pair.subject)
            .or(`day_of_week.eq.${currentDayOfWeek},date.eq.${todayDateStr}`);
          if (!error && data) allSchedules.push(...data);
        }
        for (const pair of mergedPairs) {
          const { data } = await supabase
            .from('meeting_links').select('*')
            .eq('batch', pair.batch).eq('subject', pair.subject).eq('is_active', true);
          if (data) allMeetingLinks.push(...data);
        }
        for (const pair of mergedPairs) {
          const { data } = await supabase
            .from('active_classes').select('*')
            .eq('batch', pair.batch).eq('subject', pair.subject).eq('is_active', true);
          if (data) allActiveClasses.push(...data);
        }
      }

      const validSchedules = allSchedules.filter(schedule => {
        if (schedule.date) return schedule.date === todayDateStr;
        return schedule.day_of_week === currentDayOfWeek;
      });

      // Deduplicate schedules by time slot (merged batches may have same class)
      const seen = new Set<string>();
      const deduped = validSchedules.filter(schedule => {
        const key = `${schedule.start_time}-${schedule.end_time}-${schedule.subject}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return deduped.map(schedule => {
        const activeJitsi = allActiveClasses?.find(ac => ac.subject === schedule.subject && ac.batch === schedule.batch)
          || allActiveClasses?.find(ac => ac.subject === schedule.subject);
        const subjectLink = allMeetingLinks?.find(l => l.subject === schedule.subject && l.batch === schedule.batch);

        // Always resolve primary pair for consistent room naming (fixes merged batch students landing in different rooms)
        const primary = getPrimaryPair(schedule.batch, schedule.subject);
        const roomBatch = primary.batch;
        const roomSubject = primary.subject;

        const generatedJitsiLink = `https://meet.jit.si/${generateJitsiRoomName(roomBatch, roomSubject)}`;
        const dbLink = activeJitsi?.room_url || schedule.link || subjectLink?.link;

        let finalLink = null;
        if (dbLink) {
          finalLink = dbLink.includes('meet.jit.si') ? generatedJitsiLink : dbLink;
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
    refetchInterval: 20000
  });

  // Logic to separate "Live Now" from "Upcoming" — all compared in IST
  // minutes-of-day so it's independent of the device timezone.
  const liveClasses: ScheduleWithLink[] = [];
  const upcomingClasses: ScheduleWithLink[] = [];

  schedules?.forEach(schedule => {
    const [startHour, startMin] = schedule.start_time.split(':').map(Number);
    const [endHour, endMin] = schedule.end_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Live within a ±15 min buffer around the slot; upcoming if it starts
    // within the next 4 hours.
    if (istMinutesNow >= startMinutes - 15 && istMinutesNow <= endMinutes + 15) {
      liveClasses.push(schedule);
    } else if (istMinutesNow < startMinutes && startMinutes - istMinutesNow < 240) {
      upcomingClasses.push(schedule);
    }
  });

  upcomingClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));

  const handleJoinClass = (item: ScheduleWithLink) => {
    if (!item.meeting_link_url) return;

    if (item.meeting_link_url.includes('meet.jit.si')) {
      // 1. Construct URL object
      const urlObj = new URL(item.meeting_link_url);
      
      // 2. Define restrictions directly here
      const configParams = [
        `config.liveStreamingEnabled=false`,       // Disable Stream
        `config.fileRecordingsEnabled=false`,      // Disable Dropbox/File Recording
        `config.recordingService.enabled=false`,   // Disable backend recording service
        `config.dropbox.enabled=false`,            // Disable Dropbox
        `config.localRecording.enabled=false`,     // Disable Local Recording
        `config.whiteboard.enabled=false`,         // Disable Whiteboard 
        `config.whiteboard.collabServerBaseUrl=''`,// Break whiteboard server connection
        `config.settings.tabs=["devices","profile","sounds"]`, // Modern Settings Tabs Restriction
        `interfaceConfig.SETTINGS_SECTIONS=["devices","profile","sounds"]`, // Legacy Settings Tabs Restriction
        `config.prejoinPageEnabled=false`,         // Skip prejoin
        `config.disableRemoteMute=true`,           // Prevent muting others
        `config.remoteVideoMenu.disableKick=true`, // Prevent kicking others
        `config.remoteVideoMenu.disableGrantModerator=true`, // Prevent granting mod rights
        `userInfo.displayName="${profile?.name || user?.email || 'Student'}"` // Auto-name
      ];

      // 3. Attach config to hash
      urlObj.hash = configParams.join('&');

      // 4. Open in new tab
      window.open(urlObj.toString(), '_blank');
    } else {
      // Zoom/GMeet
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

  if (isLoading || isMergesLoading) {
    return <Skeleton className="h-64 w-full rounded-[4px]" />;
  }

  const allClasses = [...liveClasses, ...upcomingClasses];

  return (
    <div className="w-full font-sans antialiased text-slate-900">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          {onBack && <StudentBackButton onClick={onBack} />}
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
             Live Class Sessions
          </h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">Join your live and upcoming sessions for today.</p>
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
                   {/* Check if teacher is truly live before allowing join */}
                   {item.is_jitsi_live ? (
                     <button 
                       onClick={() => handleJoinClass(item)}
                       className="bg-slate-900 text-white px-4 py-2 text-[12px] font-normal rounded-[4px] hover:bg-slate-800 transition-opacity"
                     >
                       Join Class
                     </button>
                   ) : (
                     <button disabled className="bg-slate-100 text-slate-400 px-4 py-2 text-[12px] font-normal rounded-[4px] cursor-not-allowed border border-slate-200">
                       Waiting for Teacher...
                     </button>
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
