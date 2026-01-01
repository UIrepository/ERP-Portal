import { useAuth } from '@/hooks/useAuth';
import { ManagerBatchOverview } from './ManagerBatchOverview';
import { ManagerScheduleRequests } from './ManagerScheduleRequests';
import { ManagerTeachers } from './ManagerTeachers';
import { ManagerStudents } from './ManagerStudents';
import { StaffInbox } from '@/components/shared/StaffInbox'; // <--- NEW IMPORT

interface ManagerDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const ManagerDashboard = ({ activeTab, onTabChange }: ManagerDashboardProps) => {
  const { profile, resolvedRole } = useAuth();

  if (resolvedRole !== 'manager') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have manager permissions.</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'manager-overview':
        return <ManagerBatchOverview />;
      case 'manager-schedule-requests':
        return <ManagerScheduleRequests />;
      case 'manager-teachers':
        return <ManagerTeachers />;
      case 'manager-students':
        return <ManagerStudents />;
      case 'manager-messages': // <--- NEW CASE
        return <StaffInbox />;
      default:
        return <ManagerBatchOverview />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Welcome, {profile?.name}</h1>
        <p className="text-muted-foreground">Manager Dashboard</p>
      </div>
      {renderTabContent()}
    </div>
  );
};
