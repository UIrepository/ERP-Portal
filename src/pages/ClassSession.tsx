import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { generateJitsiRoomName, subjectsMatch } from '@/lib/jitsiUtils';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ClassSession = () => {
  const { enrollmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');
  
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<{
    batch: string;
    subject: string;
    role: 'student' | 'teacher';
  } | null>(null);

  useEffect(() => {
    const verifyAccess = async () => {
      if (authLoading) return;
      
      if (!user || !profile) {
        setError("Please log in to join the class.");
        setVerifying(false);
        return;
      }

      try {
        // --- TEACHER FLOW ---
        if (enrollmentId === 'teacher-access') {
           if (!scheduleId) {
             setError("Invalid schedule reference.");
             setVerifying(false);
             return;
           }

           const { data: schedule, error: schedError } = await supabase
             .from('schedules')
             .select('subject, batch')
             .eq('id', scheduleId)
             .single();
             
           if (schedError || !schedule) {
             setError("Schedule not found.");
             setVerifying(false);
             return;
           }

           const { data: teacher, error: teacherError } = await supabase
             .from('teachers')
             .select('assigned_batches, assigned_subjects')
             .eq('user_id', user.id)
             .single();

           if (teacherError || !teacher) {
             setError("Access Denied: You are not registered as a teacher.");
             setVerifying(false);
             return;
           }

           // Check Assignments
           const hasBatch = teacher.assigned_batches?.includes(schedule.batch);
           const hasSubject = teacher.assigned_subjects?.some(s => subjectsMatch(s, schedule.subject));

           if (!hasBatch || !hasSubject) {
             setError(`Access Denied: You are not assigned to ${schedule.subject} (${schedule.batch}).`);
             setVerifying(false);
             return;
           }

           setSessionData({
             batch: schedule.batch,
             subject: schedule.subject,
             role: 'teacher'
           });
           setVerifying(false);
           return;
        }

        // --- STUDENT FLOW ---
        if (!enrollmentId) {
            setError("Invalid link.");
            setVerifying(false);
            return;
        }

        // Verify Enrollment Ownership and UUID
        const { data: enrollment, error: fetchError } = await supabase
          .from('user_enrollments')
          .select('user_id, batch_name, subject_name')
          .eq('id', enrollmentId)
          .single();

        if (fetchError || !enrollment) {
          setError("Enrollment verification failed.");
          setVerifying(false);
          return;
        }

        // CRITICAL: Ensure the link matches the current user
        if (enrollment.user_id !== user.id) {
          setError("Access Denied. This meeting link is unique to another user.");
          setVerifying(false);
          return;
        }

        setSessionData({
          batch: enrollment.batch_name,
          subject: enrollment.subject_name,
          role: 'student'
        });
        setVerifying(false);

      } catch (err) {
        console.error("Verification error:", err);
        setError("An unexpected error occurred.");
        setVerifying(false);
      }
    };

    verifyAccess();
  }, [enrollmentId, scheduleId, user, profile, authLoading]);

  const handleClose = () => {
    if (window.opener) {
        window.close();
    } else {
        navigate('/');
    }
  };

  if (authLoading || verifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <p className="text-lg">Verifying secure access...</p>
      </div>
    );
  }

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

  if (sessionData) {
    return (
      <JitsiMeeting
        roomName={generateJitsiRoomName(sessionData.batch, sessionData.subject)}
        displayName={profile?.name || user?.email || (sessionData.role === 'teacher' ? 'Teacher' : 'Student')}
        subject={sessionData.subject}
        batch={sessionData.batch}
        scheduleId={scheduleId}
        onClose={handleClose}
        userRole={sessionData.role}
        userEmail={user?.email}
      />
    );
  }

  return null;
};

export default ClassSession;
