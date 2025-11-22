import { useAuth } from '@/hooks/useAuth';
import { ScheduleManagement } from './ScheduleManagement';
import { MonitoringDashboard } from './MonitoringDashboard';
import { AdminMeetingManager } from './AdminMeetingManager';
import { AdminFeedbackViewer } from './AdminFeedbackViewer';
import { EnrollmentAnalytics } from './EnrollmentAnalytics';
import { TeacherAnalytics } from './TeacherAnalytics';
import { AdminCreateAnnouncement } from './AdminCreateAnnouncement';
import { AdminAnnouncementsViewer } from './AdminAnnouncementsViewer';
// IMPORT NEW ADMIN COMMUNITY COMPONENT
import { AdminCommunity } from './AdminCommunity';

interface AdminDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminDashboard = ({ activeTab, onTabChange }: AdminDashboardProps) => {
  const { profile } = useAuth();

  if (profile?.role !== 'super_admin') {
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
      // RENDER NEW ADMIN COMMUNITY COMPONENT
      case 'community-admin':
        return <AdminCommunity />;
      case 'monitoring':
        return <MonitoringDashboard />;
      default:
        // Fallback to the first available tab
        return <EnrollmentAnalytics />;
    }
  };

  return (
    <div className="p-6">
      {renderTabContent()}
    </div>
  );
};
