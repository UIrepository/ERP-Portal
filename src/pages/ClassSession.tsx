import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateJitsiRoomName, subjectsMatch } from '@/lib/jitsiUtils';
import { Loader2, ShieldAlert, UserCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const ClassSession = () => {
  const { enrollmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');
  
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'verifying' | 'waiting_for_teacher' | 'redirecting' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);
  
  // To avoid double-firing in React Strict Mode
  const processedRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkTeacherStatusAndJoin = async (batch: string, subject: string, safeScheduleId: string | null) => {
        const today = format(new Date(), 'yyyy-MM-dd');

        // Check if ANY teacher has joined this specific class today
        let query = supabase
            .from('class_attendance')
            .select('id')
            .eq('batch', batch)
            .eq('subject', subject)
            .eq('class_date', today)
            .eq('user_role', 'teacher');
            
        if (safeScheduleId) {
            query = query.eq('schedule_id', safeScheduleId);
        }

        const { data: teacherLog } = await query.limit(1);

        const isTeacherPresent = teacherLog && teacherLog.length > 0;

        if (isTeacherPresent) {
            // Teacher is here! Let the student in.
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            joinJitsi(batch, subject, 'student', safeScheduleId);
        } else {
            // Teacher not found yet. Keep waiting.
            setStatus('waiting_for_teacher');
        }
    };

    const joinJitsi = async (batch: string, subject: string, role: string, safeScheduleId: string | null) => {
        setStatus('redirecting');
        
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            
            // Mark Attendance
            await supabase.from('class_attendance').upsert({
                user_id: user!.id,
                user_name: profile!.name || user!.email,
                user_role: role,
                schedule_id: safeScheduleId,
                batch: batch,
                subject: subject,
                class_date: today,
                joined_at: new Date().toISOString()
            }, { onConflict: 'user_id,schedule_id,class_date' });

            // Construct Jitsi URL
            const roomName = generateJitsiRoomName(batch, subject);
            const displayName = profile!.name || user!.email || 'Participant';
            const encodedName = encodeURIComponent(displayName);

            // Teacher gets standard config
            // Student gets config that HIDES invite buttons and meeting options to reduce confusion
            // Note: On public meet.jit.si, true moderation requires the creator to set a password, 
            // but ensuring the teacher joins FIRST makes them the owner/admin of the session.
            
            let configParams = `userInfo.displayName="${encodedName}"&config.prejoinPageEnabled=false`;
            
            if (role === 'student') {
                // Add strict config for students to limit their UI options
                configParams += `&config.toolbarButtons=['microphone','camera','chat','raisehand','tileview','fullscreen','hangup']`;
                configParams += `&config.disableInviteFunctions=true`;
                configParams += `&config.remoteVideoMenu.disableKick=true`;
            }

            window.location.href = `https://meet.jit.si/${roomName}#${configParams}`;

        } catch (err) {
            console.error("Join Error:", err);
            setError("Failed to join session.");
            setStatus('error');
        }
    };

    const verifyAccess = async () => {
      if (authLoading) return;
      if (!user || !profile) {
        setError("Please log in to join the class.");
        setStatus('error');
        return;
      }

      // Prevent double execution
      if (processedRef.current && status !== 'waiting_for_teacher') return;

      try {
        let batch = '';
        let subject = '';
        let role = 'student';
        const safeScheduleId = scheduleId && scheduleId.trim() !== '' ? scheduleId : null;

        // --- TEACHER VERIFICATION ---
        if (enrollmentId === 'teacher-access') {
           if (!safeScheduleId) throw new Error("Invalid schedule reference.");

           const { data: schedule } = await supabase.from('schedules').select('subject, batch').eq('id', safeScheduleId).single();
           if (!schedule) throw new Error("Schedule not found.");

           const { data: teacher } = await supabase.from('teachers').select('assigned_batches, assigned_subjects').eq('user_id', user.id).single();
           if (!teacher) throw new Error("Access Denied: Not a teacher.");

           const hasBatch = teacher.assigned_batches?.includes(schedule.batch);
           const hasSubject = teacher.assigned_subjects?.some(s => subjectsMatch(s, schedule.subject));

           if (!hasBatch || !hasSubject) throw new Error("Access Denied: Not assigned to this class.");

           // Teacher Logic: Join Immediately (Starts the class)
           processedRef.current = true;
           joinJitsi(schedule.batch, schedule.subject, 'teacher', safeScheduleId);
           return;
        } 
        
        // --- STUDENT VERIFICATION ---
        if (!enrollmentId) throw new Error("Invalid link.");

        const { data: enrollment } = await supabase
            .from('user_enrollments')
            .select('user_id, batch_name, subject_name')
            .eq('id', enrollmentId)
            .single();

        if (!enrollment) throw new Error("Enrollment not found.");
        if (enrollment.user_id !== user.id) throw new Error("Access Denied. Link belongs to another user.");

        batch = enrollment.batch_name;
        subject = enrollment.subject_name;
        
        // Student Logic: Check if Teacher is present
        processedRef.current = true;
        
        // Initial Check
        checkTeacherStatusAndJoin(batch, subject, safeScheduleId);

        // Start Polling (Every 5 seconds)
        pollIntervalRef.current = setInterval(() => {
            checkTeacherStatusAndJoin(batch, subject, safeScheduleId);
        }, 5000);

      } catch (err: any) {
        console.error("Verification error:", err);
        setError(err.message || "An unexpected error occurred.");
        setStatus('error');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    };

    verifyAccess();

    return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [enrollmentId, scheduleId, user, profile, authLoading]);

  // --- RENDER STATES ---

  if (status === 'waiting_for_teacher') {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4">
            <div className="bg-yellow-500/10 p-6 rounded-full mb-6 animate-pulse">
                <Clock className="h-16 w-16 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Waiting for Teacher</h1>
            <p className="text-gray-400 max-w-md text-center mb-8">
                The class hasn't started yet. We will automatically join you once the teacher arrives.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking status...
            </div>
            <Button onClick={() => navigate('/')} variant="ghost" className="mt-8 text-white/50 hover:text-white">
                Return to Dashboard
            </Button>
        </div>
      );
  }

  if (authLoading || status === 'verifying' || status === 'redirecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">
            {status === 'redirecting' ? "Entering Class..." : "Verifying Access..."}
        </h2>
        <p className="text-gray-400">
            {status === 'redirecting' ? "Redirecting to secure meeting room." : "Please wait..."}
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4 text-center">
        <div className="bg-red-500/10 p-6 rounded-full mb-6">
            <ShieldAlert className="h-16 w-16 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-gray-400 max-w-md mb-8">{error}</p>
        <Button onClick={() => navigate('/')} variant="outline" className="text-black dark:text-white">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return null;
};

export default ClassSession;
