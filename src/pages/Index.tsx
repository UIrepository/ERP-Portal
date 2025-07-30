// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/pages/Index.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/AuthPage';
import { Layout } from '@/components/Layout';
import { Sidebar } from '@/components/Sidebar';
import { TeacherDashboard } from '@/components/TeacherDashboard';
import { StudentDashboard } from '@/components/StudentDashboard'; // Correctly imported as named export
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading, profile } = useAuth();
  
  const getInitialTab = () => {
    if (profile?.role === 'super_admin') {
      return 'enrollment-analytics';
    }
    return 'dashboard';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());

  useEffect(() => {
    // This effect ensures the active tab is reset when the user's role changes (e.g., after login)
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
      case 'teacher':
        return <TeacherDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      case 'student':
        return <StudentDashboard activeTab={activeTab} onTabChange={setActiveTab} />; // StudentDashboard is rendered here
      case 'super_admin':
        return <AdminDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      default:
        return (
          <div className="p-6 text-center">
            <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground mt-2">Please contact administrator for access.</p>
          </div>
        );
    }
  };

  return (
    <Layout>
      <div className="flex h-screen">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-y-auto">
          {renderDashboard()}
        </main>
      </div>
    </Layout>
  );
};

export default Index;
