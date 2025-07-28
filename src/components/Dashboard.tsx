
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AdminDashboard } from './admin/AdminDashboard';
import { TeacherDashboard } from './TeacherDashboard';
import { StudentDashboard } from './StudentDashboard';
import { Loader2 } from 'lucide-react';

export const Dashboard = () => {
  const { profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Please log in to access the dashboard.</p>
      </div>
    );
  }

  // Route to appropriate dashboard based on role
  switch (profile.role) {
    case 'super_admin':
      return <AdminDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
    case 'teacher':
      return <TeacherDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
    case 'student':
      return <StudentDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
    default:
      return (
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-destructive">Invalid Role</h1>
          <p className="text-muted-foreground mt-2">Your account role is not recognized.</p>
        </div>
      );
  }
};
