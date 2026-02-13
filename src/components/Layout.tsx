
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, PanelLeft, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from './Sidebar';
import { useChatDrawer } from '@/hooks/useChatDrawer';
import { NotificationCenter } from './NotificationCenter';
import { NotificationListener } from './NotificationListener';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout = ({ children, activeTab, onTabChange }: LayoutProps) => {
  const { profile, signOut, resolvedRole } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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

      {/* Full-width Header */}
      <header className="border-b bg-card shrink-0 z-30 w-full">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Toggle - Updated to Big Hamburger Menu */}
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
          
          <div className="flex items-center space-x-3 md:space-x-4">
            
            {/* 2. Notification Bell Icon 
               Placed right before the profile dropdown 
            */}
            <NotificationCenter />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
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
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Content Area: Sidebar + Main */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar - Fixed height below navbar */}
        <aside className="hidden md:flex h-full w-64 border-r flex-shrink-0">
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={onTabChange}
            onSupportClick={resolvedRole === 'student' ? openSupportDrawer : undefined}
          />
        </aside>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="min-h-full flex flex-col">
            <div className="flex-1">
              {children}
            </div>
            <footer className="py-6 border-t bg-card/30 mt-auto">
              <p className="text-center text-sm text-muted-foreground font-medium">
                Built and Maintained by <a 
                  href="https://www.neuralai.in/about" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:underline"
                  style={{ fontFamily: '"Zen Dots", sans-serif' }}
                >
                  <span className="text-teal-700">Neural</span> AI
                </a>
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};
