import { useAuth } from '@/hooks/useAuth';
import { StudentMain } from './student/StudentMain';
import { StudentJoinClass } from './student/StudentJoinClass';
import { StudentCurrentClass } from './student/StudentCurrentClass';
import { StudentDPP } from './student/StudentDPP';
import { StudentFeedback } from './student/StudentFeedback';
import { StudentExams } from './student/StudentExams';
import { StudentExtraClasses } from './student/StudentExtraClasses';

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
      case 'join-class':
        return <StudentJoinClass />;
      case 'current-class':
        return <StudentCurrentClass onTabChange={onTabChange} />;
      case 'dpp':
        return <StudentDPP />;
      case 'feedback':
        return <StudentFeedback />;
      case 'exams':
        return <StudentExams />;
      case 'extra-classes':
        return <StudentExtraClasses />;
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
