import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  Calendar03Icon,
  Video01Icon,
  VideoReplayIcon,
  UserGroupIcon,
  Link01Icon,
  Analytics01Icon,
  Logout01Icon,
  Megaphone01Icon,
  WorkHistoryIcon,
  WhatsappIcon,
  TaskDaily01Icon,
  UserSettings01Icon,
  Mortarboard01Icon,
  UserListIcon,
  FavouriteIcon,
  Wrench01Icon,
  CustomerSupportIcon,
  GitMergeIcon,
  Message01Icon,
  InboxIcon,
  Quiz01Icon,
} from '@hugeicons/core-free-icons';

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
  const { profile, user, signOut, resolvedRole } = useAuth();
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

  const sidebarUserId = user?.id || profile?.user_id;

  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['sidebarUserEnrollments', sidebarUserId],
    queryFn: async () => {
        if (!sidebarUserId) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', sidebarUserId);
        if (error) return [];
        return data || [];
    },
    enabled: !!sidebarUserId && resolvedRole === 'student'
  });

  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  useEffect(() => {
    if (!sidebarUserId || resolvedRole !== 'student') return;
    const channel = supabase
      .channel('sidebar-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_enrollments', filter: `user_id=eq.${sidebarUserId}` }, () => {
          queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sidebarUserId, queryClient, resolvedRole]);

  // --- 1. STUDENT TABS ---
  const studentTabs = [
    { id: 'dashboard', label: 'My Learning', icon: DashboardSquare01Icon },
    { id: 'schedule', label: 'Schedule', icon: Calendar03Icon },
    { id: 'support', label: 'Support', icon: CustomerSupportIcon },
    { id: 'feedback', label: 'Submit Feedback', icon: Message01Icon },
    { id: 'exams', label: 'Exams', icon: Quiz01Icon },
    { id: 'contact-admin', label: 'Contact Admin', icon: WhatsappIcon },
  ];

  // --- 2. TEACHER TABS ---
  const teacherTabs = [
    { id: 'teacher-schedule', label: 'My Schedule', icon: Calendar03Icon },
    { id: 'teacher-join-class', label: 'Join Class', icon: Video01Icon },
    { id: 'teacher-community', label: 'Community', icon: UserGroupIcon },
    { id: 'teacher-recordings', label: 'My Recordings', icon: VideoReplayIcon },
    { id: 'teacher-schedule-requests', label: 'Schedule Requests', icon: TaskDaily01Icon },
    { id: 'teacher-feedback', label: 'Feedback', icon: FavouriteIcon },
    { id: 'teacher-messages', label: 'Messages', icon: Message01Icon },
  ];

  // --- 3. MANAGER TABS ---
  const managerTabs = [
    { id: 'manager-overview', label: 'Batch Overview', icon: DashboardSquare01Icon },
    { id: 'manager-join-class', label: 'Join Class', icon: Video01Icon },
    { id: 'manager-messages', label: 'Messages', icon: Message01Icon },
    { id: 'manager-schedule-requests', label: 'Schedule Requests', icon: TaskDaily01Icon },
    { id: 'manager-teachers', label: 'Teachers', icon: UserSettings01Icon },
    { id: 'manager-students', label: 'Students', icon: Mortarboard01Icon },
  ];

  // --- 4. ADMIN TABS ---
  const adminTabs = [
    { id: 'enrollment-analytics', label: 'Student Analytics', icon: Analytics01Icon },
    { id: 'admin-join-class', label: 'Join Class', icon: Video01Icon },
    { id: 'admin-messages', label: 'Messages / Inbox', icon: InboxIcon },
    { id: 'directory', label: 'Student Directory', icon: UserListIcon },
    { id: 'staff-manager', label: 'Staff Management', icon: UserSettings01Icon },
    { id: 'community-admin', label: 'Community Chat', icon: UserGroupIcon },
    { id: 'schedules', label: 'Schedules', icon: Calendar03Icon },
    { id: 'schedule-requests', label: 'Schedule Requests', icon: TaskDaily01Icon },
    { id: 'meeting-manager', label: 'Meeting Links', icon: Link01Icon },
    { id: 'feedback-viewer', label: 'Feedback Viewer', icon: Message01Icon },
    { id: 'create-announcement', label: 'Create Announcement', icon: Megaphone01Icon },
    { id: 'announcement-history', label: 'Announcement History', icon: WorkHistoryIcon },
    { id: 'maintenance', label: 'Maintenance Mode', icon: Wrench01Icon },
    { id: 'subject-merges', label: 'Subject Merges', icon: GitMergeIcon },
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

  // Shared nav-item styling: solid deep-violet active state with white text,
  // soft violet-tinted hover otherwise.
  const navItemClass = (active: boolean) =>
    cn(
      'relative w-full justify-start gap-3 h-9 px-3 rounded-md text-sm font-normal transition-colors',
      active
        ? 'bg-brand text-white font-medium shadow-sm hover:bg-brand hover:text-white'
        : 'text-slate-600 hover:bg-brand/5 hover:text-brand',
    );

  const initial = (profile?.name?.trim()?.[0] || 'U').toUpperCase();

  return (
    <div className="w-full bg-white h-full flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="p-4 border-b border-slate-200 shrink-0">
        <img src="/imagelogo.png" alt="Unknown IITians" className="h-14 w-auto mx-auto mb-4 md:hidden" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-display font-semibold text-sm shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-slate-900 text-[15px] leading-tight truncate">
              {getPortalName()}
            </h2>
            <p className="text-xs text-slate-500 truncate">{profile?.name}</p>
          </div>
        </div>

        {resolvedRole === 'student' && availableBatches.length > 0 && (
          <p className="text-[11px] text-slate-500 mt-3 truncate">Batch: {availableBatches.join(', ')}</p>
        )}
        {resolvedRole === 'student' && isLoadingEnrollments && (
             <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
                <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-slate-400"></span>
                Loading enrollments...
             </p>
        )}
        {resolvedRole === 'student' && !isLoadingEnrollments && availableBatches.length === 0 && (
             <p className="text-[11px] text-slate-500 mt-3">No enrollments found.</p>
        )}
      </div>

      {/* Navigation - Scrollable only if needed */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto min-h-0">
          {tabs.map((tab) => {
            const isContactAdminTab = tab.id === 'contact-admin';
            const isSupportTab = tab.id === 'support';
            const active = activeTab === tab.id;

            // Community opens in new tab
            if (tab.id === 'teacher-community') {
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  className={navItemClass(false)}
                  onClick={() => window.open('/teacher-community', '_blank')}
                >
                  <HugeiconsIcon icon={tab.icon} size={18} strokeWidth={1.8} className="shrink-0" />
                  <span className="flex-1 text-left">{tab.label}</span>
                </Button>
              );
            }

            if (isSupportTab && onSupportClick) {
                return (
                    <Button
                        key={tab.id}
                        variant="ghost"
                        className={navItemClass(false)}
                        onClick={onSupportClick}
                    >
                        <HugeiconsIcon icon={tab.icon} size={18} strokeWidth={1.8} className="shrink-0" />
                        {tab.label}
                    </Button>
                );
            }

            if (isContactAdminTab) {
                return (
                    <AlertDialog key={tab.id}>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" className={navItemClass(active)}>
                                <HugeiconsIcon icon={tab.icon} size={18} strokeWidth={1.8} className="shrink-0" />
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
                    variant="ghost"
                    className={navItemClass(active)}
                    onClick={() => onTabChange(tab.id)}
                >
                    <HugeiconsIcon icon={tab.icon} size={18} strokeWidth={1.8} className="shrink-0" />
                    {tab.label}
                </Button>
            );
          })}
      </nav>

      {/* Logout Button - Always fixed at bottom */}
      <div className="p-3 border-t border-slate-200 bg-white shrink-0">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-9 px-3 text-sm font-normal text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          onClick={signOut}
        >
          <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} className="shrink-0" />
          Logout
        </Button>
      </div>
    </div>
  );
};
