
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav, type BottomNavTab } from './BottomNav';
import { useChatDrawer } from '@/hooks/useChatDrawer';
import { useCommunityUnread } from '@/hooks/useCommunityUnread';
import { NotificationCenter } from './NotificationCenter';
import { NotificationListener } from './NotificationListener';
import { PushManager } from './PushManager';
import { HomeNavIcon, ScheduleNavIcon, FeedbackNavIcon, ExamsNavIcon, CommunityNavIcon, WhatsAppGlyph } from './icons/NavIcons';

const ADMIN_WHATSAPP_NUMBER = '916297143798';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout = ({ children, activeTab, onTabChange }: LayoutProps) => {
  const { profile, user, signOut, resolvedRole } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [contactAdminOpen, setContactAdminOpen] = useState(false);
  const communityUnread = useCommunityUnread();
  // Students navigate via the app-style bottom bar on mobile, so they don't
  // get the hamburger sidebar there. Other roles have too many tabs for a
  // bottom bar and keep the slide-out menu.
  const isStudent = resolvedRole === 'student';

  // First enrolled batch — used to personalise the Contact-Admin WhatsApp note.
  const { data: studentBatches = [] } = useQuery<string[]>({
    queryKey: ['layoutStudentBatches', user?.id ?? profile?.user_id],
    queryFn: async () => {
      const uid = user?.id ?? profile?.user_id;
      if (!uid) return [];
      const { data } = await supabase
        .from('user_enrollments')
        .select('batch_name')
        .eq('user_id', uid);
      return Array.from(new Set((data || []).map((e) => e.batch_name))).sort();
    },
    enabled: isStudent && !!(user?.id ?? profile?.user_id),
  });

  const handleContactAdmin = () => {
    const name = profile?.name || 'Student';
    const batch = studentBatches[0] || 'your batch';
    const message = `Hello Sir, this is ${name} from the ${batch}. I wanted to clarify a few doubts about the class workflow.`;
    window.open(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Mobile bottom-nav for students — icon-only bespoke glyphs (see NavIcons).
  // Community is an action tab that opens the community page (separate route),
  // badged with the total unread across all enrolled batch+subject groups.
  const studentBottomTabs: BottomNavTab[] = [
    { id: 'dashboard', label: 'Home', icon: HomeNavIcon },
    { id: 'schedule', label: 'Schedule', icon: ScheduleNavIcon },
    { id: 'feedback', label: 'Feedback', icon: FeedbackNavIcon },
    { id: 'exams', label: 'Exams', icon: ExamsNavIcon },
    { id: 'community', label: 'Community', icon: CommunityNavIcon, onSelect: () => navigate('/portal/student/community'), badge: communityUnread },
  ];

  // Only try to use chat drawer for students (it's wrapped in provider only for students)
  let openSupportDrawer: (() => void) | undefined;
  try {
    const chatDrawer = useChatDrawer();
    openSupportDrawer = chatDrawer.openSupportDrawer;
  } catch {
    // Not in a ChatDrawerProvider context (non-student roles)
    openSupportDrawer = undefined;
  }

  return (
    // Added 'font-sans' here to enforce Inter font family throughout the app
    <div className="flex flex-col h-screen overflow-hidden bg-background font-sans">
      
      {/* 1. Mount the Notification Listener 
        This is invisible but plays the sound and shows the toast popup 
      */}
      <NotificationListener />
      <PushManager />

      {/* Full-width Header */}
      <header className="border-b bg-card shrink-0 z-30 w-full">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Toggle — hidden for students (they use the bottom nav) */}
            {!isStudent && (
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button size="icon" variant="ghost" className="-ml-2 h-12 w-12 hover:bg-slate-100">
                  <Menu className="h-8 w-8 text-slate-700" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                 <SheetHeader className="sr-only">
                    <SheetTitle>Sidebar Menu</SheetTitle>
                    <SheetDescription>
                        Navigate through the portal sections.
                    </SheetDescription>
                 </SheetHeader>
                 <Sidebar 
                   activeTab={activeTab} 
                   onTabChange={(tab) => {
                     onTabChange(tab);
                     setIsSidebarOpen(false);
                   }}
                   onSupportClick={resolvedRole === 'student' ? openSupportDrawer : undefined}
                 />
              </SheetContent>
            </Sheet>
            )}

            {/* Responsive Logo: 'logoofficial' on mobile (icon), 'imagelogo' on desktop (text) */}
            <img 
              src="/logoofficial.png" 
              alt="Logo" 
              className="h-10 w-auto md:hidden" 
            />
            <img 
              src="/imagelogo.png" 
              alt="Unknown IITians" 
              className="hidden md:block h-12 w-auto" 
            />
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">

            {/* Contact Admin on WhatsApp — mobile only (desktop has it in the
               sidebar). The bottom nav now hosts Community instead. */}
            {isStudent && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setContactAdminOpen(true)}
                className="md:hidden h-9 w-9 text-[#25D366] hover:bg-emerald-50"
                aria-label="Contact Admin on WhatsApp"
              >
                <WhatsAppGlyph className="h-6 w-6" />
              </Button>
            )}

            {/* 2. Notification Bell Icon
               Placed right before the profile dropdown
            */}
            <NotificationCenter />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-brand/10 text-brand font-display font-semibold text-sm">
                      {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {profile?.role?.replace('_', ' ')}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-slate-600 focus:bg-red-50 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Content Area: floating Sidebar over Main */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop floating dock - tall light capsule that floats over the page */}
        <aside className="hidden md:flex absolute left-4 top-4 bottom-4 z-20 w-16 rounded-lg bg-white border border-slate-200 overflow-hidden">
          <Sidebar
            activeTab={activeTab}
            onTabChange={onTabChange}
            onSupportClick={resolvedRole === 'student' ? openSupportDrawer : undefined}
            collapsed
          />
        </aside>

        {/* Scrollable Main Content - left padding on desktop to clear the floating rail */}
        <main className="flex-1 overflow-y-auto min-w-0 md:pl-24">
          <div className="min-h-full flex flex-col">
            {/* Bottom padding on mobile keeps content clear of the bottom nav */}
            <div className={isStudent ? 'flex-1 pb-24 md:pb-0' : 'flex-1'}>
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* App-style bottom navigation — students, mobile only */}
      {isStudent && (
        <BottomNav
          tabs={studentBottomTabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}

      {/* Contact-Admin confirm (from the bottom-nav WhatsApp tab) */}
      <AlertDialog open={contactAdminOpen} onOpenChange={setContactAdminOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contact Admin on WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to proceed and open a new WhatsApp chat with the Admin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleContactAdmin}>Proceed to WhatsApp</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
