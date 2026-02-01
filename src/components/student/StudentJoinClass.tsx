import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { Loader2, Video, Lock } from 'lucide-react';

export const StudentJoinClass = () => {
  const { profile, session } = useAuth();
  const [activeClass, setActiveClass] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);

  // 1. LISTEN FOR ACTIVE CLASSES
  useEffect(() => {
    const fetchClass = async () => {
        if (!session?.user?.id) return;

        // Get user's enrolled batches first
        const { data: enrollments } = await supabase
            .from('user_enrollments')
            .select('batch_name')
            .eq('user_id', session.user.id);
            
        const myBatches = enrollments?.map(e => e.batch_name) || [];

        if (myBatches.length > 0) {
            // Find active class for my batch
            const { data } = await supabase
                .from('active_classes')
                .select('*')
                .in('batch', myBatches)
                .maybeSingle();
            setActiveClass(data);
        }
        setLoading(false);
    };

    fetchClass();

    // Realtime Updates
    const channel = supabase.channel('public:active_classes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'active_classes' }, 
        () => fetchClass()) // Refresh on any change
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  // 🔴 LIVE STUDENT UI
  if (isJoined && activeClass) {
      return (
          <JitsiMeeting
              roomName={activeClass.room_id} // Uses the Secret ID from DB
              displayName={profile?.name || "Student"}
              subject={activeClass.subject}
              batch={activeClass.batch}
              userRole="student"
              onClose={() => setIsJoined(false)}
          />
      );
  }

  if (loading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;

  if (!activeClass) {
      return (
          <div className="p-6">
              <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="py-12 text-center text-gray-400">
                      <p>No live classes right now.</p>
                      <p className="text-sm">Wait for your teacher to start.</p>
                  </CardContent>
              </Card>
          </div>
      );
  }

  // 🟢 JOIN CARD
  return (
      <div className="p-6">
          <Card className="bg-gradient-to-r from-blue-900 to-indigo-900 border-blue-500 shadow-xl animate-in fade-in">
              <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      Live: {activeClass.subject}
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="mb-4 text-blue-200 text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4" /> Secure Class • {activeClass.batch}
                  </div>
                  <Button 
                    onClick={() => setIsJoined(true)} 
                    className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold"
                  >
                      <Video className="mr-2 w-5 h-5" /> Join Class Now
                  </Button>
              </CardContent>
          </Card>
      </div>
  );
};
