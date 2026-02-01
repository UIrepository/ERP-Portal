import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Calendar, Users, UserCheck } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter } from 'date-fns';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

// 🛑 HELPER INLINED (Fixes Crash)
const normalizeSubject = (subject: string) => {
  return subject.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
};

const subjectsMatch = (s1: string, s2: string) => {
  const n1 = normalizeSubject(s1);
  const n2 = normalizeSubject(s2);
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
};

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

  // 1. Fetch Teacher Data
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

  // 2. Fetch Schedules
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

  // 3. Fetch Attendance
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
    refetchInterval: 5000 
  });

  // 4. Filter Classes (The logic that was crashing)
  const todaysClasses = useMemo(() => {
    if (!schedules || !teacher) return [];
    
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const assignedBatches = teacher.assigned_batches || [];
    const assignedSubjects = teacher.assigned_subjects || [];
    
    return schedules.filter(schedule => {
      if (!assignedBatches.includes(schedule.batch)) return false;
      
      // Use local helper
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
      
      if (isBefore(now, startTime)) upcoming.push(cls);
      else if (isAfter(now, endTime)) completed.push(cls);
      else live.push(cls);
    });

    return { liveClasses, upcomingClasses, completedClasses };
  }, [todaysClasses]);

  const formatTime = (time: string) => format(parse(time, 'HH:mm:ss', new Date()), 'h:mm a');

  // --- ACTIONS ---
  const handleStartClass = async (cls: Schedule) => {
    const secretId = crypto.randomUUID().slice(0, 8);
    const roomName = `UnknownIITians-${cls.subject.replace(/\s+/g, '')}-${secretId}`;

    const { error } = await supabase.from('active_classes').upsert({
        batch: cls.batch,
        subject: cls.subject,
        room_id: roomName,
        teacher_id: profile?.user_id,
        started_at: new Date().toISOString()
    }, { onConflict: 'batch,subject' });

    if (error) {
        toast.error("Failed to activate class session");
        return;
    }

    setActiveMeeting({
      roomName,
      subject: cls.subject,
      batch: cls.batch,
      scheduleId: cls.id
    });
    toast.success("Class Started Securely");
  };

  const handleEndClass = async () => {
    if (!confirm("End the class for everyone?")) return;
    if (activeMeeting) {
        await supabase.from('active_classes').delete().match({ 
            batch: activeMeeting.batch, 
            subject: activeMeeting.subject 
        });
    }
    setActiveMeeting(null);
    queryClient.invalidateQueries({ queryKey: ['classAttendance'] });
  };

  const isLoading = isLoadingTeacher || isLoadingSchedules;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
      </div>
    );
  }

  if (activeMeeting) {
    return (
        <JitsiMeeting
            roomName={activeMeeting.roomName}
            displayName={user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.name || 'Teacher'}
            subject={activeMeeting.subject}
            batch={activeMeeting.batch}
            scheduleId={activeMeeting.scheduleId}
            onClose={handleEndClass}
            userRole="teacher"
            userEmail={user?.email}
        />
    );
  }

  if (!teacher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Assignments Found</h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Teacher Dashboard</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {liveClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Ready to Start
          </h2>
          <div className="grid gap-4">
            {liveClasses.map((cls) => (
              <Card key={cls.id} className="border-green-500 bg-green-900/10">
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
                      <Button variant="outline" onClick={() => setSelectedClassForAttendance(cls)}>
                        <UserCheck className="mr-2 h-4 w-4" /> Attendance
                      </Button>
                      <Button size="lg" onClick={() => handleStartClass(cls)} className="bg-green-600 hover:bg-green-700 font-bold">
                        <Video className="mr-2 h-5 w-5" /> Start Live Class
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {upcomingClasses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
             <Calendar className="h-5 w-5" /> Upcoming Today
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
                    <Badge variant="secondary">Scheduled</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedClassForAttendance && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" /> Attendance
                </CardTitle>
                <Button variant="ghost" onClick={() => setSelectedClassForAttendance(null)}>Close</Button>
              </CardHeader>
              <CardContent className="overflow-y-auto">
                {isLoadingAttendance ? (
                  <Skeleton className="h-32 w-full" />
                ) : attendance && attendance.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {attendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.user_name}</TableCell>
                          <TableCell><Badge variant="outline">{record.user_role}</Badge></TableCell>
                          <TableCell>{format(new Date(record.joined_at), 'h:mm a')}</TableCell>
                          <TableCell>{record.left_at ? <span className="text-red-400">Left at {format(new Date(record.left_at), 'h:mm a')}</span> : <Badge className="bg-green-600">Active</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No attendance records found.</p>
                )}
              </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
};
