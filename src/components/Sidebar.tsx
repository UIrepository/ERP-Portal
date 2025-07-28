
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
  BookOpen,
  Upload,
  Link,
  CreditCard,
  Shield,
  UserCheck,
  Layers,
  Crown,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile } = useAuth();

  const studentTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'schedule', label: 'Class Schedule', icon: Calendar },
    { id: 'current-class', label: 'Ongoing Class', icon: Video },
    { id: 'recordings', label: 'Notes & Recordings', icon: FileText },
    { id: 'dpp', label: 'DPP Section', icon: BookOpen },
    { id: 'ui-ki-padhai', label: 'UI Ki Padhai', icon: Crown },
    { id: 'feedback', label: 'Feedback Submission', icon: MessageSquare },
    { id: 'chat-teacher', label: 'Chat with Teacher', icon: MessageSquare },
    { id: 'chat-founder', label: 'Chat with Founder', icon: Shield },
  ];

  const teacherTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'schedule', label: 'Class Schedule Viewer', icon: Calendar },
    { id: 'meeting-links', label: 'Universal Meeting Links', icon: Link },
    { id: 'extra-classes', label: 'Request Extra Class', icon: Plus },
    { id: 'bank-details', label: 'Bank Details Update', icon: CreditCard },
    { id: 'feedback', label: 'Feedback Viewer', icon: MessageSquare },
  ];

  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: Home },
    { id: 'students', label: 'Manage Students', icon: Users },
    { id: 'teachers', label: 'Manage Teachers', icon: UserCheck },
    { id: 'batch-allocation', label: 'Batch & Subject Allocation', icon: Layers },
    { id: 'meeting-manager', label: 'Meeting Link Manager', icon: Link },
    { id: 'upload-content', label: 'Upload Content', icon: Upload },
    { id: 'feedback-viewer', label: 'Feedback Viewer', icon: MessageSquare },
    { id: 'monitoring', label: 'Device & Session Monitoring', icon: Monitor },
    { id: 'custom-sections', label: 'Custom Section Creator', icon: Plus },
    { id: 'ui-ki-padhai', label: 'UI Ki Padhai', icon: Crown },
  ];

  let tabs = studentTabs;
  if (profile?.role === 'teacher') tabs = teacherTabs;
  if (profile?.role === 'super_admin') tabs = adminTabs;

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-screen overflow-y-auto">
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-sidebar-foreground">
            {profile?.role === 'super_admin' ? '🛡️ Super Admin' : 
             profile?.role === 'teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {profile?.name}
          </p>
        </div>
        
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start text-left',
                  activeTab === tab.id && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="mr-3 h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
