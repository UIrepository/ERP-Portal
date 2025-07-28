
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Home,
  Calendar,
  Video,
  FileText,
  MessageSquare,
  GraduationCap,
  Plus,
  Settings,
  BarChart3,
  Users,
  Monitor,
  Bell,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile } = useAuth();

  const studentTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'current-class', label: 'Current Class', icon: Video },
    { id: 'recordings', label: 'Recordings', icon: Video },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'exams', label: 'Exams', icon: GraduationCap },
    { id: 'extra-classes', label: 'Extra Classes', icon: Plus },
  ];

  const teacherTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'extra-classes', label: 'Extra Classes', icon: Plus },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'bank-details', label: 'Bank Details', icon: Settings },
  ];

  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'monitoring', label: 'Monitoring', icon: Monitor },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  let tabs = studentTabs;
  if (profile?.role === 'teacher') tabs = teacherTabs;
  if (profile?.role === 'super_admin') tabs = adminTabs;

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-screen">
      <div className="p-4">
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  activeTab === tab.id && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
