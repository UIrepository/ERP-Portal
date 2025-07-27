import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/AuthPage';
import { Layout } from '@/components/Layout';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'schedule':
        return <div className="p-6">Schedule content coming soon...</div>;
      case 'current-class':
        return <div className="p-6">Current class content coming soon...</div>;
      case 'recordings':
        return <div className="p-6">Recordings content coming soon...</div>;
      case 'notes':
        return <div className="p-6">Notes content coming soon...</div>;
      case 'feedback':
        return <div className="p-6">Feedback content coming soon...</div>;
      case 'exams':
        return <div className="p-6">Exams content coming soon...</div>;
      case 'extra-classes':
        return <div className="p-6">Extra classes content coming soon...</div>;
      case 'analytics':
        return <div className="p-6">Analytics content coming soon...</div>;
      case 'users':
        return <div className="p-6">Users management coming soon...</div>;
      case 'chat-logs':
        return <div className="p-6">Chat logs coming soon...</div>;
      case 'settings':
        return <div className="p-6">Settings coming soon...</div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout>
      <div className="flex">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
};

export default Index;
