import { useAuth } from '@/hooks/useAuth';
import { ScheduleManagement } from './ScheduleManagement';
import { MonitoringDashboard } from './MonitoringDashboard';
import { AdminMeetingManager } from './AdminMeetingManager';
import { AdminFeedbackViewer } from './AdminFeedbackViewer';
import { EnrollmentAnalytics } from './EnrollmentAnalytics';
import { TeacherAnalytics } from './TeacherAnalytics';
import { AdminCreateAnnouncement } from './AdminCreateAnnouncement';
import { AdminAnnouncementsViewer } from './AdminAnnouncementsViewer';
import { AdminCommunity } from './AdminCommunity';
import { AdminStaffManager } from './AdminStaffManager';
import { StaffInbox } from '@/components/shared/StaffInbox';
import { AdminDirectory } from './AdminDirectory';
import { AdminScheduleRequests } from './AdminScheduleRequests';
import { AdminMaintenanceManager } from './AdminMaintenanceManager';
import { AdminJoinClass } from './AdminJoinClass';

interface AdminDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminDashboard = ({ activeTab, onTabChange }: AdminDashboardProps) => {
  const { profile, resolvedRole } = useAuth();

  if (resolvedRole !== 'admin') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please contact administrator for access.</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'enrollment-analytics':
        return <EnrollmentAnalytics />;
      case 'admin-join-class':
        return <AdminJoinClass />;
      case 'staff-manager':
        return <AdminStaffManager />;
      case 'teacher-analytics':
        return <TeacherAnalytics />;
      case 'schedules':
        return <ScheduleManagement />;
      case 'meeting-manager':
        return <AdminMeetingManager />;
      case 'feedback-viewer':
        return <AdminFeedbackViewer />;
      case 'create-announcement':
        return <AdminCreateAnnouncement />;
      case 'announcement-history':
        return <AdminAnnouncementsViewer />;
      case 'community-admin':
        return <AdminCommunity />;
      case 'monitoring':
        return <MonitoringDashboard />;
      case 'admin-messages':
        return <StaffInbox />;
      case 'directory':
        return <AdminDirectory />;
      case 'schedule-requests':
        return <AdminScheduleRequests />;
      case 'maintenance':
        return <AdminMaintenanceManager />;
      default:
        return <EnrollmentAnalytics />;
    }
  };

  return (
    <div className="p-6">
      {renderTabContent()}
    </div>
  );
};
