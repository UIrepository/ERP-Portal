import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users, UserCheck, Copy, Loader2 } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter } from 'date-fns';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateJitsiRoomName, subjectsMatch } from '@/lib/jitsiUtils';
import { useYoutubeStream } from '@/hooks/useYoutubeStream';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date: string | null;
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

  // New states for Stream Key Dialog
  const { startStream, isStartingStream } = useYoutubeStream();
  const [streamKey, setStreamKey] = useState<string>("");
  const [showStreamDialog, setShowStreamDialog] = useState(false);
  const [currentClass, setCurrentClass] = useState<Schedule | null>(null);

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
        .select('id, subject, batch, day_of_week, start_time, end_time, date');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch attendance for selected class
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
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Real-time attendance updates
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

  // Filter schedules for today based on teacher's assignments
  const todaysClasses = useMemo(() => {
    if (!schedules || !teacher) return [];
    
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const assignedBatches = teacher.assigned_batches || [];
    const assignedSubjects = teacher.assigned_subjects || [];
    
    return schedules.filter(schedule => {
      // Check if teacher is assigned to this batch
      const isAssignedBatch = assignedBatches.includes(schedule.batch);
      if (!isAssignedBatch) return false;
      
      // Check if teacher is assigned to this subject (using normalized matching)
      const isAssignedSubject = assignedSubjects.some(assigned => 
        subjectsMatch(assigned, schedule.subject)
      );
      if (!isAssignedSubject) return false;
      
      // Check if this schedule is for today
      if (schedule.date) {
        return isToday(new Date(schedule.date));
      } else {
        return schedule.day_of_week === todayDayOfWeek;
      }
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, teacher]);

  // Categorize classes
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

  const handleStartClass = async (cls: Schedule) => {
    setCurrentClass(cls);

    // 1. Mark Attendance Immediately
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
      }
    } catch (e) {
      console.error("Error marking attendance:", e);
    }

    // 2. Fetch Stream Key and Show Modal
    const details = await startStream(cls.batch, cls.subject);
    if (details?.streamKey) {
      setStreamKey(details.streamKey);
      setShowStreamDialog(true);
    } else {
      // If stream fails, allow opening Jitsi anyway? For now, we rely on the dialog flow.
      toast.error("Could not generate stream key, please try again.");
    }
    
    // Legacy: Don't set active meeting to avoid embedded player
    /*
    setActiveMeeting({
      roomName: generateJitsiRoomName(cls.batch, cls.subject),
      subject: cls.subject,
      batch: cls.batch,
      scheduleId: cls.id
    });
    */
  };

  const proceedToMeeting = () => {
    if (!currentClass) return;
    const roomUrl = `https://meet.jit.si/${encodeURIComponent(currentClass.batch)}/${encodeURIComponent(currentClass.subject)}`;
    window.open(roomUrl, '_blank');
    setShowStreamDialog(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(streamKey);
    toast.success("Stream key copied!");
  };

  const isLoading = isLoadingTeacher || isLoadingSchedules;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
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
            <p className="text-muted-foreground text-center mt-2">
              You don't have any batch or subject assignments yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Join Class</h1>
        <p className="text-muted-foreground">Today's classes • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Live Classes */}
      {liveClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Live Now
          </h2>
          <div className="grid gap-4">
            {liveClasses.map((cls) => (
              <Card key={cls.id} className="border-green-500 bg-green-50 dark:bg-green-950">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{cls.subject}</h3>
                      <p className="text-muted-foreground">{cls.batch}</p>
                      <p className="text-sm mt-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => setSelectedClassForAttendance(cls)}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Attendance
                      </Button>
                      <Button 
                        size="lg" 
                        onClick={() => handleStartClass(cls)}
                        disabled={isStartingStream}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isStartingStream ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Video className="mr-2 h-5 w-5" />}
                        Start Class
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Classes */}
      {upcomingClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Today
          </h2>
          <div className="grid gap-4">
            {upcomingClasses.map((cls) => (
              <Card key={cls.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{cls.subject}</h3>
                      <p className="text-muted-foreground text-sm">{cls.batch}</p>
                      <p className="text-sm mt-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    <Badge variant="secondary">Upcoming</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Classes */}
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
                      <p className="text-sm mt-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => setSelectedClassForAttendance(cls)}
                      >
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

      {/* Stream Key Modal for Teachers */}
      <Dialog open={showStreamDialog} onOpenChange={setShowStreamDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start Live Stream</DialogTitle>
            <DialogDescription>
              Copy the key below, then paste it into Jitsi via "Start Live Stream" in the options menu.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">
                Stream Key
              </Label>
              <Input
                id="link"
                defaultValue={streamKey}
                readOnly
              />
            </div>
            <Button type="submit" size="sm" className="px-3" onClick={copyToClipboard}>
              <span className="sr-only">Copy</span>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="default"
              onClick={proceedToMeeting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Go to Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Modal */}
      {selectedClassForAttendance && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Attendance - {selectedClassForAttendance.subject} ({selectedClassForAttendance.batch})
            </CardTitle>
            <Button variant="ghost" onClick={() => setSelectedClassForAttendance(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingAttendance ? (
              <Skeleton className="h-32 w-full" />
            ) : attendance && attendance.length > 0 ? (
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
                  {attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.user_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.user_role}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(record.joined_at), 'h:mm a')}</TableCell>
                      <TableCell>
                        {record.left_at ? format(new Date(record.left_at), 'h:mm a') : 
                          <Badge className="bg-green-500">In Class</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No students have joined yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Jitsi Meeting Overlay (Legacy/Unused) */}
      {activeMeeting && (
        <JitsiMeeting
          roomName={activeMeeting.roomName}
          displayName={user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.name || 'Teacher'}
          subject={activeMeeting.subject}
          batch={activeMeeting.batch}
          scheduleId={activeMeeting.scheduleId}
          onClose={() => setActiveMeeting(null)}
          userRole="teacher"
          userEmail={user?.email}
        />
      )}
    </div>
  );
};
