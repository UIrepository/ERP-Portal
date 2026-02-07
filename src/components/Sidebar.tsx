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
  Contact,
  Star,
  Wrench,
  Headphones,
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
  onSupportClick?: () => void;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

export const Sidebar = ({ activeTab, onTabChange, onSupportClick }: SidebarProps) => {
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
    { id: 'dashboard', label: 'My Learning', icon: LayoutDashboard },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'support', label: 'Support', icon: Headphones },
    { id: 'feedback', label: 'Submit Feedback', icon: MessageSquare },
    { id: 'exams', label: 'Exams', icon: BookOpen },
    { id: 'contact-admin', label: 'Contact Admin', icon: Phone }, 
  ];

  // --- 2. TEACHER TABS ---
  const teacherTabs = [
    { id: 'teacher-schedule', label: 'My Schedule', icon: Calendar },
    { id: 'teacher-join-class', label: 'Join Class', icon: Video },
    { id: 'teacher-community', label: 'Community', icon: Users },
    { id: 'teacher-recordings', label: 'My Recordings', icon: Video },
    { id: 'teacher-schedule-requests', label: 'Schedule Requests', icon: ClipboardList },
    { id: 'teacher-feedback', label: 'Feedback', icon: Star },
    { id: 'teacher-messages', label: 'Messages', icon: MessageSquare },
  ];

  // --- 3. MANAGER TABS ---
  const managerTabs = [
    { id: 'manager-overview', label: 'Batch Overview', icon: LayoutDashboard },
    { id: 'manager-join-class', label: 'Join Class', icon: Video },
    { id: 'manager-messages', label: 'Messages', icon: MessageSquare },
    { id: 'manager-schedule-requests', label: 'Schedule Requests', icon: ClipboardList },
    { id: 'manager-teachers', label: 'Teachers', icon: UserCog },
    { id: 'manager-students', label: 'Students', icon: GraduationCap },
  ];

  // --- 4. ADMIN TABS ---
  const adminTabs = [
    { id: 'enrollment-analytics', label: 'Student Analytics', icon: BarChart2 },
    { id: 'admin-join-class', label: 'Join Class', icon: Video },
    { id: 'admin-messages', label: 'Messages / Inbox', icon: MessageSquare },
    { id: 'directory', label: 'Student Directory', icon: Contact },
    { id: 'staff-manager', label: 'Staff Management', icon: UserCog },
    { id: 'community-admin', label: 'Community Chat', icon: Users }, 
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'schedule-requests', label: 'Schedule Requests', icon: ClipboardList },
    { id: 'meeting-manager', label: 'Meeting Links', icon: LinkIcon },
    { id: 'feedback-viewer', label: 'Feedback Viewer', icon: MessageSquare },
    { id: 'create-announcement', label: 'Create Announcement', icon: Megaphone },
    { id: 'announcement-history', label: 'Announcement History', icon: History },
    { id: 'maintenance', label: 'Maintenance Mode', icon: Wrench },
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

  return (
    <div className="w-full bg-white border-r border-slate-200 h-full flex flex-col">
      {/* Header - Fixed at top */}
      <div className="p-4 border-b border-slate-200 shrink-0">
        <img src="/imagelogo.png" alt="Unknown IITians Logo" className="h-16 w-auto mx-auto mb-4 md:hidden" />
        <h2 className="font-semibold text-slate-800 text-lg">
          {getPortalName()}
        </h2>
        <p className="text-sm text-slate-500 mt-1">{profile?.name}</p>
        
        {resolvedRole === 'student' && availableBatches.length > 0 && (
          <p className="text-xs text-slate-500 mt-1">Batch: {availableBatches.join(', ')}</p>
        )}
        {resolvedRole === 'student' && isLoadingEnrollments && (
             <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-slate-400"></span>
                Loading enrollments...
             </p>
        )}
        {resolvedRole === 'student' && !isLoadingEnrollments && availableBatches.length === 0 && (
             <p className="text-xs text-slate-500 mt-1">No enrollments found.</p>
        )}
      </div>
      
      {/* Navigation - Takes available space */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map((tab) => {
            const isContactAdminTab = tab.id === 'contact-admin';
            const isSupportTab = tab.id === 'support';

            if (isSupportTab && onSupportClick) {
                return (
                    <Button
                        key={tab.id}
                        variant="ghost"
                        className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        onClick={onSupportClick}
                    >
                        <tab.icon className="mr-3 h-4 w-4" />
                        {tab.label}
                    </Button>
                );
            }

            if (isContactAdminTab) {
                return (
                    <AlertDialog key={tab.id}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant={activeTab === tab.id ? 'default' : 'ghost'}
                                className={`w-full justify-start ${
                                    activeTab === tab.id 
                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                    className={`w-full justify-start ${
                    activeTab === tab.id 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    onClick={() => onTabChange(tab.id)}
                >
                    <tab.icon className="mr-3 h-4 w-4" />
                    {tab.label}
                </Button>
            );
          })}
      </nav>
      
      {/* Logout Button - Pinned to bottom using Flexbox */}
      <div className="p-4 border-t border-slate-200 bg-white shrink-0 mt-auto">
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
