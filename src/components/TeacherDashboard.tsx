
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { TeacherSchedule } from './teacher/TeacherSchedule';
import { TeacherMeetingLinks } from './teacher/TeacherMeetingLinks';
import { TeacherFeedback } from './teacher/TeacherFeedback';
import { Calendar, Link, MessageSquare } from 'lucide-react';

interface TeacherDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TeacherDashboard = ({ activeTab }: TeacherDashboardProps) => {
  const { profile } = useAuth();

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
      case 'meeting-links':
        return <TeacherMeetingLinks />;
      case 'feedback':
        return <TeacherFeedback />;
      default:
        return renderDashboardContent();
    }
  };

  const renderDashboardContent = () => (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {profile?.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Batch: {profile?.batch}</p>
          <p className="text-sm text-gray-500">Subjects: {profile?.subjects?.join(', ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Schedule</p>
                <p className="text-xl font-bold text-gray-900">View Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Link className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Meeting Links</p>
                <p className="text-xl font-bold text-gray-900">Access Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Feedback</p>
                <p className="text-xl font-bold text-gray-900">View Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return renderTabContent();
};
