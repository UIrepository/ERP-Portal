import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeacherSchedule } from './teacher/TeacherSchedule';
import { TeacherFeedback } from './teacher/TeacherFeedback';
import { TeacherYourClasses } from './teacher/TeacherYourClasses'; // Updated import
import { Calendar, MessageSquare, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface TeacherDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TeacherDashboard = ({ activeTab, onTabChange }: TeacherDashboardProps) => {
  const { profile } = useAuth();

  const { data: todaySchedule } = useQuery({
    queryKey: ['teacher-today-schedule', profile?.id],
    queryFn: async () => {
        if (!profile?.batch || !profile?.subjects) return [];
        const today = new Date().getDay();
        const batches = Array.isArray(profile.batch) ? profile.batch : [profile.batch];

        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .in('batch', batches)
            .in('subject', profile.subjects)
            .eq('day_of_week', today)
            .order('start_time', { ascending: true });

        if (error) throw error;
        return data || [];
    },
    enabled: !!profile,
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  if (profile?.role !== 'teacher') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-gray-600 mt-2">You don't have permission to access this page.</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'schedule':
        return <TeacherSchedule />;
      case 'your-classes': // Changed from 'meeting-links'
        return <TeacherYourClasses />;
      case 'feedback':
        return <TeacherFeedback />;
      default:
        return renderDashboardContent();
    }
  };

  const renderDashboardContent = () => (
    <div className="space-y-8 p-6 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Teacher Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {profile?.name}</p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
            className="bg-white hover:shadow-lg transition-shadow duration-300 cursor-pointer"
            onClick={() => onTabChange('schedule')}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">Full Schedule</p>
                <p className="text-sm text-gray-500">View your weekly classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
            className="bg-white hover:shadow-lg transition-shadow duration-300 cursor-pointer"
            onClick={() => onTabChange('your-classes')} // Changed onClick
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">Your Classes</p>
                <p className="text-sm text-gray-500">View upcoming classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
            className="bg-white hover:shadow-lg transition-shadow duration-300 cursor-pointer"
            onClick={() => onTabChange('feedback')}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">Student Feedback</p>
                <p className="text-sm text-gray-500">Review student responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule Card */}
      <Card className="bg-white">
        <CardHeader>
            <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Today's Classes
            </CardTitle>
        </CardHeader>
        <CardContent>
            {todaySchedule && todaySchedule.length > 0 ? (
                <div className="space-y-4">
                    {todaySchedule.map((cls: any) => (
                        <div key={cls.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-semibold">{cls.subject}</p>
                                <p className="text-sm text-muted-foreground">{formatTime(cls.start_time)} - {formatTime(cls.end_time)}</p>
                            </div>
                            <Badge variant="secondary">{cls.batch}</Badge>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">No classes scheduled for today.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );

  return renderTabContent();
};
