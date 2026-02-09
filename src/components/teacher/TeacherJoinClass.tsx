import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Clock, Key, Copy, Merge, X, Loader2 } from 'lucide-react'; 
import { format, isToday, parse, isBefore, isAfter } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateJitsiRoomName, subjectsMatch } from '@/lib/jitsiUtils';
import { useYoutubeStream } from '@/hooks/useYoutubeStream';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button'; 
import { toast } from 'sonner';

// --- Types ---
interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date: string | null;
  stream_key?: string | null;
  mergedBatches?: { batch: string; subject: string; id: string }[];
}

interface Teacher {
  id: string;
  assigned_batches: string[];
  assigned_subjects: string[];
}

interface Attendance {
  id: string;
  user_name: string;
  user_role: string;
  joined_at: string;
  left_at: string | null;
}

export const TeacherJoinClass = () => {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<Schedule | null>(null);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const { startStream, isStartingStream } = useYoutubeStream();
  const [streamKey, setStreamKey] = useState<string>("");
  const [showStreamDialog, setShowStreamDialog] = useState(false);
  const [currentClass, setCurrentClass] = useState<Schedule | null>(null);
  const [isMergedSession, setIsMergedSession] = useState(false);
  const [mergedRoomUrl, setMergedRoomUrl] = useState<string>("");

  // Fetch teacher's assignments
  const { data: teacher, isLoading: isLoadingTeacher } = useQuery<Teacher | null>({
    queryKey: ['teacherAssignments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data, error } = await supabase
        .from('teachers')
        .select('id, assigned_batches, assigned_subjects')
        .eq('user_id', profile.user_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!profile?.user_id
  });

  // Fetch all schedules
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['allSchedulesTeacher'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, subject, batch, day_of_week, start_time, end_time, date, stream_key');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch active merges
  const { data: activeMerges = [] } = useQuery({
    queryKey: ['active-merges-for-teacher-join'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subject_merges')
        .select('*')
        .eq('is_active', true);
      if (error) return [];
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Helpers
  const getPrimaryPair = useMemo(() => {
    return (batch: string, subject: string) => {
      const merge = activeMerges.find((m: any) =>
        (m.primary_batch === batch && m.primary_subject === subject) ||
        (m.secondary_batch === batch && m.secondary_subject === subject)
      );
      if (!merge) return { batch, subject };
      const pairs = [
        { batch: merge.primary_batch, subject: merge.primary_subject },
        { batch: merge.secondary_batch, subject: merge.secondary_subject }
      ];
      return pairs.sort((a, b) => `${a.batch}|${a.subject}`.localeCompare(`${b.batch}|${b.subject}`))[0];
    };
  }, [activeMerges]);

  const getMergedLabel = useMemo(() => {
    return (batch: string, subject: string) => {
      const merge = activeMerges.find((m: any) =>
        (m.primary_batch === batch && m.primary_subject === subject) ||
        (m.secondary_batch === batch && m.secondary_subject === subject)
      );
      if (!merge) return null;
      const otherBatch = merge.primary_batch === batch && merge.primary_subject === subject
        ? merge.secondary_batch
        : merge.primary_batch;
      return `${
        merge.primary_batch === batch && merge.primary_subject === subject
          ? merge.secondary_subject
          : merge.primary_subject
      } (${otherBatch})`;
    };
  }, [activeMerges]);

  // Fetch attendance
  const { data: attendance, isLoading: isLoadingAttendance } = useQuery<Attendance[]>({
    queryKey: ['classAttendance', selectedClassForAttendance?.id],
    queryFn: async () => {
      if (!selectedClassForAttendance) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('class_attendance')
        .select('id, user_name, user_role, joined_at, left_at')
        .eq('schedule_id', selectedClassForAttendance.id)
        .eq('class_date', today)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClassForAttendance,
    refetchInterval: 10000 
  });

  useEffect(() => {
    if (!selectedClassForAttendance) return;
    const channel = supabase
      .channel('attendance-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'class_attendance' }, 
        () => {
          queryClient.invalidateQueries({ queryKey: ['classAttendance', selectedClassForAttendance.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedClassForAttendance, queryClient]);

  // Filter schedules
  const todaysClasses = useMemo(() => {
    if (!schedules || !teacher) return [];
    
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const assignedBatches = teacher.assigned_batches || [];
    const assignedSubjects = teacher.assigned_subjects || [];
    
    const filtered = schedules.filter(schedule => {
      const isAssignedBatch = assignedBatches.includes(schedule.batch);
      if (!isAssignedBatch) return false;
      
      const isAssignedSubject = assignedSubjects.some(assigned => 
        subjectsMatch(assigned, schedule.subject)
      );
      if (!isAssignedSubject) return false;
      
      if (schedule.date) {
        return isToday(new Date(schedule.date));
      } else {
        return schedule.day_of_week === todayDayOfWeek;
      }
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));

    const deduped: Schedule[] = [];
    const consumed = new Set<string>();

    for (const cls of filtered) {
      if (consumed.has(cls.id)) continue;

      const merge = activeMerges.find((m: any) =>
        (m.primary_batch === cls.batch && m.primary_subject === cls.subject) ||
        (m.secondary_batch === cls.batch && m.secondary_subject === cls.subject)
      );

      if (merge) {
        const partnerBatch = merge.primary_batch === cls.batch && merge.primary_subject === cls.subject
          ? merge.secondary_batch : merge.primary_batch;
        const partnerSubject = merge.primary_batch === cls.batch && merge.primary_subject === cls.subject
          ? merge.secondary_subject : merge.primary_subject;

        const partner = filtered.find(s =>
          !consumed.has(s.id) &&
          s.id !== cls.id &&
          s.batch === partnerBatch &&
          s.subject === partnerSubject &&
          s.start_time === cls.start_time &&
          s.end_time === cls.end_time
        );

        if (partner) {
          consumed.add(partner.id);
          deduped.push({
            ...cls,
            mergedBatches: [
              { batch: cls.batch, subject: cls.subject, id: cls.id },
              { batch: partner.batch, subject: partner.subject, id: partner.id },
            ],
          });
          consumed.add(cls.id);
          continue;
        }
      }

      consumed.add(cls.id);
      deduped.push(cls);
    }

    return deduped;
  }, [schedules, teacher, activeMerges]);

  const { liveClasses, upcomingClasses, completedClasses } = useMemo(() => {
    const now = new Date();
    const live: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const completed: Schedule[] = [];

    todaysClasses.forEach(cls => {
      const startTime = parse(cls.start_time, 'HH:mm:ss', now);
      const endTime = parse(cls.end_time, 'HH:mm:ss', now);
      
      if (isBefore(now, startTime)) {
        upcoming.push(cls);
      } else if (isAfter(now, endTime)) {
        completed.push(cls);
      } else {
        live.push(cls);
      }
    });

    return { liveClasses: live, upcomingClasses: upcoming, completedClasses: completed };
  }, [todaysClasses]);

  const formatTime = (time: string) => {
    const parsed = parse(time, 'HH:mm:ss', new Date());
    return format(parsed, 'h:mm a');
  };

  const toggleSelection = (id: string) => {
    setSelectedMergeIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleStartClass = async (cls: Schedule) => {
    setCurrentClass(cls);
    setIsMergedSession(false);

    const allPairs = cls.mergedBatches
      ? cls.mergedBatches
      : [{ batch: cls.batch, subject: cls.subject, id: cls.id }];

    try {
      if (profile?.user_id) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const primary = getPrimaryPair(cls.batch, cls.subject);
        const roomName = generateJitsiRoomName(primary.batch, primary.subject);
        const roomUrl = `https://meet.jit.si/${encodeURIComponent(roomName)}`;

        for (const pair of allPairs) {
          await supabase.from('class_attendance').upsert({
            user_id: profile.user_id,
            user_name: profile.name || user?.email || 'Teacher',
            user_role: 'teacher',
            schedule_id: pair.id,
            batch: pair.batch,
            subject: pair.subject,
            class_date: today,
            joined_at: new Date().toISOString()
          }, { onConflict: 'user_id,schedule_id,class_date' });

          await supabase.from('active_classes').upsert({
            batch: pair.batch,
            subject: pair.subject,
            room_url: roomUrl,
            teacher_id: profile.user_id,
            is_active: true,
            started_at: new Date().toISOString()
          }, { onConflict: 'batch, subject' });
        }
      }
    } catch (e) {
      console.error("Error marking attendance:", e);
    }

    if (cls.stream_key) {
        setStreamKey(cls.stream_key);
        setShowStreamDialog(true);
        toast.info("Resumed session with existing Stream Key.");
        return;
    }

    const details = await startStream(cls.batch, cls.subject);
    if (details?.streamKey) {
      const { error } = await supabase
        .from('schedules')
        .update({ stream_key: details.streamKey })
        .eq('id', cls.id);

      if (error) { console.error("Error saving stream key:", error); } 
      else { queryClient.invalidateQueries({ queryKey: ['allSchedulesTeacher'] }); }

      setStreamKey(details.streamKey);
      setShowStreamDialog(true);
    } else {
      toast.error("Could not generate stream key, please try again.");
    }
  };

  const handleStartMergedClass = async () => {
    if (selectedMergeIds.length < 2) return;
    setIsMergedSession(true);
    const selectedSchedules = todaysClasses.filter(s => selectedMergeIds.includes(s.id));
    const mergedRoomName = `MergedSession-${profile?.id?.slice(0, 4)}-${Date.now()}`;
    const sharedUrl = `https://meet.jit.si/${encodeURIComponent(mergedRoomName)}`;
    setMergedRoomUrl(sharedUrl);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      let activeStreamKey = selectedSchedules.find(s => s.stream_key)?.stream_key;
      
      if (!activeStreamKey) {
          const details = await startStream("Merged Session", selectedSchedules.map(s => s.subject).join(' & '));
          if (details?.streamKey) { activeStreamKey = details.streamKey; }
      }
      setStreamKey(activeStreamKey || "");

      for (const cls of selectedSchedules) {
        await supabase.from('active_classes').upsert({
           batch: cls.batch,
           subject: cls.subject,
           room_url: sharedUrl,
           teacher_id: profile?.user_id,
           is_active: true,
           started_at: new Date().toISOString()
        });
        if (profile?.user_id) {
           await supabase.from('class_attendance').upsert({
            user_id: profile.user_id,
            user_name: profile.name || 'Teacher',
            user_role: 'teacher',
            schedule_id: cls.id,
            batch: cls.batch,
            subject: cls.subject,
            class_date: today,
            joined_at: new Date().toISOString()
           }, { onConflict: 'user_id,schedule_id,class_date' });
        }
        if (activeStreamKey) {
           await supabase.from('schedules').update({ stream_key: activeStreamKey }).eq('id', cls.id);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['allSchedulesTeacher'] });
      setShowStreamDialog(true);
      toast.success(`Merged session started for ${selectedSchedules.length} classes!`);
    } catch (error) {
      console.error("Error starting merged session:", error);
      toast.error("Failed to start merged session.");
    }
  };

  const proceedToMeeting = () => {
    if (isMergedSession) { window.open(mergedRoomUrl, '_blank'); } 
    else if (currentClass) {
      const primary = getPrimaryPair(currentClass.batch, currentClass.subject);
      const roomName = generateJitsiRoomName(primary.batch, primary.subject);
      const roomUrl = `https://meet.jit.si/${encodeURIComponent(roomName)}`;
      window.open(roomUrl, '_blank');
    }
    setShowStreamDialog(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(streamKey);
    toast.success("Stream key copied!");
  };

  const copyExistingKey = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(key);
    toast.success("Stream key copied!");
  };

  const isLoading = isLoadingTeacher || isLoadingSchedules;

  // --- STYLES (Adjusted for Full Width & Proper Alignment) ---
  const styles = {
    // Removed max-w, extra padding, and background to allow it to fill the Dashboard container naturally
    wrapper: "w-full font-sans text-slate-900", 
    pageHeader: "flex justify-between items-start mb-6",
    headerTitle: "text-2xl font-bold tracking-tight text-slate-900",
    headerDate: "text-sm text-slate-600 mt-1",
    btnMerge: "inline-flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium cursor-pointer bg-slate-100 text-blue-600 border border-slate-300 hover:bg-slate-200 transition-all",
    sectionHeading: "text-xs font-semibold uppercase tracking-wider text-slate-600 mb-4 mt-8 flex items-center gap-2",
    statusIndicator: "w-2 h-2 rounded-full bg-emerald-600",
    classCard: "grid grid-cols-1 md:grid-cols-[40px_1fr_auto] items-center p-6 border border-slate-200 rounded-xl mb-3 hover:border-slate-300 transition-all bg-white shadow-sm",
    activeClassCard: "bg-slate-50 border-l-[3px] border-l-emerald-600",
    checkbox: "w-[18px] h-[18px] cursor-pointer accent-slate-900",
    batchLabel: "text-sm text-slate-600 mb-2 block",
    subjectTitle: "text-base font-semibold text-slate-900",
    metaContainer: "flex items-center gap-4 text-[13px] text-slate-600 mt-1",
    mergeTag: "bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-blue-600",
    streamKeyPill: "inline-flex items-center gap-2 bg-white px-2.5 py-1 border border-slate-200 rounded mt-3 w-fit",
    actionsWrapper: "flex gap-2 w-full md:w-auto mt-4 md:mt-0",
    btn: "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm font-medium cursor-pointer transition-all border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    btnPrimary: "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm font-medium cursor-pointer transition-all border border-slate-900 bg-slate-900 text-white hover:bg-slate-700",
    btnBlue: "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm font-medium cursor-pointer transition-all border border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    dataTableContainer: "mt-12 border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white",
    dataTableHeader: "px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center",
    statusBadge: "text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700"
  };

  if (isLoading) {
    return <div className={styles.wrapper}><div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div></div>;
  }

  return (
    <div className={styles.wrapper}>
      {/* --- HEADER --- */}
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.headerTitle}>Class Management</h1>
          <p className={styles.headerDate}>{format(new Date(), 'EEEE, MMMM dd, yyyy')}</p>
        </div>
        {selectedMergeIds.length > 1 && (
          <button onClick={handleStartMergedClass} className={styles.btnMerge} disabled={isStartingStream}>
            <Merge className="w-4 h-4" />
            {isStartingStream ? 'Preparing...' : 'Initiate Merged Session'}
          </button>
        )}
      </header>

      {/* --- LIVE SESSIONS --- */}
      {liveClasses.length > 0 && (
        <>
          <div className={styles.sectionHeading}>
            <span className={styles.statusIndicator}></span>
            Currently Active
          </div>
          {liveClasses.map((cls) => {
            const mergedLabel = getMergedLabel(cls.batch, cls.subject);
            const isMerged = !!mergedLabel || !!cls.mergedBatches;
            
            return (
              <div key={cls.id} className={`${styles.classCard} ${styles.activeClassCard}`}>
                <div className="hidden md:block">
                  <input 
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={selectedMergeIds.includes(cls.id)}
                    onChange={() => toggleSelection(cls.id)}
                  />
                </div>
                <div className="class-info">
                  <span className={styles.batchLabel}>
                    {cls.mergedBatches 
                      ? cls.mergedBatches.map(m => m.batch).join(' • ') 
                      : cls.batch
                    }
                  </span>
                  <h3 className={styles.subjectTitle}>{cls.subject}</h3>
                  <div className={styles.metaContainer}>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatTime(cls.start_time)} — {formatTime(cls.end_time)}</span>
                    {isMerged && <span className={styles.mergeTag}>{cls.mergedBatches ? 'Merged Class' : `Merged with ${mergedLabel}`}</span>}
                  </div>
                  {cls.stream_key && (
                    <div className={styles.streamKeyPill}>
                      <Key className="w-3 h-3 text-slate-600" />
                      <code className="text-xs text-slate-700 font-mono">{cls.stream_key}</code>
                      <button onClick={(e) => copyExistingKey(cls.stream_key!, e)} className="hover:text-blue-600">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className={styles.actionsWrapper}>
                  <button onClick={() => setSelectedClassForAttendance(cls)} className={styles.btn}>Attendance</button>
                  <button 
                    onClick={() => handleStartClass(cls)}
                    disabled={isStartingStream || selectedMergeIds.length > 1}
                    className={styles.btnBlue}
                  >
                    {isStartingStream ? <Loader2 className="animate-spin w-4 h-4"/> : 'Join Session'}
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* --- UPCOMING SCHEDULE --- */}
      {upcomingClasses.length > 0 && (
        <>
          <div className={styles.sectionHeading}>
             Upcoming Schedule
          </div>
          {upcomingClasses.map((cls) => {
            const mergedLabel = getMergedLabel(cls.batch, cls.subject);
            const isMerged = !!mergedLabel || !!cls.mergedBatches;

            return (
              <div key={cls.id} className={styles.classCard}>
                <div className="hidden md:block">
                  <input 
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={selectedMergeIds.includes(cls.id)}
                    onChange={() => toggleSelection(cls.id)}
                  />
                </div>
                <div className="class-info">
                  <span className={styles.batchLabel}>{cls.batch}</span>
                  <h3 className={styles.subjectTitle}>{cls.subject}</h3>
                  <div className={styles.metaContainer}>
                     <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatTime(cls.start_time)} — {formatTime(cls.end_time)}</span>
                     {isMerged && <span className={styles.mergeTag}>{cls.mergedBatches ? 'Merged Class' : `Merged with ${mergedLabel}`}</span>}
                  </div>
                </div>
                <div className={styles.actionsWrapper}>
                  <button onClick={() => setSelectedClassForAttendance(cls)} className={styles.btn}>Attendance</button>
                  <button 
                    onClick={() => handleStartClass(cls)} 
                    disabled={isStartingStream || selectedMergeIds.length > 1}
                    className={styles.btnPrimary}
                  >
                    Start Class
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* --- COMPLETED --- */}
      {completedClasses.length > 0 && (
        <>
          <div className={`${styles.sectionHeading} opacity-60`}>Completed</div>
          {completedClasses.map((cls) => (
             <div key={cls.id} className={`${styles.classCard} opacity-60 hover:opacity-100`}>
                <div className="hidden md:block"></div>
                <div className="class-info">
                  <span className={styles.batchLabel}>{cls.batch}</span>
                  <h3 className={styles.subjectTitle}>{cls.subject}</h3>
                  <div className={styles.metaContainer}>
                     <span>Completed</span>
                  </div>
                </div>
                <div className={styles.actionsWrapper}>
                  <button onClick={() => setSelectedClassForAttendance(cls)} className={styles.btn}>View Attendance</button>
                </div>
             </div>
          ))}
        </>
      )}

      {/* --- NO CLASSES --- */}
      {todaysClasses.length === 0 && (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl mt-6">
           <h3 className="text-slate-900 font-semibold">No Classes Today</h3>
           <p className="text-slate-600 text-sm mt-2">You don't have any scheduled classes for today.</p>
        </div>
      )}

      {/* --- ATTENDANCE TABLE --- */}
      {selectedClassForAttendance && (
        <div className={styles.dataTableContainer}>
          <div className={styles.dataTableHeader}>
            <h2 className="text-sm font-semibold text-slate-900">
              Active Session Attendance — {selectedClassForAttendance.subject}
            </h2>
            <button 
              onClick={() => setSelectedClassForAttendance(null)} 
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white">
              <TableRow className="border-b border-slate-200 hover:bg-transparent">
                <TableHead className="text-xs font-semibold text-slate-600 px-6 py-3 h-auto">Participant</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 px-6 py-3 h-auto">Role</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 px-6 py-3 h-auto">Joined At</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 px-6 py-3 h-auto">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingAttendance ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">Loading attendance...</TableCell>
                </TableRow>
              ) : attendance && attendance.length > 0 ? (
                attendance.map((r) => (
                  <TableRow key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <TableCell className="px-6 py-3.5 text-sm font-medium text-slate-900">{r.user_name}</TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-slate-600 capitalize">{r.user_role}</TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-slate-600">{format(new Date(r.joined_at), 'h:mm a')}</TableCell>
                    <TableCell className="px-6 py-3.5">
                      {r.left_at ? (
                        <span className="text-[13px] text-slate-500">Left ({format(new Date(r.left_at), 'h:mm a')})</span>
                      ) : (
                        <span className={styles.statusBadge}>Connected</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">No attendees yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {/* --- HIDDEN DIALOGS (Existing Logic) --- */}
      <Dialog open={showStreamDialog} onOpenChange={setShowStreamDialog}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Start {isMergedSession ? 'Merged' : ''} Live Stream</DialogTitle>
            <DialogDescription className="text-slate-500">
              Copy the key below, then paste it into Jitsi via "Start Live Stream".
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">Stream Key</Label>
              <Input id="link" defaultValue={streamKey} readOnly className="bg-slate-50 border-slate-200" />
            </div>
            <Button type="submit" size="sm" className="px-3" onClick={copyToClipboard}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="default" onClick={proceedToMeeting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Go to Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
