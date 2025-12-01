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

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout = ({ children, activeTab, onTabChange }: LayoutProps) => {
  const { profile, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    // FIX: Use h-screen and overflow-hidden to prevent global window scrolling
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      
      {/* Header - Fixed height (flex-none) */}
      <header className="border-b bg-card flex-none h-16 z-30">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
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
                    <SheetDescription>Navigate through the portal sections.</SheetDescription>
                 </SheetHeader>
                 <Sidebar activeTab={activeTab} onTabChange={(tab) => {
                   onTabChange(tab);
                   setIsSidebarOpen(false); 
                 }} />
              </SheetContent>
            </Sheet>
            
            <img src="/imagelogo.png" alt="Unknown IITians Logo" className="h-10 w-auto hidden sm:block" />
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
        </div>
      </header>

      {/* Main Content Area - Uses Flex to fill remaining height */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar - Fixed width */}
        <aside className="hidden md:flex w-64 flex-col border-r bg-card h-full">
          <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
        </aside>
        
        {/* Main Viewport - No internal padding causing scroll, exact fit */}
        <main className="flex-1 flex flex-col overflow-hidden relative w-full h-full">
            {children}
            {/* Footer removed from here to prevent floating issues in chat */}
        </main>
      </div>
    </div>
  );
};
