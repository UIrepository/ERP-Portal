import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';
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
  const [classDetails, setClassDetails] = useState<{
    batch: string;
    subject: string;
  } | null>(null);

  useEffect(() => {
    const verifyAccess = async () => {
      if (authLoading) return;
      
      if (!user || !profile) {
        // Allow some time for auth to settle, but if explicitly not logged in:
        // You might want to redirect to login here
        setError("Please log in to join the class.");
        setVerifying(false);
        return;
      }

      if (!enrollmentId) {
        setError("Invalid meeting link.");
        setVerifying(false);
        return;
      }

      try {
        // SECURITY CHECK: Fetch enrollment and verify it belongs to the current user
        const { data: enrollment, error: fetchError } = await supabase
          .from('user_enrollments')
          .select('user_id, batch_name, subject_name')
          .eq('id', enrollmentId)
          .single();

        if (fetchError || !enrollment) {
          setError("Enrollment verification failed. This link may be invalid.");
          setVerifying(false);
          return;
        }

        // CRITICAL: Ensure the link owner matches the current user
        if (enrollment.user_id !== user.id) {
          setError("Access Denied. This meeting link does not belong to your account.");
          setVerifying(false);
          return;
        }

        setClassDetails({
          batch: enrollment.batch_name,
          subject: enrollment.subject_name
        });
        setVerifying(false);

      } catch (err) {
        console.error("Verification error:", err);
        setError("An unexpected error occurred.");
        setVerifying(false);
      }
    };

    verifyAccess();
  }, [enrollmentId, user, profile, authLoading]);

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

  if (classDetails) {
    return (
      <JitsiMeeting
        roomName={generateJitsiRoomName(classDetails.batch, classDetails.subject)}
        displayName={profile?.name || user?.email || 'Student'}
        subject={classDetails.subject}
        batch={classDetails.batch}
        scheduleId={scheduleId}
        onClose={handleClose}
        userRole="student"
        userEmail={user?.email}
      />
    );
  }

  return null;
};

export default ClassSession;
