
import { useAuth } from '@/hooks/useAuth';
import { UserManagement } from './UserManagement';
import { ContentManagement } from './ContentManagement';
import { ScheduleManagement } from './ScheduleManagement';
import { MonitoringDashboard } from './MonitoringDashboard';
import { NotificationCenter } from './NotificationCenter';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AdminStudentManager } from './AdminStudentManager';
import { AdminTeacherManager } from './AdminTeacherManager';
import { AdminBatchAllocation } from './AdminBatchAllocation';
import { AdminMeetingManager } from './AdminMeetingManager';
import { AdminContentUpload } from './AdminContentUpload';
import { AdminFeedbackViewer } from './AdminFeedbackViewer';
import { AdminCustomSections } from './AdminCustomSections';
import { AdminUIKiPadhai } from './AdminUIKiPadhai';
import { Card, CardContent } from '@/components/ui/card';
import { Users, FileText, Calendar, Monitor, Bell, BarChart, UserCheck, Layers, Link, Upload, MessageSquare, Plus, Crown } from 'lucide-react';

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
        <p className="text-muted-foreground mt-2">You don't have permission to access this page.</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'students':
        return <AdminStudentManager />;
      case 'teachers':
        return <AdminTeacherManager />;
      case 'batch-allocation':
        return <AdminBatchAllocation />;
      case 'meeting-manager':
        return <AdminMeetingManager />;
      case 'upload-content':
        return <AdminContentUpload />;
      case 'feedback-viewer':
        return <AdminFeedbackViewer />;
      case 'monitoring':
        return <MonitoringDashboard />;
      case 'custom-sections':
        return <AdminCustomSections />;
      case 'ui-ki-padhai':
        return <AdminUIKiPadhai />;
      default:
        return renderDashboardContent();
    }
  };

  const renderDashboardContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🛡️ Super Admin Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Welcome, {profile?.name} - Full System Control
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Manage Students</p>
                <p className="text-2xl font-bold">All Access</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Manage Teachers</p>
                <p className="text-2xl font-bold">Control</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Layers className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Batch Allocation</p>
                <p className="text-2xl font-bold">Assign</p>
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
                <p className="text-2xl font-bold">Universal</p>
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
