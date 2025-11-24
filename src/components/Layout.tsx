import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, PanelLeft } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile'; // ADDED

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout = ({ children, activeTab, onTabChange }: LayoutProps) => {
  const { profile, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile(); // ADDED
  
  // Logic to hide global layout elements for the mobile chat experience
  const isMobileChatActive = isMobile && activeTab === 'community'; // ADDED

  return (
    // FIX 1: Conditional class for full screen on mobile chat
    <div className={`flex flex-col min-h-screen bg-background ${isMobileChatActive ? 'h-screen overflow-hidden' : ''}`}> 
      {/* FIX 2: HEADER is now conditionally rendered */}
      {!isMobileChatActive && (
        <header className="border-b bg-card sticky top-0 z-30">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              {/* Mobile Sidebar Toggle */}
              <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button size="icon" variant="outline">
                    <PanelLeft className="h-5 w-5" />
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
                 <Sidebar activeTab={activeTab} onTabChange={(tab) => {
                   onTabChange(tab);
                   setIsSidebarOpen(false); // Close sidebar on tab change
                 }} />
              </SheetContent>
            </Sheet>
            
            <img src="/imagelogo.png" alt="Unknown IITians Logo" className="h-12 w-auto hidden sm:block" />
          </div>
          
          <div className="flex items-center space-x-4">
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
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block h-full w-64 border-r">
          <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto flex flex-col">
            <div className="flex-1">
                {children}
            </div>
            {/* FIX 3: FOOTER is now conditionally rendered */}
            {!isMobileChatActive && (
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
            )}
        </main>
      </div>
    </div>
  );
};
