import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const ClassSession = () => {
  const { enrollmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attendanceMarked = useRef(false);

  useEffect(() => {
    const verifyAndRedirect = async () => {
      if (authLoading) return;
      if (!user || !profile) { setError("Please log in."); return; }

      try {
        if (!enrollmentId) throw new Error("Invalid link.");

        // 1. Verify Enrollment (UUID check)
        const { data: enrollment } = await supabase.from('user_enrollments')
          .select('user_id, batch_name, subject_name').eq('id', enrollmentId).single();

        if (!enrollment || enrollment.user_id !== user.id) {
          throw new Error("Access Denied. This secure link belongs to another user.");
        }

        // 2. Double Check: Is the class actually active? (Prevents backdoor entry)
        const { data: activeClass } = await (supabase.from('active_classes') as any)
           .select('room_url')
           .eq('batch', enrollment.batch_name)
           .eq('subject', enrollment.subject_name)
           .eq('is_active', true)
           .single();

        if (!activeClass) {
             throw new Error("Class is not live yet. Please wait on the dashboard.");
        }

        // 3. Mark Attendance
        if (!attendanceMarked.current) {
            await supabase.from('class_attendance').upsert({
                user_id: user.id,
                user_name: profile.name || user.email,
                user_role: 'student',
                schedule_id: scheduleId || null,
                batch: enrollment.batch_name,
                subject: enrollment.subject_name,
                class_date: format(new Date(), 'yyyy-MM-dd'),
                joined_at: new Date().toISOString()
            }, { onConflict: 'user_id,schedule_id,class_date' });
            attendanceMarked.current = true;
        }

        // 4. REDIRECT to the Public Jitsi URL (Bypasses 5-min timer)
        // Set name automatically
        const finalUrl = `${(activeClass as any).room_url}#userInfo.displayName="${encodeURIComponent(profile.name || 'Student')}"`;
        window.location.href = finalUrl;

      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      }
    };

    verifyAndRedirect();
  }, [enrollmentId, user, profile, authLoading, scheduleId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-8">{error}</p>
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
