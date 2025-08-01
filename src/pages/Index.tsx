
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/AuthPage';
import { Layout } from '@/components/Layout';
import { Sidebar } from '@/components/Sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { StudentDashboard } from '@/components/StudentDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { Loader2 } from 'lucide-react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

const Index = () => {
  const { user, loading, profile } = useAuth();
  
  // Call the centralized real-time hook
  useRealtimeSync();

  const getInitialTab = () => {
    if (profile?.role === 'super_admin') {
      return 'enrollment-analytics';
    }
    return 'dashboard';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());

  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [profile?.role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderDashboard = () => {
    switch (profile?.role) {
      case 'student':
        return <StudentDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      case 'super_admin':
        return <AdminDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      default:
        // No dashboard for 'teacher' role or other roles.
        return (
          <div className="p-4 sm:p-6 text-center">
            <h1 className="text-xl sm:text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">You do not have a valid role to access the dashboard. Please contact administrator for assistance.</p>
          </div>
        );
    }
  };

  return (
    <Layout>
      <div className="flex h-screen w-full">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <SidebarInset className="flex-1">
          <main className="flex-1 overflow-y-auto">
            {renderDashboard()}
          </main>
        </SidebarInset>
      </div>
    </Layout>
  );
};

export default Index;
