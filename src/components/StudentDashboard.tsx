import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { StudentSchedule } from './student/StudentSchedule';
import { StudentCurrentClass } from './student/StudentCurrentClass';
import { StudentRecordings } from './student/StudentRecordings';
import { StudentNotes } from './student/StudentNotes';
import { StudentDPP } from './student/StudentDPP';
import { StudentUIKiPadhai } from './student/StudentUIKiPadhai';
import { StudentFeedback } from './student/StudentFeedback';
import { StudentExams } from './student/StudentExams';
import { FileText, Video, Target, MessageSquare, Calendar, Clock, Crown, BookOpen } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface StudentDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

interface AnalyticsData {
  totalNotes: number;
  totalRecordings: number;
  totalDPP: number;
  feedbackSubmitted: number;
}

export const StudentDashboard = ({ activeTab, onTabChange }: StudentDashboardProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's specific enrollments for dashboard display AND analytics filtering
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['dashboardUserEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching dashboard user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Extract unique batches and subjects from the fetched enrollments for display
  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.subject_name) || [])).sort();
  }, [userEnrollments]);

  // Analytics queries updated to use userEnrollments
  const { data: analyticsData, refetch: refetchAnalytics, isLoading: isLoadingAnalytics } = useQuery<AnalyticsData>({
    queryKey: ['student-analytics', profile?.user_id, userEnrollments],
    queryFn: async () => {
      if (!profile?.user_id || !userEnrollments || userEnrollments.length === 0) {
        return { totalNotes: 0, totalRecordings: 0, totalDPP: 0, feedbackSubmitted: 0 };
      }

      // Build the OR filter for combinations from userEnrollments
      const combinationsFilterString = userEnrollments
        .map(e => `and(batch.eq.${e.batch_name},subject.eq.${e.subject_name})`)
        .join(',');

      // Helper function to fetch count for a table with combination filter
      const fetchCount = async (tableName: 'notes' | 'recordings' | 'dpp_content') => {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .or(combinationsFilterString);

        if (error) {
          console.error(`Error fetching count for ${tableName}:`, error);
          return 0;
        }
        return count || 0;
      };

      const [notesCount, recordingsCount, dppCount] = await Promise.all([
        fetchCount('notes'),
        fetchCount('recordings'),
        fetchCount('dpp_content'),
      ]);

      // For feedback, it's submitted_by user_id AND combination
      const { count: feedbackCount, error: feedbackError } = await supabase
        .from('feedback')
        .select('*', { count: 'exact', head: true })
        .eq('submitted_by', profile.user_id)
        .or(combinationsFilterString);

      if (feedbackError) {
        console.error("Error fetching feedback count:", feedbackError);
        return { totalNotes: notesCount, totalRecordings: recordingsCount, totalDPP: dppCount, feedbackSubmitted: 0 };
      }

      return {
        totalNotes: notesCount,
        totalRecordings: recordingsCount,
        totalDPP: dppCount,
        feedbackSubmitted: feedbackCount || 0
      };
    },
    enabled: !!profile?.user_id && !isLoadingEnrollments && userEnrollments && userEnrollments.length > 0,
  });

  // Fetch recent activities
  const { data: recentActivities, refetch: refetchActivities } = useQuery({
    queryKey: ['student-activities', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      
      const { data } = await supabase
        .from('student_activities')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Set up real-time subscriptions for dashboard data
  useEffect(() => {
    if (!profile?.user_id) return;

    const dashboardChannel = supabase
      .channel('dashboard-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_enrollments',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: user_enrollments changed');
          queryClient.invalidateQueries({ queryKey: ['dashboardUserEnrollments'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_activities',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: student_activities changed');
          refetchActivities();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes'
        },
        () => {
          console.log('Real-time update: notes changed');
          refetchAnalytics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recordings'
        },
        () => {
          console.log('Real-time update: recordings changed');
          refetchAnalytics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dpp_content'
        },
        () => {
          console.log('Real-time update: dpp_content changed');
          refetchAnalytics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback',
          filter: `submitted_by=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: feedback changed');
          refetchAnalytics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: profiles changed');
          queryClient.invalidateQueries({ queryKey: ['dashboardUserEnrollments'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dashboardChannel);
    };
  }, [profile?.user_id, refetchActivities, refetchAnalytics, queryClient]);

  // Function to log activities
  const logActivity = async (activityType: string, description: string, metadata?: any) => {
    if (!profile?.user_id) return;
    
    const loggedBatch = availableBatches.length > 0 ? availableBatches[0] : null;
    const loggedSubject = availableSubjects.length > 0 ? availableSubjects[0] : null;

    await supabase.from('student_activities').insert({
      user_id: profile.user_id,
      activity_type: activityType,
      description,
      metadata,
      batch: loggedBatch,
      subject: loggedSubject,
    });
  };

  if (profile?.role !== 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'schedule':
        return <StudentSchedule />;
      case 'current-class':
        return <StudentCurrentClass onTabChange={onTabChange} />;
      case 'recordings':
        return <StudentRecordings />;
      case 'notes':
        return <StudentNotes />;
      case 'dpp':
        return <StudentDPP />;
      case 'ui-ki-padhai':
        return <StudentUIKiPadhai />;
      case 'feedback':
        return <StudentFeedback />;
      case 'exams':
        return <StudentExams />;
      default:
        return renderDashboardContent();
    }
  };

  const isDashboardLoading = isLoadingEnrollments || isLoadingAnalytics;

  const renderDashboardContent = () => (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            {profile?.name}
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            {isDashboardLoading ? (
                <div className="text-gray-600 flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-400"></span>
                    <span className="font-medium">Loading Enrollments & Stats...</span>
                </div>
            ) : (
                <>
                    {availableBatches.length > 0 && (
                    <div className="text-gray-600">
                        <span className="font-medium">Batches:</span> {availableBatches.join(', ')} 
                    </div>
                    )}
                    {availableSubjects.length > 0 && (
                    <div className="text-gray-600">
                        <span className="font-medium">Subjects:</span> {availableSubjects.join(', ')}
                    </div>
                    )}
                    {availableBatches.length === 0 && availableSubjects.length === 0 && (
                        <div className="text-gray-600">
                            <span className="font-medium">Enrollments:</span> No batches or subjects assigned.
                        </div>
                    )}
                </>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="bg-blue-50 border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Notes Downloaded</p>
                  <p className="text-3xl font-semibold text-gray-900">{isDashboardLoading ? <Skeleton className="h-8 w-16"/> : analyticsData?.totalNotes || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Recordings Watched</p>
                  <p className="text-3xl font-semibold text-gray-900">{isDashboardLoading ? <Skeleton className="h-8 w-16"/> : analyticsData?.totalRecordings || 0}</p>
                </div>
                <Video className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-50 border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">DPPs Attempted</p>
                  <p className="text-3xl font-semibold text-gray-900">{isDashboardLoading ? <Skeleton className="h-8 w-16"/> : analyticsData?.totalDPP || 0}</p>
                </div>
                <Target className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-rose-50 border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Feedback Submitted</p>
                  <p className="text-3xl font-semibold text-gray-900">{isDashboardLoading ? <Skeleton className="h-8 w-16"/> : analyticsData?.feedbackSubmitted || 0}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card 
            className="bg-violet-50 border border-gray-200 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
            onClick={() => {
              logActivity('navigation', 'Accessed class schedule');
              onTabChange('schedule');
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-gray-400 mr-4" />
                <div>
                  <p className="font-medium text-gray-900">Class Schedule</p>
                  <p className="text-sm text-gray-600">View your classes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-sky-50 border border-gray-200 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
            onClick={() => {
              logActivity('navigation', 'Joined current class');
              onTabChange('current-class');
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-gray-400 mr-4" />
                <div>
                  <p className="font-medium text-gray-900">Current Class</p>
                  <p className="text-sm text-gray-600">Join ongoing class</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-teal-50 border border-gray-200 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
            onClick={() => {
              logActivity('navigation', 'Accessed recordings');
              onTabChange('recordings');
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-center">
                <Video className="h-8 w-8 text-gray-400 mr-4" />
                <div>
                  <p className="font-medium text-gray-900">Recordings</p>
                  <p className="text-sm text-gray-600">Watch recordings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-fuchsia-50 border border-gray-200 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
            onClick={() => {
              logActivity('navigation', 'Accessed notes');
              onTabChange('notes');
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-gray-400 mr-4" />
                <div>
                  <p className="font-medium text-gray-900">Notes</p>
                  <p className="text-sm text-gray-600">Download notes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Section */}
        <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivities && recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(activity.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {renderTabContent()}
    </div>
  );
};
