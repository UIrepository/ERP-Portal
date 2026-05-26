import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect, type ReactNode } from 'react';
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
  Download01Icon,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInstallApp } from '@/hooks/useInstallApp';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSupportClick?: () => void;
  /** Desktop rail mode: icons only, labels shown as hover tooltips. */
  collapsed?: boolean;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

export const Sidebar = ({ activeTab, onTabChange, onSupportClick, collapsed = false }: SidebarProps) => {
  const { profile, user, signOut, resolvedRole } = useAuth();
  const queryClient = useQueryClient();
  const { standalone: appInstalled, installOrShowHelp } = useInstallApp();

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

  const { data: userEnrollments } = useQuery<UserEnrollment[]>({
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

  const tabs = getTabs();

  // Shared nav-item styling: solid deep-violet active state with white text,
  // soft violet-tinted hover otherwise. Collapsed = centered icon-only square.
  const navItemClass = (active: boolean) =>
    cn(
      'relative rounded-md text-sm font-normal transition-colors',
      collapsed ? 'h-10 w-10 mx-auto justify-center p-0' : 'w-full justify-start gap-3 h-9 px-3',
      active
        ? 'bg-brand text-white font-medium shadow-sm hover:bg-brand hover:text-white'
        : 'text-slate-600 hover:bg-brand/5 hover:text-brand',
    );

  const icon = (i: typeof DashboardSquare01Icon) => (
    <HugeiconsIcon icon={i} size={18} strokeWidth={1.8} className="shrink-0" />
  );

  // In collapsed mode wrap the trigger in a hover tooltip showing the label.
  const withTooltip = (label: string, node: ReactNode) =>
    collapsed ? (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" className="font-sans">{label}</TooltipContent>
      </Tooltip>
    ) : (
      node
    );

  return (
    <TooltipProvider delayDuration={0}>
    <div className={cn('w-full h-full flex flex-col overflow-hidden', collapsed ? 'bg-transparent' : 'bg-white')}>
      {/* Header - mobile only (logo); desktop sidebar starts straight at the nav */}
      <div className="p-4 border-b border-slate-200 shrink-0 md:hidden">
        <img src="/imagelogo.png" alt="Unknown IITians" className="h-14 w-auto mx-auto" />
      </div>

      {/* Navigation - Scrollable only if needed */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto min-h-0 no-scrollbar">
          {tabs.map((tab) => {
            const isContactAdminTab = tab.id === 'contact-admin';
            const isSupportTab = tab.id === 'support';
            const active = activeTab === tab.id;

            const label = <span className="flex-1 text-left truncate">{tab.label}</span>;

            // Community opens in new tab
            if (tab.id === 'teacher-community') {
              return (
                <div key={tab.id}>
                  {withTooltip(tab.label,
                    <Button
                      variant="ghost"
                      className={navItemClass(false)}
                      onClick={() => window.open('/teacher-community', '_blank')}
                    >
                      {icon(tab.icon)}
                      {!collapsed && label}
                    </Button>
                  )}
                </div>
              );
            }

            if (isSupportTab && onSupportClick) {
                return (
                    <div key={tab.id}>
                      {withTooltip(tab.label,
                        <Button
                            variant="ghost"
                            className={navItemClass(false)}
                            onClick={onSupportClick}
                        >
                            {icon(tab.icon)}
                            {!collapsed && label}
                        </Button>
                      )}
                    </div>
                );
            }

            if (isContactAdminTab) {
                return (
                    <AlertDialog key={tab.id}>
                        {withTooltip(tab.label,
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" className={navItemClass(active)}>
                                    {icon(tab.icon)}
                                    {!collapsed && label}
                                </Button>
                            </AlertDialogTrigger>
                        )}
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
                <div key={tab.id}>
                  {withTooltip(tab.label,
                    <Button
                        variant="ghost"
                        className={navItemClass(active)}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {icon(tab.icon)}
                        {!collapsed && label}
                    </Button>
                  )}
                </div>
            );
          })}
      </nav>

      {/* Get the app (PWA install) - hidden once installed/standalone */}
      {!appInstalled && (
        <div className={cn('px-3 pt-3 shrink-0', collapsed ? '' : 'border-t border-slate-200 bg-white')}>
          {withTooltip('Get the app',
            <Button
              variant="ghost"
              className={cn(
                'text-sm font-normal transition-colors',
                collapsed
                  ? 'h-10 w-10 mx-auto justify-center p-0 rounded-md text-indigo-600 hover:bg-brand/5 hover:text-brand'
                  : 'w-full justify-start gap-3 h-9 px-3 text-indigo-600 hover:bg-brand/5 hover:text-brand',
              )}
              onClick={() => { void installOrShowHelp(); }}
            >
              <HugeiconsIcon icon={Download01Icon} size={18} strokeWidth={1.8} className="shrink-0" />
              {!collapsed && 'Get the app'}
            </Button>
          )}
        </div>
      )}

      {/* Logout Button - pinned at the bottom of the dock */}
      <div className={cn('p-3 shrink-0', collapsed ? '' : 'border-t border-slate-200 bg-white')}>
        {withTooltip('Logout',
          <Button
            variant="ghost"
            className={cn(
              'text-sm font-normal transition-colors',
              collapsed
                ? 'h-10 w-10 mx-auto justify-center p-0 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700'
                : 'w-full justify-start gap-3 h-9 px-3 text-red-600 hover:bg-red-50 hover:text-red-700',
            )}
            onClick={signOut}
          >
            <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} className="shrink-0" />
            {!collapsed && 'Logout'}
          </Button>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
};
