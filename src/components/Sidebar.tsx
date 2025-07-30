import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, LayoutDashboard, Calendar, Video, FileText, Target, Crown, Users, BarChart, Settings, MessageSquare, BookOpen, UserCheck, GitBranch } from 'lucide-react';
import { NavLink } from './NavLink';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile, signOut } = useAuth();

  const getNavLinks = () => {
    switch (profile?.role) {
      case 'student':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'schedule', label: 'Schedule', icon: Calendar },
          { id: 'recordings', label: 'Recordings', icon: Video },
          { id: 'notes', label: 'Notes', icon: FileText },
          { id: 'dpp', label: 'DPP', icon: Target },
          { id: 'ui-ki-padhai', label: 'UI Ki Padhai', icon: Crown },
          { id: 'feedback', label: 'Feedback', icon: MessageSquare },
          { id: 'exams', label: 'Exams', icon: BookOpen },
        ];
      case 'teacher':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'schedule', label: 'My Schedule', icon: Calendar },
          { id: 'attendance', label: 'Attendance', icon: UserCheck },
          { id: 'feedback', label: 'Student Feedback', icon: MessageSquare },
          { id: 'dpp-upload', label: 'DPP Upload', icon: Target },
        ];
      case 'super_admin':
        return [
            { id: 'enrollment-analytics', label: 'Enrollment Analytics', icon: BarChart },
            { id: 'batch-allocation', label: 'Batch Allocation', icon: Users },
            { id: 'create-user', label: 'Create User', icon: Users },
            { id: 'content-management', label: 'Content Management', icon: GitBranch },
            { id: 'settings', label: 'Settings', icon: Settings },
        ];
      default:
        return [];
    }
  };

  return (
    <aside className="w-64 flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-md">
      {/* Top section with Logo */}
      <div className="p-4 flex-shrink-0 border-b border-sidebar-border">
        <img src="/imagelogo.png" alt="Logo" className="h-16 w-auto mx-auto" />
      </div>

      {/* Middle section with Navigation Links (Scrollable) */}
      <nav className="flex-grow overflow-y-auto p-4 space-y-2">
        {getNavLinks().map((link) => (
          <NavLink
            key={link.id}
            id={link.id}
            label={link.label}
            icon={link.icon}
            isActive={activeTab === link.id}
            onClick={() => onTabChange(link.id)}
          />
        ))}
      </nav>

      {/* Bottom section with User Profile & Logout (Fixed) */}
      <div className="p-4 flex-shrink-0 border-t border-sidebar-border">
        <div className="flex items-center space-x-3 p-2 rounded-lg bg-sidebar-accent">
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold truncate">{profile?.name}</p>
            <p className="text-xs text-muted-foreground capitalize truncate">
              {profile?.role?.replace('_', ' ')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="flex-shrink-0 hover:bg-destructive/10 text-destructive"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
