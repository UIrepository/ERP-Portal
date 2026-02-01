import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Calendar, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { format, isToday, parse, isBefore, isAfter } from 'date-fns';
import { toast } from 'sonner';
import { generateJitsiRoomName, subjectsMatch } from '@/lib/jitsiUtils';
import { useYoutubeStream } from '@/hooks/useYoutubeStream';

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

export const TeacherJoinClass = () => {
  const { profile, user } = useAuth();
  const { startStream } = useYoutubeStream();
  
  const [selectedClass, setSelectedClass] = useState<Schedule | null>(null);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 1. Fetch Teacher Assignments
  const { data: teacher, isLoading: isLoadingTeacher } = useQuery<Teacher | null>({
    queryKey: ['teacherAssignments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data } = await supabase.from('teachers').select('id, assigned_batches, assigned_subjects').eq('user_id', profile.user_id).single();
      return data;
    },
    enabled: !!profile?.user_id
  });

  // 2. Fetch Schedules
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['allSchedulesTeacher'],
    queryFn: async () => {
      const { data } = await supabase.from('schedules').select('id, subject, batch, day_of_week, start_time, end_time, date');
      return data || [];
    }
  });

  // 3. Filter Schedules
  const todaysClasses = useMemo(() => {
    if (!schedules || !teacher) return [];
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const assignedBatches = teacher.assigned_batches || [];
    const assignedSubjects = teacher.assigned_subjects || [];
    
    return schedules.filter(schedule => {
      if (!assignedBatches.includes(schedule.batch)) return false;
      if (!assignedSubjects.some(assigned => subjectsMatch(assigned, schedule.subject))) return false;
      if (schedule.date) return isToday(new Date(schedule.date));
      return schedule.day_of_week === todayDayOfWeek;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, teacher]);

  const { liveClasses, upcomingClasses } = useMemo(() => {
    const now = new Date();
    const live: Schedule[] = [];
    const upcoming: Schedule[] = [];
    todaysClasses.forEach(cls => {
      const startTime = parse(cls.start_time, 'HH:mm:ss', now);
      const endTime = parse(cls.end_time, 'HH:mm:ss', now);
      if (isBefore(now, startTime)) upcoming.push(cls); // Treat passed classes as 'upcoming/missed' for list or 'live' if actively teaching
      else live.push(cls); // Simplified logic
    });
    // For simplicity in this view, let's just show everything sorted by time
    return { liveClasses: todaysClasses, upcomingClasses: [] }; 
  }, [todaysClasses]);

  const formatTime = (time: string) => format(parse(time, 'HH:mm:ss', new Date()), 'h:mm a');

  const handleStartClass = async (cls: Schedule) => {
    setSelectedClass(cls);
    setIsGenerating(true);
    
    // A. Generate Jitsi URL
    const roomName = generateJitsiRoomName(cls.batch, cls.subject);
    const url = `https://meet.jit.si/${roomName}`; 
    setMeetingUrl(url);

    // B. Activate Class in DB (This enables the button for students)
    await supabase.from('active_classes').upsert({
         batch: cls.batch,
         subject: cls.subject,
         room_url: url,
         teacher_id: user?.id,
         is_active: true,
         started_at: new Date().toISOString()
    }, { onConflict: 'batch,subject' });

    // C. Get Stream Key
    try {
        const details = await startStream(cls.batch, cls.subject);
        setStreamKey(details?.streamKey || "Key generation failed.");
    } catch (e) {
        console.error(e);
        setStreamKey("Manual Key Required");
    }

    setIsGenerating(false);
    setIsDialogOpen(true);
  };

  const handleJoinMeeting = () => {
    if (meetingUrl) {
        // OPEN IN NEW TAB
        window.open(meetingUrl, '_blank');
        toast.success("Opening Class in New Tab...");
    }
  };

  if (isLoadingTeacher || isLoadingSchedules) return <div className="p-6"><Skeleton className="h-32 w-full" /></div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
      <p className="text-muted-foreground">Today's Schedule • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>

      <div className="space-y-4">
          {liveClasses.map((cls) => (
            <Card key={cls.id} className="border-l-4 border-l-green-500">
              <CardContent className="p-6 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{cls.subject}</h3>
                  <p className="text-sm text-muted-foreground">{cls.batch}</p>
                  <p className="text-xs mt-1">{formatTime(cls.start_time)} - {formatTime(cls.end_time)}</p>
                </div>
                <Button onClick={() => handleStartClass(cls)} className="bg-green-600 hover:bg-green-700">
                   {isGenerating ? "Preparing..." : "Start Class"}
                </Button>
              </CardContent>
            </Card>
          ))}
          {liveClasses.length === 0 && <p className="text-gray-500">No classes scheduled for today.</p>}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="text-green-500" /> Class Ready</DialogTitle>
            <DialogDescription className="text-gray-400">Copy the stream key before joining.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label className="text-xs uppercase text-gray-500 font-bold">YouTube Stream Key</Label>
                <div className="flex items-center gap-2">
                    <Input value={streamKey || ""} readOnly className="bg-black/50 border-gray-700 text-yellow-400 font-mono" />
                    <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(streamKey || ""); toast.success("Copied!"); }}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleJoinMeeting} className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg">
                <ExternalLink className="mr-2 h-4 w-4" /> Open Jitsi (New Tab)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
