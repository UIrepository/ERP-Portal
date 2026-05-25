
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
import { cn } from '@/lib/utils';
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
  const [isRailExpanded, setIsRailExpanded] = useState(false);
  
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
        {/* Desktop floating sidebar - icon rail; toggle expands it to a labeled panel */}
        <aside
          className={cn(
            "hidden md:flex flex-col absolute left-3 top-3 bottom-3 z-20 transition-[width] duration-200 ease-out",
            isRailExpanded
              ? "w-60 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden"
              : "w-16 bg-transparent"
          )}
        >
          {/* Toggle */}
          <button
            onClick={() => setIsRailExpanded((v) => !v)}
            aria-label={isRailExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className={cn(
              "flex items-center h-10 shrink-0 rounded-md text-slate-500 hover:text-brand hover:bg-brand/5 transition-colors mt-3",
              isRailExpanded ? "mx-3 px-3 gap-3 justify-start" : "w-10 mx-auto justify-center p-0"
            )}
          >
            <PanelLeft className="h-4 w-4 shrink-0" />
            {isRailExpanded && <span className="text-sm font-medium">Collapse</span>}
          </button>

          <div className="flex-1 min-h-0">
            <Sidebar
              activeTab={activeTab}
              onTabChange={onTabChange}
              onSupportClick={resolvedRole === 'student' ? openSupportDrawer : undefined}
              collapsed={!isRailExpanded}
            />
          </div>
        </aside>

        {/* Scrollable Main Content - left padding on desktop to clear the floating rail */}
        <main className="flex-1 overflow-y-auto min-w-0 md:pl-24">
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
