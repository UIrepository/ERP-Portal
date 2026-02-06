// src/pages/Index.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { AuthPage } from '@/components/AuthPage';
import { Layout } from '@/components/Layout';
import { StudentDashboard } from '@/components/StudentDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { TeacherDashboard } from '@/components/teacher/TeacherDashboard';
import { ManagerDashboard } from '@/components/manager/ManagerDashboard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MaintenancePage } from '@/components/MaintenancePage';
import { ChatDrawerProvider } from '@/hooks/useChatDrawer';
import { StudentChatbot } from '@/components/student/StudentChatbot';

const Index = () => {
  const { user, loading, profile, resolvedRole } = useAuth();
  const { shouldShowMaintenance, maintenanceMessage, isLoading: maintenanceLoading } = useMaintenanceMode(user?.email ?? undefined);

  const getInitialTab = () => {
    switch (resolvedRole) {
      case 'admin': return 'enrollment-analytics';
      case 'manager': return 'manager-overview';
      case 'teacher': return 'teacher-schedule';
      case 'student': return 'dashboard';
      default: return 'dashboard';
    }
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [resolvedRole]);

  if (loading || maintenanceLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <AuthPage />;
  }

  // Show maintenance page if user is logged in but not verified
  if (shouldShowMaintenance) {
    return <MaintenancePage message={maintenanceMessage} />;
  }

  const renderDashboard = () => {
    switch (resolvedRole) {
      case 'student':
        return <StudentDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      case 'teacher':
        return <TeacherDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      case 'manager':
        return <ManagerDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      case 'admin':
        return <AdminDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      default:
        return (
          <div className="p-6 text-center">
            <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground mt-2">You do not have a valid role.</p>
          </div>
        );
    }
  };

  if (resolvedRole === 'student') {
    return (
      <ChatDrawerProvider>
        <Layout activeTab={activeTab} onTabChange={setActiveTab}>
          {renderDashboard()}
        </Layout>
        <StudentChatbot />
      </ChatDrawerProvider>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderDashboard()}
    </Layout>
  );
};

export default Index;
