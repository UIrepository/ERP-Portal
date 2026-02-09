import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users, UserCheck, Copy, Loader2, Key, CheckSquare, Square, Merge } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter } from 'date-fns';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateJitsiRoomName, subjectsMatch } from '@/lib/jitsiUtils';
import { useYoutubeStream } from '@/hooks/useYoutubeStream';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date: string | null;
  stream_key?: string | null;
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
  const [activeMeeting, setActiveMeeting] = useState<{
    roomName: string;
    subject: string;
    batch: string;
    scheduleId: string;
  } | null>(null);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<Schedule | null>(null);

  // --- Merge State ---
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);

  // Stream Key Dialog
  const { startStream, isStartingStream } = useYoutubeStream();
  const [streamKey, setStreamKey] = useState<string>("");
  const [showStreamDialog, setShowStreamDialog] = useState(false);
  const [currentClass, setCurrentClass] = useState<Schedule | null>(null);
  
  // Track if we are in a merged session context for the dialog redirection
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

  // Fetch active merges for displaying merged labels
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

  // Helper to get primary pair for consistent Jitsi room naming
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

  // Helper to get merged label for a class
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
      const otherSubject = merge.primary_batch === batch && merge.primary_subject === subject
        ? merge.secondary_subject
        : merge.primary_subject;
      return `${otherSubject} (${otherBatch})`;
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

  // Filter schedules for today
  const todaysClasses = useMemo(() => {
    if (!schedules || !teacher) return [];
    
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const assignedBatches = teacher.assigned_batches || [];
    const assignedSubjects = teacher.assigned_subjects || [];
    
    return schedules.filter(schedule => {
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
  }, [schedules, teacher]);

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

  // --- Selection Logic ---
  const toggleSelection = (id: string) => {
    setSelectedMergeIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // --- Start Single Class ---
  const handleStartClass = async (cls: Schedule) => {
    setCurrentClass(cls);
    setIsMergedSession(false);

    // 1. Mark Attendance
    try {
      if (profile?.user_id) {
        const today = format(new Date(), 'yyyy-MM-dd');
        await supabase.from('class_attendance').upsert({
          user_id: profile.user_id,
          user_name: profile.name || user?.email || 'Teacher',
          user_role: 'teacher',
          schedule_id: cls.id,
          batch: cls.batch,
          subject: cls.subject,
          class_date: today,
          joined_at: new Date().toISOString()
        }, { onConflict: 'user_id,schedule_id,class_date' });

        // IMPORTANT: Update active_classes using primary pair for consistent room naming
        const primary = getPrimaryPair(cls.batch, cls.subject);
        const roomName = generateJitsiRoomName(primary.batch, primary.subject);
        await supabase.from('active_classes').upsert({
          batch: cls.batch,
          subject: cls.subject,
          room_url: `https://meet.jit.si/${encodeURIComponent(roomName)}`,
          teacher_id: profile.user_id,
          is_active: true,
          started_at: new Date().toISOString()
        }, { onConflict: 'batch, subject' }); // Assumed composite key or unique constraint
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

      if (error) {
        console.error("Error saving stream key:", error);
      } else {
        queryClient.invalidateQueries({ queryKey: ['allSchedulesTeacher'] });
      }

      setStreamKey(details.streamKey);
      setShowStreamDialog(true);
    } else {
      toast.error("Could not generate stream key, please try again.");
    }
  };

  // --- Start Merged Class ---
  const handleStartMergedClass = async () => {
    if (selectedMergeIds.length < 2) return;

    setIsMergedSession(true);
    const selectedSchedules = todaysClasses.filter(s => selectedMergeIds.includes(s.id));
    
    // 1. Generate Shared Room Name & URL
    // We use a timestamp to ensure it's a fresh, unique room for this combined session
    const mergedRoomName = `MergedSession-${profile?.id?.slice(0, 4)}-${Date.now()}`;
    const sharedUrl = `https://meet.jit.si/${encodeURIComponent(mergedRoomName)}`;
    setMergedRoomUrl(sharedUrl);

    const firstClass = selectedSchedules[0]; // Used for stream title primarily

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 2. Generate ONE Stream Key for the session
      let activeStreamKey = selectedSchedules.find(s => s.stream_key)?.stream_key;
      
      if (!activeStreamKey) {
          const details = await startStream("Merged Session", selectedSchedules.map(s => s.subject).join(' & '));
          if (details?.streamKey) {
            activeStreamKey = details.streamKey;
          }
      }

      setStreamKey(activeStreamKey || "");

      // 3. Update Database for ALL selected classes
      for (const cls of selectedSchedules) {
        // A. Upsert Active Class (The most important part for redirecting students)
        await supabase.from('active_classes').upsert({
           batch: cls.batch,
           subject: cls.subject,
           room_url: sharedUrl, // All batches point to SAME URL
           teacher_id: profile?.user_id,
           is_active: true,
           started_at: new Date().toISOString()
        });

        // B. Mark Teacher Attendance in all logs
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

        // C. Save the shared stream key to all schedules
        if (activeStreamKey) {
           await supabase.from('schedules').update({ stream_key: activeStreamKey }).eq('id', cls.id);
        }
      }

      // Refresh UI
      queryClient.invalidateQueries({ queryKey: ['allSchedulesTeacher'] });
      setShowStreamDialog(true);
      toast.success(`Merged session started for ${selectedSchedules.length} classes!`);

    } catch (error) {
      console.error("Error starting merged session:", error);
      toast.error("Failed to start merged session.");
    }
  };

  const proceedToMeeting = () => {
    if (isMergedSession) {
      window.open(mergedRoomUrl, '_blank');
    } else if (currentClass) {
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Assignments Found</h3>
            <p className="text-muted-foreground">You don't have any batch assignments yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Join Class</h1>
          <p className="text-muted-foreground">Today's classes • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        
        {/* MERGE BUTTON */}
        {selectedMergeIds.length > 1 && (
           <Button 
             onClick={handleStartMergedClass}
             disabled={isStartingStream}
             className="bg-purple-600 hover:bg-purple-700 text-white animate-in fade-in slide-in-from-right-5"
           >
             <Merge className="mr-2 h-4 w-4" />
             {isStartingStream ? 'Preparing...' : `Start Merged Session (${selectedMergeIds.length})`}
           </Button>
        )}
      </div>

      {/* Render Lists */}
      {[{ title: 'Live Now', data: liveClasses, icon: 'live' }, { title: 'Upcoming Today', data: upcomingClasses, icon: 'upcoming' }].map((section) => (
        section.data.length > 0 && (
        <div key={section.title} className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {section.icon === 'live' ? (
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
               </span>
            ) : <Calendar className="h-5 w-5" />}
            {section.title}
          </h2>
          <div className="grid gap-4">
            {section.data.map((cls) => (
              <Card key={cls.id} className={`${section.icon === 'live' ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      {/* CHECKBOX FOR MERGING */}
                      <div className="pt-1">
                        <Checkbox 
                          id={`select-${cls.id}`}
                          checked={selectedMergeIds.includes(cls.id)}
                          onCheckedChange={() => toggleSelection(cls.id)}
                          className="h-5 w-5"
                        />
                      </div>

                      <div>
                        <h3 className="text-xl font-bold">{cls.subject}</h3>
                        <p className="text-muted-foreground">{cls.batch}</p>
                        {getMergedLabel(cls.batch, cls.subject) && (
                          <Badge variant="outline" className="mt-1 text-purple-700 border-purple-300 bg-purple-50">
                            <Merge className="h-3 w-3 mr-1" />
                            Merged with {getMergedLabel(cls.batch, cls.subject)}
                          </Badge>
                        )}
                        <p className="text-sm mt-2 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                        </p>
                        {cls.stream_key && (
                          <div className="mt-3 flex items-center gap-2 p-2 bg-black/5 rounded-md w-fit border border-black/10">
                            <Key className="h-3 w-3 text-muted-foreground" />
                            <code className="text-xs font-mono text-foreground max-w-[200px] truncate">{cls.stream_key}</code>
                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={(e) => copyExistingKey(cls.stream_key!, e)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSelectedClassForAttendance(cls)}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Attendance
                      </Button>
                      <Button 
                        size="lg" 
                        onClick={() => handleStartClass(cls)}
                        disabled={isStartingStream || selectedMergeIds.length > 1} // Disable individual start if merging
                        className={`${section.icon === 'live' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      >
                        {isStartingStream ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Video className="mr-2 h-5 w-5" />}
                        {cls.stream_key ? 'Resume Class' : 'Start Class'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        )
      ))}

      {/* Completed Classes (No merge selection typically needed here) */}
      {completedClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Completed</h2>
          <div className="grid gap-4">
            {completedClasses.map((cls) => (
              <Card key={cls.id} className="opacity-60">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{cls.subject}</h3>
                      <p className="text-muted-foreground text-sm">{cls.batch}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSelectedClassForAttendance(cls)}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        View Attendance
                      </Button>
                      <Badge variant="outline">Completed</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No Classes Today */}
      {todaysClasses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Classes Today</h3>
            <p className="text-muted-foreground text-center mt-2">
              You don't have any scheduled classes for today.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={showStreamDialog} onOpenChange={setShowStreamDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start {isMergedSession ? 'Merged' : ''} Live Stream</DialogTitle>
            <DialogDescription>
              Copy the key below, then paste it into Jitsi via "Start Live Stream".
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">Stream Key</Label>
              <Input id="link" defaultValue={streamKey} readOnly />
            </div>
            <Button type="submit" size="sm" className="px-3" onClick={copyToClipboard}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="default" onClick={proceedToMeeting} className="w-full bg-blue-600 hover:bg-blue-700">
              Go to Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedClassForAttendance && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Attendance - {selectedClassForAttendance.subject} ({selectedClassForAttendance.batch})
            </CardTitle>
            <Button variant="ghost" onClick={() => setSelectedClassForAttendance(null)}>Close</Button>
          </CardHeader>
          <CardContent>
             {/* Existing table code... */}
             {isLoadingAttendance ? <Skeleton className="h-32 w-full" /> : 
              attendance && attendance.length > 0 ? (
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined At</TableHead>
                        <TableHead>Left At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {attendance.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>{r.user_name}</TableCell>
                                <TableCell>{r.user_role}</TableCell>
                                <TableCell>{format(new Date(r.joined_at), 'h:mm a')}</TableCell>
                                <TableCell>{r.left_at ? format(new Date(r.left_at), 'h:mm a') : <Badge className="bg-green-500">In Class</Badge>}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              ) : <p className="text-muted-foreground text-center py-4">No attendees yet.</p>
             }
          </CardContent>
        </Card>
      )}
    </div>
  );
};
