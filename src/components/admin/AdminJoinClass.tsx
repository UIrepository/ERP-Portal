import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Clock, Calendar, Users, UserCheck, Eye, Filter, FileText, PenLine, ChevronLeft, ChevronRight } from 'lucide-react';
import { ATTENDANCE_ENABLED } from '@/lib/features';
import { format, parse } from 'date-fns';
import { istDayOfWeek, istTodayStr, istMinutesNow, timeToMinutes } from '@/lib/timezone';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';
import { useNavigate } from 'react-router-dom';
import { openInternalRoute } from '@/hooks/useInstallApp';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date: string | null;
}

interface Attendance {
  id: string;
  user_name: string;
  user_role: string;
  joined_at: string;
  left_at: string | null;
  duration_minutes: number | null;
}

// Shift an ISO yyyy-MM-dd date string by `days` (can be negative), staying in
// pure date math so it never drifts across timezones.
const shiftDateStr = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const AdminJoinClass = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeMeeting, setActiveMeeting] = useState<{
    roomName: string;
    subject: string;
    batch: string;
    scheduleId: string;
  } | null>(null);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<Schedule | null>(null);
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  // Date-wise whiteboard browser: which past date's classes we're viewing.
  // Persisted so that opening a board (new tab) and coming back — which can
  // remount this view — restores the chosen date instead of snapping back to the
  // default. Defaults to yesterday (the likely "recover the board I just taught").
  const WB_DATE_KEY = 'admin-wb-browse-date';
  const [wbDate, setWbDate] = useState<string>(() => {
    const fallback = shiftDateStr(istTodayStr(), -1);
    try {
      const saved = localStorage.getItem(WB_DATE_KEY);
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved) && saved <= istTodayStr()) return saved;
    } catch { /* storage blocked — use fallback */ }
    return fallback;
  });
  useEffect(() => {
    try { localStorage.setItem(WB_DATE_KEY, wbDate); } catch { /* ignore */ }
  }, [wbDate]);

  // Fetch all schedules
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['allSchedulesAdmin'],
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
    queryKey: ['classAttendanceAdmin', selectedClassForAttendance?.id],
    queryFn: async () => {
      if (!selectedClassForAttendance) return [];
      const today = istTodayStr();
      const { data, error } = await supabase
        .from('class_attendance')
        .select('id, user_name, user_role, joined_at, left_at, duration_minutes')
        .eq('schedule_id', selectedClassForAttendance.id)
        .eq('class_date', today)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: ATTENDANCE_ENABLED && !!selectedClassForAttendance,
    refetchInterval: 60000 // was 30s (egress)
  });

  // Real-time attendance updates
  useEffect(() => {
    if (!selectedClassForAttendance) return;
    
    const channel = supabase
      .channel('admin-attendance-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'class_attendance' }, 
        () => {
          queryClient.invalidateQueries({ queryKey: ['classAttendanceAdmin', selectedClassForAttendance.id] });
        }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [selectedClassForAttendance, queryClient]);

  // Get unique batches and subjects for filters
  const { batches, subjects } = useMemo(() => {
    if (!schedules) return { batches: [], subjects: [] };
    return {
      batches: Array.from(new Set(schedules.map(s => s.batch))).sort(),
      subjects: Array.from(new Set(schedules.map(s => s.subject))).sort()
    };
  }, [schedules]);

  // Filter schedules for today
  const todaysClasses = useMemo(() => {
    if (!schedules) return [];
    
    const todayDayOfWeek = istDayOfWeek();
    const todayDateStr = istTodayStr();

    return schedules.filter(schedule => {
      // Apply batch filter
      if (batchFilter !== 'all' && schedule.batch !== batchFilter) return false;
      // Apply subject filter
      if (subjectFilter !== 'all' && schedule.subject !== subjectFilter) return false;

      // Check if this schedule is for today (IST)
      if (schedule.date) {
        return schedule.date === todayDateStr;
      } else {
        return schedule.day_of_week === todayDayOfWeek;
      }
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, batchFilter, subjectFilter]);

  // Categorize classes
  const { liveClasses, upcomingClasses, completedClasses } = useMemo(() => {
    const nowMin = istMinutesNow();
    const live: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const completed: Schedule[] = [];

    todaysClasses.forEach(cls => {
      const startMin = timeToMinutes(cls.start_time);
      const endMin = timeToMinutes(cls.end_time);

      if (nowMin < startMin) {
        upcoming.push(cls);
      } else if (nowMin > endMin) {
        completed.push(cls);
      } else {
        live.push(cls);
      }
    });

    return { liveClasses: live, upcomingClasses: upcoming, completedClasses: completed };
  }, [todaysClasses]);

  const todayStr = istTodayStr();

  // Whiteboard browser: all DATED classes held on the chosen date (recurring
  // day-of-week rows share one board and aren't date-specific, so we skip them),
  // honoring the same batch/subject filters. Most useful ordered by time.
  const classesOnDate = useMemo(() => {
    if (!schedules) return [] as Schedule[];
    return schedules
      .filter(s => s.date === wbDate)
      .filter(s => batchFilter === 'all' || s.batch === batchFilter)
      .filter(s => subjectFilter === 'all' || s.subject === subjectFilter)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, wbDate, batchFilter, subjectFilter]);

  // For those classes, find any already SAVED as a Whiteboard PDF note (linked by
  // schedule_id) → schedule_id → Drive PDF url. Saved ones offer "View PDF";
  // unsaved ones open the editable board (its live annotation snapshot is kept),
  // which an admin can then save to recover it into Notes.
  const wbClassIds = useMemo(() => classesOnDate.map(c => c.id), [classesOnDate]);

  const { data: savedWbMap = {} } = useQuery<Record<string, string>>({
    queryKey: ['admin-prev-whiteboard-pdfs', wbClassIds],
    enabled: wbClassIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('schedule_id, file_url')
        .in('schedule_id', wbClassIds)
        .contains('tags', ['Whiteboard']);
      const map: Record<string, string> = {};
      (data || []).forEach((n: { schedule_id: string | null; file_url: string }) => {
        if (n.schedule_id && n.file_url && !map[n.schedule_id]) map[n.schedule_id] = n.file_url;
      });
      return map;
    },
  });

  const formatTime = (time: string) => {
    const parsed = parse(time, 'HH:mm:ss', new Date());
    return format(parsed, 'h:mm a');
  };

  const handleJoinClass = (cls: Schedule) => {
    setActiveMeeting({
      roomName: generateJitsiRoomName(cls.batch, cls.subject),
      subject: cls.subject,
      batch: cls.batch,
      scheduleId: cls.id
    });
  };

  if (isLoadingSchedules) {
    return (
      <div className="p-3 sm:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Classes</h1>
        <p className="text-muted-foreground">Today's classes • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <div className="flex gap-4 flex-wrap">
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map(batch => (
                    <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(subject => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <Video className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{liveClasses.length}</p>
              <p className="text-sm text-muted-foreground">Live Now</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingClasses.length}</p>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-full">
              <Calendar className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedClasses.length}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold">{cls.subject}</h3>
                      <p className="text-muted-foreground">{cls.batch}</p>
                      <p className="text-sm mt-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ATTENDANCE_ENABLED && (
                      <Button
                        variant="outline"
                        onClick={() => setSelectedClassForAttendance(cls)}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Attendance
                      </Button>
                      )}
                      <Button 
                        size="lg" 
                        onClick={() => handleJoinClass(cls)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Eye className="mr-2 h-5 w-5" />
                        Join & Monitor
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
          <div className="grid gap-4 md:grid-cols-2">
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
          <div className="grid gap-4 md:grid-cols-2">
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
                      {ATTENDANCE_ENABLED && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedClassForAttendance(cls)}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Attendance
                      </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Previous Class Whiteboards — browse any past date and reopen/recover its board */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PenLine className="h-5 w-5" />
            Previous Class Whiteboards
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a date to see the classes held that day. Open a board to view its saved PDF, or reopen an
            unsaved one (its annotations are preserved) and save it into Notes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date navigator */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWbDate(d => shiftDateStr(d, -1))}
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={wbDate}
              max={todayStr}
              onChange={(e) => e.target.value && setWbDate(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWbDate(d => (d < todayStr ? shiftDateStr(d, 1) : d))}
              disabled={wbDate >= todayStr}
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground ml-1">
              {format(parse(wbDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d, yyyy')}
            </span>
          </div>

          {classesOnDate.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No dated classes on this day{batchFilter !== 'all' || subjectFilter !== 'all' ? ' for the selected filters' : ''}.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {classesOnDate.map((cls) => {
                const pdf = savedWbMap[cls.id];
                return (
                  <div
                    key={`wb-${cls.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{cls.subject}</h3>
                      <p className="text-sm text-muted-foreground truncate">{cls.batch}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </p>
                    </div>
                    {pdf ? (
                      <a
                        href={pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                        title="Open the saved whiteboard PDF"
                      >
                        <FileText className="h-4 w-4" />
                        View PDF
                      </a>
                    ) : (
                      <button
                        onClick={() => openInternalRoute(`/whiteboard/${cls.id}`, navigate)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-sm font-semibold text-fuchsia-700 transition-colors hover:bg-fuchsia-100 dark:border-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-300"
                        title="Open the whiteboard (annotations preserved) — save to recover it into Notes"
                      >
                        <PenLine className="h-4 w-4" />
                        Open Whiteboard
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* No Classes Today */}
      {todaysClasses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Classes Today</h3>
            <p className="text-muted-foreground text-center mt-2">
              {batchFilter !== 'all' || subjectFilter !== 'all' 
                ? 'No classes match your filters for today.'
                : 'There are no scheduled classes for today.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Attendance Panel */}
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
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined At</TableHead>
                    <TableHead>Left At</TableHead>
                    <TableHead>Duration</TableHead>
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
                      <TableCell>
                        {record.duration_minutes ? `${record.duration_minutes} mins` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No attendance records yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Jitsi Meeting Overlay */}
      {activeMeeting && (
        <JitsiMeeting
          roomName={activeMeeting.roomName}
          displayName={user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.name || 'Admin'}
          subject={activeMeeting.subject}
          batch={activeMeeting.batch}
          scheduleId={activeMeeting.scheduleId}
          onClose={() => setActiveMeeting(null)}
          userRole="admin"
          userEmail={user?.email}
        />
      )}
    </div>
  );
};
