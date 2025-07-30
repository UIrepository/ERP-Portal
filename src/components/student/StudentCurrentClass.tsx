// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentCurrentClass.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useMemo } from 'react'; // Added useMemo

interface OngoingClass {
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
}

// Define the structure for an enrollment record from the new table
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

export const StudentCurrentClass = () => {
  const { profile } = useAuth();

  // 1. Fetch user's specific enrollments from the new table
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  // 2. Fetch ongoing class based on specific enrolled combinations
  const { data: ongoingClass, isLoading: isLoadingOngoingClass } = useQuery<OngoingClass | null>({
    queryKey: ['current-ongoing-class', profile?.user_id, userEnrollments], // Added userEnrollments to queryKey
    queryFn: async (): Promise<OngoingClass | null> => {
      if (!profile?.user_id || !userEnrollments || userEnrollments.length === 0) return null; // Check userEnrollments

      // Get current day and time
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentTime = now.toTimeString().slice(0, 8);

      let query = supabase
        .from('schedules')
        .select(`
          subject,
          batch,
          start_time,
          end_time,
          meeting_links!inner (
            link
          )
        `);

      // Dynamically build OR conditions for each specific enrolled combination
      const combinationFilters = userEnrollments
          .map(enrollment => `(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

      if (combinationFilters.length > 0) {
          query = query.or(combinationFilters.join(','));
      } else {
          return null; // No relevant enrollments, so no class
      }

      query = query
        .eq('day_of_week', currentDay)
        .lte('start_time', currentTime)
        .gte('end_time', currentTime)
        .eq('meeting_links.is_active', true)
        .limit(1);

      const { data: scheduleData, error: scheduleError } = await query;

      if (scheduleError) throw scheduleError;

      if (!scheduleData || scheduleData.length === 0) return null;

      const schedule = scheduleData[0];
      return {
        subject: schedule.subject,
        batch: schedule.batch,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        meeting_link: (schedule.meeting_links as any)?.link || ''
      };
    },
    enabled: !!profile?.user_id && !!userEnrollments && userEnrollments.length > 0, // Enable only if user and enrollments are loaded
    refetchInterval: 30000
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isLoading = isLoadingEnrollments || isLoadingOngoingClass; // Combine loading states

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-lg text-gray-600">Loading class status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-white min-h-screen flex items-center justify-center">
      <div className="max-w-3xl w-full mx-auto text-center">
        
        {ongoingClass ? (
          <Card className="relative p-10 overflow-hidden rounded-3xl shadow-2xl border-none bg-gradient-to-br from-green-500 to-emerald-600 text-white animate-fade-in-up">
            {/* Animated background circles */}
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="w-5 h-5 bg-white rounded-full animate-ping"></div>
                <span className="font-extrabold text-2xl drop-shadow-md">LIVE CLASS IN PROGRESS</span>
              </div>
              
              <h3 className="text-5xl font-bold mb-4 tracking-tight drop-shadow-lg">
                {ongoingClass.subject}
              </h3>
              
              <div className="flex items-center justify-center gap-8 mb-8 text-green-100">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <Clock className="h-6 w-6" />
                  <span>
                    {formatTime(ongoingClass.start_time)} - {formatTime(ongoingClass.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <Calendar className="h-6 w-6" />
                  <span>
                    {ongoingClass.batch}
                  </span>
                </div>
              </div>

              {ongoingClass.meeting_link ? (
                <Button 
                  onClick={() => window.open(ongoingClass.meeting_link, '_blank')}
                  className="bg-white text-green-700 hover:bg-gray-100 hover:text-green-800 px-10 py-4 text-xl font-bold rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95"
                  size="lg"
                >
                  <ExternalLink className="h-6 w-6 mr-3" />
                  Join Class Now
                </Button>
              ) : (
                <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 rounded-lg p-5 mt-6 shadow-md">
                  <p className="text-lg font-medium">Meeting link not available for this session.</p>
                  <p className="text-sm mt-2 opacity-90">Please check your schedule or contact support if this persists.</p>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-12 text-center rounded-3xl shadow-xl border-2 border-dashed border-gray-300 bg-white transform transition-all duration-500 hover:scale-105">
            <div className="mb-8">
              <Clock className="h-20 w-20 mx-auto text-gray-400 animate-fade-in-up" />
            </div>
            <h3 className="text-3xl font-bold text-gray-800 mb-4 animate-fade-in-up animation-delay-200">
              No Ongoing Class Right Now
            </h3>
            <p className="text-gray-600 mb-8 max-w-lg mx-auto animate-fade-in-up animation-delay-400">
              Relax and prepare for your next session. You don't have any classes scheduled at this moment.
            </p>
            <Button size="lg" variant="outline" className="text-primary border-primary hover:bg-primary hover:text-white animate-fade-in-up animation-delay-600">
              <Calendar className="h-5 w-5 mr-2" />
              View Your Full Schedule
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
