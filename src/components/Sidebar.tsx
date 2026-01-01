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
  Link as LinkIcon,
  BarChart2,
  LogOut,
  Megaphone,
  History,
  Phone,
  ClipboardList,
  UserCog,
  GraduationCap,
  Contact, // Using Contact icon for Directory
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'; 

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile, signOut, resolvedRole } = useAuth();
  const queryClient = useQueryClient();

  const ADMIN_WHATSAPP_NUMBER = '916297143798'; 
  const WHATSAPP_MESSAGE_TEMPLATE = "Hello Sir, this is (NAME) from the (BATCH_NAME). I wanted to clarify a few doubts about the class workflow.";

  const getWhatsAppLink = (studentName: string, batchName: string) => {
      const name = studentName || 'Student';
      const batch = batchName || 'your batch'; 
      let message = WHATSAPP_MESSAGE_TEMPLATE.replace('(NAME)', name);
      message = message.replace('(BATCH_NAME)', batch);
      const encodedMessage = encodeURIComponent(message);
      return `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodedMessage}`;
  };

  const handleContactAdmin = () => {
      const studentName = profile?.name || 'Student'; 
      const batchName = availableBatches.length > 0 ? availableBatches[0] : 'your batch';
      const whatsappLink = getWhatsAppLink(studentName, batchName); 
      window.open(whatsappLink, '_blank');
  };

  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['sidebarUserEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) return [];
        return data || [];
    },
    enabled: !!profile?.user_id && resolvedRole === 'student'
  });

  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.subject_name) || [])).sort();
  }, [userEnrollments]);

  useEffect(() => {
    if (!profile?.user_id || resolvedRole !== 'student') return;
    const channel = supabase
      .channel('sidebar-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_enrollments', filter: `user_id=eq.${profile.user_id}` }, () => {
          queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.user_id, queryClient, resolvedRole]);

  // --- 1. STUDENT TABS ---
  const studentTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'schedule', label: 'Class Schedule', icon: Calendar },
    { id: 'current-class', label: 'Ongoing Class', icon: Clock },
    { id: 'connect', label: 'Mentors & Connect', icon: UserCog },
    { id: 'recordings', label: 'Recordings', icon: Video },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'dpp', label: 'DPP Section', icon: Target },
    { id: 'ui-ki-padhai', label: 'UI Ki Padhai', icon: Crown },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'exams', label: 'Exams', icon: BookOpen },
    { id: 'contact-admin', label: 'Contact Admin', icon: Phone }, 
  ];

  // --- 2. TEACHER TABS ---
  const teacherTabs = [
    { id: 'teacher-schedule', label: 'My Schedule', icon: Calendar },
    { id: 'teacher-recordings', label: 'My Recordings', icon: Video },
    { id: 'teacher-schedule-requests', label: 'Schedule Requests', icon: ClipboardList },
    { id: 'teacher-messages', label: 'Messages', icon: MessageSquare },
  ];

  // --- 3. MANAGER TABS ---
  const managerTabs = [
    { id: 'manager-overview', label: 'Batch Overview', icon: LayoutDashboard },
    { id: 'manager-messages', label: 'Messages', icon: MessageSquare },
    { id: 'manager-schedule-requests', label: 'Schedule Requests', icon: ClipboardList },
    { id: 'manager-teachers', label: 'Teachers', icon: UserCog },
    { id: 'manager-students', label: 'Students', icon: GraduationCap },
  ];

  // --- 4. ADMIN TABS (Updated) ---
  const adminTabs = [
    { id: 'enrollment-analytics', label: 'Student Analytics', icon: BarChart2 },
    { id: 'admin-messages', label: 'Messages / Inbox', icon: MessageSquare },
    { id: 'directory', label: 'Student Directory', icon: Contact }, // <--- ADDED
    { id: 'staff-manager', label: 'Staff Management', icon: UserCog },
    { id: 'community-admin', label: 'Community Chat', icon: Users }, 
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'meeting-manager', label: 'Meeting Links', icon: LinkIcon },
    { id: 'feedback-viewer', label: 'Feedback Viewer', icon: MessageSquare },
    { id: 'create-announcement', label: 'Create Announcement', icon: Megaphone },
    { id: 'announcement-history', label: 'Announcement History', icon: History },
  ];

  const getTabs = () => {
    switch (resolvedRole) {
      case 'student': return studentTabs;
      case 'teacher': return teacherTabs;
      case 'manager': return managerTabs;
      case 'admin': return adminTabs;
      default: return [];
    }
  };

  const getPortalName = () => {
    switch (resolvedRole) {
      case 'student': return 'Student Portal';
      case 'teacher': return 'Teacher Portal';
      case 'manager': return 'Manager Portal';
      case 'admin': return 'Admin Portal';
      default: return 'Portal';
    }
  };

  const tabs = getTabs();

  // Helper for array formatting if needed
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
    } catch (e) {}
    return String(arr).replace(/[\\"\\[\\]]/g, '');
  };

  return (
    <div className="w-full bg-white border-r border-gray-200 h-full flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-200 shrink-0">
        <img src="/imagelogo.png" alt="Unknown IITians Logo" className="h-16 w-auto mx-auto mb-4 md:hidden" />
        <h2 className="font-semibold text-gray-800 text-lg">
          {getPortalName()}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{profile?.name}</p>
        
        {resolvedRole === 'student' && availableBatches.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">Batch: {availableBatches.join(', ')}</p>
        )}
        {resolvedRole === 'student' && availableSubjects.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">Subjects: {availableSubjects.join(', ')}</p>
        )}
        {resolvedRole === 'student' && isLoadingEnrollments && (
             <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-gray-400"></span>
                Loading enrollments...
             </p>
        )}
        {resolvedRole === 'student' && !isLoadingEnrollments && availableBatches.length === 0 && availableSubjects.length === 0 && (
             <p className="text-xs text-gray-500 mt-1">No enrollments found.</p>
        )}
      </div>
      
      <div className="flex flex-col flex-grow">
          <nav className="overflow-y-auto p-4 space-y-2">
              {tabs.map((tab) => {
                const isContactAdminTab = tab.id === 'contact-admin';
                const isCommunityTab = tab.id === 'community' || tab.id === 'community-admin';
                const hasNewGroupMessage = isCommunityTab && tab.id !== activeTab; 

                if (isContactAdminTab) {
                    return (
                        <AlertDialog key={tab.id}>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                                    className={`w-full justify-start ${
                                        activeTab === tab.id 
                                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                >
                                    <tab.icon className="mr-3 h-4 w-4" />
                                    {tab.label}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Contact Admin on WhatsApp</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to proceed and open a new WhatsApp chat with the Admin?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleContactAdmin}>
                                        Proceed to WhatsApp
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    );
                }

                return (
                    <div key={tab.id} className="relative">
                        <Button
                            variant={activeTab === tab.id ? 'default' : 'ghost'}
                            className={`w-full justify-start ${
                            activeTab === tab.id 
                                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                            onClick={() => onTabChange(tab.id)}
                        >
                            <tab.icon className="mr-3 h-4 w-4" />
                            {tab.label}
                        </Button>
                        {hasNewGroupMessage && (
                            <span 
                                className="absolute top-1 right-2 h-3 w-3 rounded-full bg-red-500 border-2 border-white animate-pulse" 
                                title="New group messages received"
                            />
                        )}
                    </div>
                )
              })}
          </nav>
          <div className="p-4 border-t border-gray-200 mt-auto">
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
    </div>
  );
};
