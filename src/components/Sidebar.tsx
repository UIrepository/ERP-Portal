// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/Sidebar.tsx
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
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Define the structure for an enrollment record from the user_enrollments table
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's specific enrollments for sidebar display
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

  // Extract unique batches and subjects from the fetched enrollments for display
  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.subject_name) || [])).sort();
  }, [userEnrollments]);

  // Set up real-time subscriptions for sidebar data
  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel('sidebar-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_enrollments',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: user_enrollments changed');
          queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: profiles changed');
          queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, queryClient]);

  const studentTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
  ];

  const getTabs = () => {
    switch (profile?.role) {
      case 'student':
        return studentTabs;
      case 'super_admin':
        return adminTabs;
      default:
        return [];
    }
  };

  const tabs = getTabs();

  const getPortalName = () => {
     switch (profile?.role) {
      case 'student':
        return 'Student Portal';
      case 'super_admin':
        return 'Admin Portal';
      default:
        return 'Portal';
    }
  }

  const formatArrayString = (arr: string | string[] | null | undefined) => {
    if (!arr) return '';

    if (Array.isArray(arr)) {
      return arr.map(item =>
        typeof item === 'string' ? item.replace(/[\\"]/g, '') : item
      ).join(', ');
    }

    try {
      const parsed = JSON.parse(arr);
      if (Array.isArray(parsed)) {
        return parsed.map(item =>
          typeof item === 'string' ? item.replace(/[\\"]/g, '') : item
        ).join(', ');
      }
    } catch (e) {
      // JSON parsing failed, treat as a raw string and clean it
    }

    return String(arr).replace(/[\\"\\[\\]]/g, '');
  };

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-full flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="font-semibold text-lg">
          {getPortalName()}
        </h2>
        <p className="text-sm mt-1">{profile?.name}</p>
        
        {/* Updated to display batches from availableBatches */}
        {profile?.role === 'student' && availableBatches.length > 0 && (
          <p className="text-xs mt-1">Batch: {availableBatches.join(', ')}</p>
        )}
        {/* Updated to display subjects from availableSubjects */}
        {profile?.role === 'student' && availableSubjects.length > 0 && (
          <p className="text-xs mt-1">Subjects: {availableSubjects.join(', ')}</p>
        )}

        {/* Display loading state for enrollments */}
        {profile?.role === 'student' && isLoadingEnrollments && (
             <p className="text-xs mt-1 flex items-center gap-1">
                <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-gray-400"></span>
                Loading enrollments...
             </p>
        )}
        {/* If no enrollments and not loading, display a message */}
        {profile?.role === 'student' && !isLoadingEnrollments && availableBatches.length === 0 && availableSubjects.length === 0 && (
             <p className="text-xs mt-1">No enrollments found.</p>
        )}

        {/* For Teacher/Admin roles, if profile.batch/subjects still exist in DB, keep old display */}
        {(profile?.role === 'super_admin') && profile?.batch && (
            <p className="text-xs mt-1">Batch: {formatArrayString(profile.batch)}</p>
        )}
      </div>
      
      <nav className="p-4 space-y-2 flex-grow">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            className={`w-full justify-start ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            <tab.icon className="mr-3 h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="destructive"
          className="w-full justify-center"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};
