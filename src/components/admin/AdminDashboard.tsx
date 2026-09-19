import { useAuth } from '@/hooks/useAuth';
import { ScheduleManagement } from './ScheduleManagement';
import { MonitoringDashboard } from './MonitoringDashboard';
import { AdminFeedbackViewer } from './AdminFeedbackViewer';
import { AdminFeedbackGate } from './AdminFeedbackGate';
import { WhiteboardHub } from '@/components/whiteboard/WhiteboardHub';
import { EnrollmentAnalytics } from './EnrollmentAnalytics';
import { TeacherAnalytics } from './TeacherAnalytics';
import { AdminCreateAnnouncement } from './AdminCreateAnnouncement';
import { AdminAnnouncementsViewer } from './AdminAnnouncementsViewer';
import { AdminTeacherAnnouncement } from './AdminTeacherAnnouncement';
import { AdminCommunity } from './AdminCommunity';
import { AdminStaffManager } from './AdminStaffManager';
import { StaffInbox } from '@/components/shared/StaffInbox';
import { AdminDirectory } from './AdminDirectory';
import { AdminScheduleRequests } from './AdminScheduleRequests';
import { AdminMaintenanceManager } from './AdminMaintenanceManager';
import { AdminJoinClass } from './AdminJoinClass';
import { AdminJoinActivity } from './AdminJoinActivity';
import { AdminSubjectMerges } from './AdminSubjectMerges';
import { AdminFreePreview } from './AdminFreePreview';

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
      case 'admin-join-activity':
        return <AdminJoinActivity />;
      case 'staff-manager':
        return <AdminStaffManager />;
      case 'teacher-analytics':
        return <TeacherAnalytics />;
      case 'schedules':
        return <ScheduleManagement />;
      case 'feedback-viewer':
        return <AdminFeedbackViewer />;
      case 'feedback-gate':
        return <AdminFeedbackGate />;
      case 'admin-whiteboard':
        return <WhiteboardHub />;
      case 'create-announcement':
        return <AdminCreateAnnouncement />;
      case 'announcement-history':
        return <AdminAnnouncementsViewer />;
      case 'teacher-announcement':
        return <AdminTeacherAnnouncement />;
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
      case 'subject-merges':
        return <AdminSubjectMerges />;
      case 'free-preview':
        return <AdminFreePreview />;
      default:
        return <EnrollmentAnalytics />;
    }
  };

  // Chat-style tabs fill the whole area (their own full-height layout), so they
  // render without the page padding; everything else gets compact mobile padding.
  const fullBleed = activeTab === 'community-admin' || activeTab === 'admin-messages';
  return (
    <div className={fullBleed ? 'max-w-full overflow-x-hidden' : 'p-2 sm:p-4 md:p-6 max-w-full overflow-x-hidden'}>
      {renderTabContent()}
    </div>
  );
};
