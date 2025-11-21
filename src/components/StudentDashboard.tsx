import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StudentSchedule } from './student/StudentSchedule';
import { StudentCurrentClass } from './student/StudentCurrentClass';
import { StudentRecordings } from './student/StudentRecordings';
import { StudentNotes } from './student/StudentNotes';
import { StudentDPP } from './student/StudentDPP';
import { StudentUIKiPadhai } from './student/StudentUIKiPadhai';
import { StudentFeedback } from './student/StudentFeedback';
import { StudentExams } from './student/StudentExams';
import { StudentAnnouncements } from './student/StudentAnnouncements';
import { StudentCommunity } from './student/StudentCommunity'; // 1. Ensure this import exists
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

  // Fetch user's specific enrollments
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['dashboardUserEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) return [];
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.subject_name) || [])).sort();
  }, [userEnrollments]);

  const { data: analyticsData, refetch: refetchAnalytics, isLoading: isLoadingAnalytics } = useQuery<AnalyticsData>({
    queryKey: ['student-analytics', profile?.user_id, userEnrollments],
    queryFn: async () => {
      if (!profile?.user_id || !userEnrollments || userEnrollments.length === 0) {
        return { totalNotes: 0, totalRecordings: 0, totalDPP: 0, feedbackSubmitted: 0 };
      }

      const combinationsFilterString = userEnrollments
        .map(e => `and(batch.eq.${e.batch_name},subject.eq.${e.subject_name})`)
        .join(',');

      const fetchCount = async (tableName: 'notes' | 'recordings' | 'dpp_content') => {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .or(combinationsFilterString);
        return error ? 0 : count || 0;
      };

      const [notesCount, recordingsCount, dppCount] = await Promise.all([
        fetchCount('notes'),
        fetchCount('recordings'),
        fetchCount('dpp_content'),
      ]);

      const { count: feedbackCount } = await supabase
        .from('feedback')
        .select('*', { count: 'exact', head: true })
        .eq('submitted_by', profile.user_id)
        .or(combinationsFilterString);

      return {
        totalNotes: notesCount,
        totalRecordings: recordingsCount,
        totalDPP: dppCount,
        feedbackSubmitted: feedbackCount || 0
      };
    },
    enabled: !!profile?.user_id && !isLoadingEnrollments && userEnrollments && userEnrollments.length > 0,
  });

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

  useEffect(() => {
    if (!profile?.user_id) return;
    const dashboardChannel = supabase
      .channel('dashboard-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_enrollments', filter: `user_id=eq.${profile.user_id}` }, () => {
          queryClient.invalidateQueries({ queryKey: ['dashboardUserEnrollments'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(dashboardChannel); };
  }, [profile?.user_id, queryClient]);

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
      case 'announcements':
        return <StudentAnnouncements />;
      // 2. THIS IS THE CRITICAL PART THAT WAS MISSING OR BROKEN
      case 'community':
        return <StudentCommunity />;
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
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">
            Welcome back, {profile?.name}!
          </h1>
          <p className="text-lg text-gray-500 mt-2">Here's a snapshot of your learning journey today.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="transform hover:-translate-y-1 transition-transform duration-300 ease-in-out bg-gradient-to-br from-blue-100 to-blue-200 border-blue-200 shadow-lg rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Notes Downloaded</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{isDashboardLoading ? <Skeleton className="h-8 w-16 bg-blue-200"/> : analyticsData?.totalNotes || 0}</p>
                </div>
                <div className="p-3 bg-white/50 rounded-full">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="transform hover:-translate-y-1 transition-transform duration-300 ease-in-out bg-gradient-to-br from-green-100 to-green-200 border-green-200 shadow-lg rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Recordings Watched</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{isDashboardLoading ? <Skeleton className="h-8 w-16 bg-green-200"/> : analyticsData?.totalRecordings || 0}</p>
                </div>
                 <div className="p-3 bg-white/50 rounded-full">
                  <Video className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="transform hover:-translate-y-1 transition-transform duration-300 ease-in-out bg-gradient-to-br from-yellow-100 to-yellow-200 border-yellow-200 shadow-lg rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800">DPPs Attempted</p>
                  <p className="text-3xl font-bold text-yellow-900 mt-1">{isDashboardLoading ? <Skeleton className="h-8 w-16 bg-yellow-200"/> : analyticsData?.totalDPP || 0}</p>
                </div>
                 <div className="p-3 bg-white/50 rounded-full">
                  <Target className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="transform hover:-translate-y-1 transition-transform duration-300 ease-in-out bg-gradient-to-br from-rose-100 to-rose-200 border-rose-200 shadow-lg rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-rose-800">Feedback Submitted</p>
                  <p className="text-3xl font-bold text-rose-900 mt-1">{isDashboardLoading ? <Skeleton className="h-8 w-16 bg-rose-200"/> : analyticsData?.feedbackSubmitted || 0}</p>
                </div>
                 <div className="p-3 bg-white/50 rounded-full">
                  <MessageSquare className="h-6 w-6 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-2xl font-semibold text-gray-700 mb-6">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { title: 'Class Schedule', subtitle: 'View your classes', icon: Calendar, tab: 'schedule', color: 'blue' },
            { title: 'Current Class', subtitle: 'Join ongoing class', icon: Clock, tab: 'current-class', color: 'green' },
            { title: 'Recordings', subtitle: 'Watch past lectures', icon: Video, tab: 'recordings', color: 'yellow' },
            { title: 'Notes', subtitle: 'Download materials', icon: FileText, tab: 'notes', color: 'rose' }
          ].map((item, index) => (
            <Card 
              key={index}
              className="group bg-white border border-gray-200 rounded-xl shadow-sm cursor-pointer hover:shadow-xl hover:border-primary/50 transition-all duration-300" 
              onClick={() => {
                logActivity('navigation', `Accessed ${item.title}`);
                onTabChange(item.tab);
              }}
            >
              <CardContent className="p-6 flex items-center gap-5">
                <div className={`p-3 bg-${item.color}-100 rounded-lg`}>
                  <item.icon className={`h-6 w-6 text-${item.color}-600`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-lg">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-white border-gray-200 rounded-xl shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">Recent Activity</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivities && recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{activity.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(activity.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-500">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {renderTabContent()}
    </div>
  );
};
