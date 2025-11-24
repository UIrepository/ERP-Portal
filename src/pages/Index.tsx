// src/pages/Index.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/AuthPage';
import { Layout } from '@/components/Layout';
import { StudentDashboard } from '@/components/StudentDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { LoadingSpinner } from '@/components/LoadingSpinner'; // Import the new component

const Index = () => {
  const { user, loading, profile } = useAuth();

  const getInitialTab = () => {
    if (profile?.role === 'super_admin') {
      return 'enrollment-analytics';
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [profile?.role]);

  if (loading) {
    return <LoadingSpinner />; // Use the new loading spinner
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderDashboard = () => {
    switch (profile?.role) {
      case 'student':
        return <StudentDashboard activeTab={activeTab} onTabChange={setActiveTab} onChatOpenChange={setIsChatOpen} />;
      case 'super_admin':
        return <AdminDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      default:
        return (
          <div className="p-6 text-center">
            <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground mt-2">You do not have a valid role to access the dashboard. Please contact administrator for assistance.</p>
          </div>
        );
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      hideNavOnMobile={isChatOpen}
    >
      {renderDashboard()}
    </Layout>
  );
};

export default Index;
