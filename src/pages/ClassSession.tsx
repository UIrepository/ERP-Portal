import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateJitsiRoomName, subjectsMatch } from '@/lib/jitsiUtils';
import { Loader2, ShieldAlert, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';

const ClassSession = () => {
  const { enrollmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');
  
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  
  // Ref to ensure we don't mark attendance twice in strict mode
  const attendanceMarked = useRef(false);

  useEffect(() => {
    const verifyAndJoin = async () => {
      if (authLoading) return;
      
      if (!user || !profile) {
        setError("Please log in to join the class.");
        setVerifying(false);
        return;
      }

      try {
        let batch = '';
        let subject = '';
        let role = 'student';

        // ---------------------------------------------------------
        // 1. VERIFICATION LOGIC (Secure UUID Check)
        // ---------------------------------------------------------
        
        // --- TEACHER FLOW ---
        if (enrollmentId === 'teacher-access') {
           if (!scheduleId) { setError("Invalid schedule reference."); setVerifying(false); return; }

           const { data: schedule, error: schedError } = await supabase
             .from('schedules').select('subject, batch').eq('id', scheduleId).single();
             
           if (schedError || !schedule) { setError("Schedule not found."); setVerifying(false); return; }

           // Verify Teacher Status
           const { data: teacher, error: teacherError } = await supabase
             .from('teachers').select('assigned_batches, assigned_subjects')
             .eq('user_id', user.id).single();

           if (teacherError || !teacher) { setError("Access Denied: You are not registered as a teacher."); setVerifying(false); return; }

           // Verify Assignment
           const hasBatch = teacher.assigned_batches?.includes(schedule.batch);
           const hasSubject = teacher.assigned_subjects?.some(s => subjectsMatch(s, schedule.subject));

           if (!hasBatch || !hasSubject) { setError(`Access Denied: You are not assigned to ${schedule.subject}.`); setVerifying(false); return; }

           batch = schedule.batch;
           subject = schedule.subject;
           role = 'teacher';
        } 
        // --- STUDENT FLOW ---
        else {
            if (!enrollmentId) { setError("Invalid link."); setVerifying(false); return; }

            // Fetch Enrollment by the UNIQUE UUID in the URL
            const { data: enrollment, error: fetchError } = await supabase
              .from('user_enrollments').select('user_id, batch_name, subject_name')
              .eq('id', enrollmentId).single();

            if (fetchError || !enrollment) { setError("Enrollment verification failed."); setVerifying(false); return; }

            // CRITICAL SECURITY: Does this Enrollment UUID belong to the logged-in user?
            if (enrollment.user_id !== user.id) {
              setError("Access Denied. This secure link belongs to another user.");
              setVerifying(false);
              return;
            }

            batch = enrollment.batch_name;
            subject = enrollment.subject_name;
            role = 'student';
        }

        // ---------------------------------------------------------
        // 2. MARK ATTENDANCE (Before Redirect)
        // ---------------------------------------------------------
        if (!attendanceMarked.current) {
            const today = format(new Date(), 'yyyy-MM-dd');
            const safeScheduleId = scheduleId && scheduleId.trim() !== '' ? scheduleId : null;
            
            // We only mark "Joined At" because we cannot track "Left At" once they leave our domain
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

        // ---------------------------------------------------------
        // 3. CONSTRUCT URL & REDIRECT
        // ---------------------------------------------------------
        setRedirecting(true);
        setVerifying(false);

        const roomName = generateJitsiRoomName(batch, subject);
        const displayName = profile.name || user.email || 'Participant';
        
        // Encode for URL safety
        const encodedName = encodeURIComponent(displayName);

        // This URL opens the OFFICIAL Jitsi Meet (No 5-min timer)
        // #userInfo.displayName sets their name automatically
        // config.prejoinPageEnabled=false skips the "Join Meeting" waiting screen
        const jitsiUrl = `https://meet.jit.si/${roomName}#userInfo.displayName="${encodedName}"&config.prejoinPageEnabled=false`;

        // FORCE REDIRECT
        window.location.href = jitsiUrl;

      } catch (err) {
        console.error("Verification error:", err);
        setError("An unexpected error occurred.");
        setVerifying(false);
      }
    };

    verifyAndJoin();
  }, [enrollmentId, scheduleId, user, profile, authLoading]);

  // ---------------------------------------------------------
  // 4. LOADING STATE (Visible while redirecting)
  // ---------------------------------------------------------
  if (authLoading || verifying || redirecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">
            {redirecting ? "Joining Class..." : "Verifying Secure Access..."}
        </h2>
        <p className="text-gray-400">
            {redirecting ? "Redirecting to Jitsi Meet..." : "Please wait while we validate your credentials."}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 5. ERROR STATE (Visible if UUID is invalid/stolen)
  // ---------------------------------------------------------
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4 text-center">
        <div className="bg-red-500/10 p-6 rounded-full mb-6">
            <ShieldAlert className="h-16 w-16 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Security Check Failed</h1>
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
