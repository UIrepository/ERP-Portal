import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateJitsiRoomName, subjectsMatch } from '@/lib/jitsiUtils';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const ClassSession = () => {
  const { enrollmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');
  
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);
  
  const attendanceMarked = useRef(false);

  useEffect(() => {
    const verifyAndRedirect = async () => {
      if (authLoading) return;
      if (!user || !profile) { setError("Please log in."); setStatus('error'); return; }

      try {
        let batch = '';
        let subject = '';
        let role = 'student';

        // --- TEACHER FLOW ---
        if (enrollmentId === 'teacher-access') {
           if (!scheduleId) throw new Error("Invalid schedule.");
           
           const { data: schedule } = await supabase.from('schedules').select('subject, batch').eq('id', scheduleId).single();
           if (!schedule) throw new Error("Schedule not found.");

           const { data: teacher } = await supabase.from('teachers').select('assigned_batches, assigned_subjects').eq('user_id', user.id).single();
           if (!teacher) throw new Error("Not a teacher.");

           const hasBatch = teacher.assigned_batches?.includes(schedule.batch);
           const hasSubject = teacher.assigned_subjects?.some(s => subjectsMatch(s, schedule.subject));

           if (!hasBatch || !hasSubject) throw new Error("Not assigned to this class.");

           batch = schedule.batch;
           subject = schedule.subject;
           role = 'teacher';
        } 
        // --- STUDENT FLOW ---
        else {
            if (!enrollmentId) throw new Error("Invalid link.");

            const { data: enrollment } = await supabase.from('user_enrollments')
              .select('user_id, batch_name, subject_name').eq('id', enrollmentId).single();

            if (!enrollment || enrollment.user_id !== user.id) {
              throw new Error("Access Denied. Link belongs to another user.");
            }

            batch = enrollment.batch_name;
            subject = enrollment.subject_name;
            role = 'student';
            
            // Double Check: Is teacher ACTUALLY here? (Prevent direct link sharing exploit)
            // Even though dashboard checks, if they copy link and refresh, we check again.
            if (role === 'student' && scheduleId) {
                const today = format(new Date(), 'yyyy-MM-dd');
                const { data: teacherLog } = await supabase.from('class_attendance')
                    .select('id').eq('schedule_id', scheduleId).eq('class_date', today).eq('user_role', 'teacher').limit(1);
                
                if (!teacherLog || teacherLog.length === 0) {
                     throw new Error("Class has not started yet. Please wait on the dashboard.");
                }
            }
        }

        // --- MARK ATTENDANCE ---
        if (!attendanceMarked.current) {
            const today = format(new Date(), 'yyyy-MM-dd');
            const safeScheduleId = scheduleId && scheduleId.trim() !== '' ? scheduleId : null;
            
            await supabase.from('class_attendance').upsert({
                user_id: user.id,
                user_name: profile.name || user.email,
                user_role: role,
                schedule_id: safeScheduleId,
                batch: batch,
                subject: subject,
                class_date: today,
                joined_at: new Date().toISOString()
            }, { onConflict: 'user_id,schedule_id,class_date' });
            
            attendanceMarked.current = true;
        }

        // --- REDIRECT TO JITSI ---
        const roomName = generateJitsiRoomName(batch, subject);
        const displayName = profile.name || user.email || 'Participant';
        const encodedName = encodeURIComponent(displayName);

        // Strict Config for Students
        let configParams = `userInfo.displayName="${encodedName}"&config.prejoinPageEnabled=false`;
        
        if (role === 'student') {
            configParams += `&config.toolbarButtons=['microphone','camera','chat','raisehand','tileview','fullscreen','hangup']`;
            configParams += `&config.disableInviteFunctions=true`;
            configParams += `&config.remoteVideoMenu.disableKick=true`;
        }

        // GO!
        window.location.href = `https://meet.jit.si/${roomName}#${configParams}`;

      } catch (err: any) {
        console.error("Verification error:", err);
        setError(err.message || "An unexpected error occurred.");
        setStatus('error');
      }
    };

    verifyAndRedirect();
  }, [enrollmentId, scheduleId, user, profile, authLoading]);

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-gray-400 max-w-md mb-8">{error}</p>
        <Button onClick={() => navigate('/')} variant="outline">Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
      <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
      <h2 className="text-xl font-semibold">Securely Redirecting...</h2>
    </div>
  );
};

export default ClassSession;
