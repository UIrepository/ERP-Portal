
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { TeacherSchedule } from './teacher/TeacherSchedule';
import { TeacherFeedback } from './teacher/TeacherFeedback';
import { TeacherBankDetails } from './teacher/TeacherBankDetails';
import { TeacherMeetingLinks } from './teacher/TeacherMeetingLinks';
import { Calendar, MessageSquare, CreditCard, Link } from 'lucide-react';

interface TeacherDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TeacherDashboard = ({ activeTab, onTabChange }: TeacherDashboardProps) => {
  const { profile } = useAuth();

  if (profile?.role !== 'teacher') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have permission to access this page.</p>
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
      case 'bank-details':
        return <TeacherBankDetails />;
      default:
        return renderDashboardContent();
    }
  };

  const renderDashboardContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">👨‍🏫 Teacher Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Welcome, {profile?.name} | Batch: {profile?.batch} | Subjects: {profile?.subjects?.join(', ')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Class Schedule</p>
                <p className="text-2xl font-bold">View Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Link className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Meeting Links</p>
                <p className="text-2xl font-bold">Access Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Student Feedback</p>
                <p className="text-2xl font-bold">Anonymous</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CreditCard className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Bank Details</p>
                <p className="text-2xl font-bold">Update</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {renderTabContent()}
    </div>
  );
};
