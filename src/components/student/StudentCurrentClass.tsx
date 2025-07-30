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
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Current Class</h2>
          <p className="text-gray-600">Join your ongoing class session</p>
        </div>

        {ongoingClass ? (
          <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-800 font-semibold text-lg">Live Class in Progress</span>
              </div>
              
              <h3 className="text-3xl font-bold text-green-900 mb-2">
                {ongoingClass.subject}
              </h3>
              
              <div className="flex items-center justify-center gap-6 mb-6 text-green-700">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">
                    {formatTime(ongoingClass.start_time)} - {formatTime(ongoingClass.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <Badge variant="outline" className="border-green-300 text-green-800">
                    {ongoingClass.batch}
                  </Badge>
                </div>
              </div>

              {ongoingClass.meeting_link ? (
                <Button 
                  onClick={() => window.open(ongoingClass.meeting_link, '_blank')}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                  size="lg"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Join Class Now
                </Button>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">Meeting link not available</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mb-6">
                <Clock className="h-16 w-16 mx-auto text-gray-300" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-600 mb-2">
                No Ongoing Class
              </h3>
              <p className="text-gray-500 mb-6">
                You don't have any classes scheduled right now.
              </p>
              <p className="text-sm text-gray-400">
                Check your schedule for upcoming classes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
