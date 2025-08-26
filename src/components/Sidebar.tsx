// src/components/Sidebar.tsx

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Video,
  FileText,
  Target,
  Crown,
  MessageSquare,
  BookOpen,
  Users,
  UserCheck,
  Layers,
  Link as LinkIcon,
  Upload,
  Plus,
  Monitor,
  BarChart2,
  LogOut,
  Megaphone,
  History // New Icon
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();

  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['sidebarUserEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching sidebar user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.subject_name) || [])).sort();
  }, [userEnrollments]);

  useEffect(() => {
    if (!profile?.user_id) return;
    const channel = supabase
      .channel('sidebar-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_enrollments', filter: `user_id=eq.${profile.user_id}`},
        () => queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${profile.user_id}`},
        () => queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.user_id, queryClient]);

  const studentTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'schedule', label: 'Class Schedule', icon: Calendar },
    { id: 'current-class', label: 'Ongoing Class', icon: Clock },
    { id: 'recordings', label: 'Recordings', icon: Video },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'dpp', label: 'DPP Section', icon: Target },
    { id: 'ui-ki-padhai', label: 'UI Ki Padhai', icon: Crown },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'exams', label: 'Exams', icon: BookOpen },
  ];

  const adminTabs = [
    { id: 'enrollment-analytics', label: 'Student Analytics', icon: BarChart2 },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'meeting-manager', label: 'Meeting Links', icon: LinkIcon },
    { id: 'feedback-viewer', label: 'Feedback Viewer', icon: MessageSquare },
    { id: 'create-announcement', label: 'Create Announcement', icon: Megaphone },
    { id: 'view-announcements', label: 'Sent Announcements', icon: History },
  ];

  const getTabs = () => {
    switch (profile?.role) {
      case 'student': return studentTabs;
      case 'super_admin': return adminTabs;
      default: return [];
    }
  };

  const tabs = getTabs();

  const getPortalName = () => {
     switch (profile?.role) {
      case 'student': return 'Student Portal';
      case 'super_admin': return 'Admin Portal';
      default: return 'Portal';
    }
  }

  const formatArrayString = (arr: string | string[] | null | undefined) => {
    if (!arr) return '';
    if (Array.isArray(arr)) return arr.join(', ');
    return String(arr).replace(/[\\"\\[\\]]/g, '');
  };

  return (
    <div className="w-full bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 shrink-0">
        <img src="/imagelogo.png" alt="Unknown IITians Logo" className="h-16 w-auto mx-auto mb-4 md:hidden" />
        <h2 className="font-semibold text-gray-800 text-lg">{getPortalName()}</h2>
        <p className="text-sm text-gray-500 mt-1">{profile?.name}</p>
        {profile?.role === 'student' && availableBatches.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">Batch: {availableBatches.join(', ')}</p>
        )}
        {profile?.role === 'student' && availableSubjects.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">Subjects: {availableSubjects.join(', ')}</p>
        )}
        {profile?.role === 'student' && isLoadingEnrollments && (
             <p className="text-xs text-gray-500 mt-1">Loading enrollments...</p>
        )}
        {(profile?.role === 'super_admin') && profile?.batch && (
            <p className="text-xs text-gray-500 mt-1">Batch: {formatArrayString(profile.batch)}</p>
        )}
      </div>
      
      <div className="flex flex-col flex-grow">
          <nav className="overflow-y-auto p-4 space-y-2">
              {tabs.map((tab) => (
              <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'ghost'}
                  className={`w-full justify-start ${ activeTab === tab.id ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                  onClick={() => onTabChange(tab.id)}
              >
                  <tab.icon className="mr-3 h-4 w-4" />
                  {tab.label}
              </Button>
              ))}
          </nav>
          <div className="p-4 border-t border-gray-200 mt-auto">
            <Button variant="destructive" className="w-full justify-center" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
      </div>
    </div>
  );
};

// src/components/admin/AdminDashboard.tsx

import { useAuth } from '@/hooks/useAuth';
import { ScheduleManagement } from './ScheduleManagement';
import { MonitoringDashboard } from './MonitoringDashboard';
import { AdminMeetingManager } from './AdminMeetingManager';
import { AdminFeedbackViewer } from './AdminFeedbackViewer';
import { EnrollmentAnalytics } from './EnrollmentAnalytics';
import { TeacherAnalytics } from './TeacherAnalytics';
import { AdminCreateAnnouncement } from './AdminCreateAnnouncement';
import { AdminAnnouncementsViewer } from './AdminAnnouncementsViewer'; // Import new component

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
      case 'view-announcements':
        return <AdminAnnouncementsViewer />;
      case 'monitoring':
        return <MonitoringDashboard />;
      default:
        return <EnrollmentAnalytics />;
    }
  };

  return (
    <div className="p-6">
      {renderTabContent()}
    </div>
  );
};
