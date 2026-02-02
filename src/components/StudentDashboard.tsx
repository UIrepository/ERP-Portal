import { useAuth } from '@/hooks/useAuth';
import { StudentMain } from './student/StudentMain';
import { StudentFeedback } from './student/StudentFeedback';
import { StudentExams } from './student/StudentExams';
import { StudentSchedule } from './student/StudentSchedule';

interface StudentDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const StudentDashboard = ({ activeTab, onTabChange }: StudentDashboardProps) => {
  const { profile } = useAuth();

  if (profile?.role !== 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'schedule':
        return <StudentSchedule />;
      case 'feedback':
        return <StudentFeedback />;
      case 'exams':
        return <StudentExams />;
      case 'dashboard':
      default:
        return <StudentMain />;
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      {renderTabContent()}
    </div>
  );
};
