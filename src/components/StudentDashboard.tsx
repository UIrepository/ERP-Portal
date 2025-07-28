
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
import { Calendar, Clock, Video, FileText, Target, Crown, MessageSquare, BookOpen } from 'lucide-react';

interface StudentDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const StudentDashboard = ({ activeTab, onTabChange }: StudentDashboardProps) => {
  const { profile } = useAuth();

  if (profile?.role !== 'student') {
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
        return <StudentSchedule />;
      case 'current-class':
        return <StudentCurrentClass />;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">📚 Student Dashboard</h1>
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
              <Clock className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Ongoing Class</p>
                <p className="text-2xl font-bold">Join Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Video className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Recordings</p>
                <p className="text-2xl font-bold">Watch</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p className="text-2xl font-bold">Study</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">DPP Section</p>
                <p className="text-2xl font-bold">Practice</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Crown className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">UI Ki Padhai</p>
                <p className="text-2xl font-bold">Premium</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Feedback</p>
                <p className="text-2xl font-bold">Submit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Exams</p>
                <p className="text-2xl font-bold">Upcoming</p>
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
