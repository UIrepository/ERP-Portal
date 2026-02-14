import { useEffect } from 'react';
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
import { useParams, useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, loading, profile, resolvedRole } = useAuth();
  const { shouldShowMaintenance, maintenanceMessage, isLoading: maintenanceLoading } = useMaintenanceMode(user?.email ?? undefined);
  
  // Read current tab from URL
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();

  const getInitialTab = () => {
    switch (resolvedRole) {
      case 'admin': return 'enrollment-analytics';
      case 'manager': return 'manager-overview';
      case 'teacher': return 'teacher-schedule';
      case 'student': return 'dashboard';
      default: return 'dashboard';
    }
  };

  // Active tab is either the URL param or the default for the role
  const activeTab = tab || getInitialTab();

  // Function to update URL when Sidebar tab is clicked
  const handleTabChange = (newTab: string) => {
    navigate(`/${newTab}`);
  };

  // Redirect root "/" to the default tab (e.g., /dashboard)
  useEffect(() => {
    if (!loading && user && !tab && resolvedRole) {
      const defaultTab = getInitialTab();
      navigate(`/${defaultTab}`, { replace: true });
    }
  }, [loading, user, tab, resolvedRole, navigate]);

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
        return <StudentDashboard activeTab={activeTab} onTabChange={handleTabChange} />;
      case 'teacher':
        return <TeacherDashboard activeTab={activeTab} onTabChange={handleTabChange} />;
      case 'manager':
        return <ManagerDashboard activeTab={activeTab} onTabChange={handleTabChange} />;
      case 'admin':
        return <AdminDashboard activeTab={activeTab} onTabChange={handleTabChange} />;
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
        <Layout activeTab={activeTab} onTabChange={handleTabChange}>
          {renderDashboard()}
        </Layout>
        <StudentChatbot />
      </ChatDrawerProvider>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {renderDashboard()}
    </Layout>
  );
};

export default Index;
