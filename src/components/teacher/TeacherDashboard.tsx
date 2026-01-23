import { useAuth } from '@/hooks/useAuth';
import { TeacherSchedule } from './TeacherSchedule';
import { TeacherRecordings } from './TeacherRecordings';
import { TeacherScheduleRequests } from './TeacherScheduleRequests';
import { StaffInbox } from '@/components/shared/StaffInbox';
import { TeacherFeedbackViewer } from './TeacherFeedbackViewer';
import { TeacherJoinClass } from './TeacherJoinClass';

interface TeacherDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TeacherDashboard = ({ activeTab, onTabChange }: TeacherDashboardProps) => {
  const { profile, resolvedRole } = useAuth();

  if (resolvedRole !== 'teacher') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have teacher permissions.</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'teacher-schedule':
        return <TeacherSchedule />;
      case 'teacher-join-class':
        return <TeacherJoinClass />;
      case 'teacher-recordings':
        return <TeacherRecordings />;
      case 'teacher-schedule-requests':
        return <TeacherScheduleRequests />;
      case 'teacher-messages':
        return <StaffInbox />;
      case 'teacher-feedback':
        return <TeacherFeedbackViewer />;
      default:
        return <TeacherSchedule />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Welcome, {profile?.name}</h1>
        <p className="text-muted-foreground">Teacher Dashboard</p>
      </div>
      {renderTabContent()}
    </div>
  );
};
