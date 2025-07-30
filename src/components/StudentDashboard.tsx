// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/StudentDashboard.tsx
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useMemo } from 'react'; // Added useMemo
import { format } from 'date-fns';

interface StudentDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Define the structure for an enrollment record from the new table
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

export const StudentDashboard = ({ activeTab, onTabChange }: StudentDashboardProps) => {
  const { profile } = useAuth();

  // Fetch user's specific enrollments from the new table for dashboard display
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


  // Note: These analytics queries currently rely on the old batch/subjects columns
  // or may need further refinement/creation of database views/functions
  // to correctly aggregate based on the new user_enrollments table.
  const { data: analyticsData, refetch: refetchAnalytics } = useQuery({
    queryKey: ['student-analytics', profile?.user_id],
    queryFn: async () => {
      if (!profile) return null;

      // These queries still use profile.batch/subjects which are being phased out.
      // For accurate analytics with user_enrollments, you would need to:
      // 1. Fetch user_enrollments first for the user_id.
      // 2. Then query DPP/Notes/Recordings using an OR filter for each combination,
      //    or create database views/functions to aggregate.
      // This is a complex refactor beyond this scope but important for future accuracy.
      const [notesResult, recordingsResult, dppResult, feedbackResult] = await Promise.all([
        supabase
          .from('notes')
          .select('*')
          .in('batch', profile.batch || []) // Relies on old profile.batch
          .in('subject', profile.subjects || []), // Relies on old profile.subjects
        supabase
          .from('recordings')
          .select('*')
          .in('batch', profile.batch || []) // Relies on old profile.batch
          .in('subject', profile.subjects || []), // Relies on old profile.subjects
        supabase
          .from('dpp_content')
          .select('*')
          .in('batch', profile.batch || []) // Relies on old profile.batch
          .in('subject', profile.subjects || []), // Relies on old profile.subjects
        supabase
          .from('feedback')
          .select('*')
          .eq('batch', profile.batch) // Relies on old profile.batch
          .eq('submitted_by', profile.user_id)
      ]);

      return {
        totalNotes: notesResult.data?.length || 0,
        totalRecordings: recordingsResult.data?.length || 0,
        totalDPP: dppResult.data?.length || 0,
        feedbackSubmitted: feedbackResult.data?.length || 0
      };
    },
    enabled: !!profile
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

  // Set up real-time subscriptions
  useEffect(() => {
    if (!profile?.user_id) return;

    const activitiesChannel = supabase
      .channel('student-activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_activities',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          refetchActivities();
        }
      )
      .subscribe();

    const analyticsChannel = supabase
      .channel('analytics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes'
        },
        () => {
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
          refetchAnalytics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback'
        },
        () => {
          refetchAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(analyticsChannel);
    };
  }, [profile?.user_id, refetchActivities, refetchAnalytics]);

  // Function to log activities
  const logActivity = async (activityType: string, description: string, metadata?: any) => {
    if (!profile?.user_id) return;
    
    // Note: The batch/subject logging here might not align with new user_enrollments model.
    // Consider updating this to fetch/log specific enrollment combo from user_enrollments.
    await supabase.from('student_activities').insert({
      user_id: profile.user_id,
      activity_type: activityType,
      description,
      metadata
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
  
  // No longer needed to format Array<string | string[]> since availableBatches/Subjects are clean arrays
  // const formatArrayString = (arr: string | string[] | null | undefined) => {
  //   if (!arr) return '';
  //   if (Array.isArray(arr)) {
  //     return arr.map(item => typeof item === 'string' ? item.replace(/"/g, '') : item).join(', ');
  //   }
  //   try {
  //     const parsed = JSON.parse(arr);
  //     if (Array.isArray(parsed)) {
  //       return parsed.map(item => typeof item === 'string' ? item.replace(/"/g, '') : item).join(', ');
  //     }
  //   } catch (e) {
  //     return String(arr).replace(/"/g, '').replace(/[\[\]]/g, '');
  //   }
  //   return String(arr).replace(/"/g, '').replace(/[\[\]]/g, '');
  // };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'schedule':
        return <StudentSchedule />;
      case 'current-class':
        return <StudentCurrentClass onTabChange={onTabChange} />; // Pass onTabChange
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

  const renderDashboardContent = () => (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            {profile?.name}
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            {/* Updated to display batches from user_enrollments */}
            {availableBatches.length > 0 && (
              <div className="text-gray-600">
                <span className="font-medium">Batches:</span> {availableBatches.join(', ')} 
              </div>
            )}
            {/* Updated to display subjects from user_enrollments */}
            {availableSubjects.length > 0 && (
              <div className="text-gray-600">
                <span className="font-medium">Subjects:</span> {availableSubjects.join(', ')}
              </div>
            )}
            {/* Show a message if no enrollments are found */}
            {availableBatches.length === 0 && availableSubjects.length === 0 && !isLoadingEnrollments && (
                <div className="text-gray-600">
                    <span className="font-medium">Enrollments:</span> No batches or subjects assigned.
                </div>
            )}
            {isLoadingEnrollments && (
                <div className="text-gray-600 flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-400"></span>
                    <span className="font-medium">Loading Enrollments...</span>
                </div>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        {/* Note: The queries for these stats still rely on the old profile.batch/subjects.
            For accurate counts with the new user_enrollments model, these would need refactoring. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Notes Downloaded</p>
                  <p className="text-3xl font-semibold text-gray-900">{analyticsData?.totalNotes || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Recordings Watched</p>
                  <p className="text-3xl font-semibold text-gray-900">{analyticsData?.totalRecordings || 0}</p>
                </div>
                <Video className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">DPPs Attempted</p>
                  <p className="text-3xl font-semibold text-gray-900">{analyticsData?.totalDPP || 0}</p>
                </div>
                <Target className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Feedback Submitted</p>
                  <p className="text-3xl font-semibold text-gray-900">{analyticsData?.feedbackSubmitted || 0}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card 
            className="bg-white border border-gray-200 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
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
            className="bg-white border border-gray-200 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
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
            className="bg-white border border-gray-200 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
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
            className="bg-white border border-gray-200 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200" 
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
