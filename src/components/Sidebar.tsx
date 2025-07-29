import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Calendar, 
  Clock, 
  Video, 
  FileText, 
  Target, 
  Crown, 
  MessageSquare, 
  BookOpen,
  Users,
  UserCheck,
  Layers,
  Link as LinkIcon,
  Upload,
  Plus,
  Monitor,
  BarChart2,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile, signOut } = useAuth();

  const studentTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedule', label: 'Class Schedule', icon: Calendar },
    { id: 'current-class', label: 'Ongoing Class', icon: Clock },
    { id: 'recordings', label: 'Recordings', icon: Video },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'dpp', label: 'DPP Section', icon: Target },
    { id: 'ui-ki-padhai', label: 'UI Ki Padhai', icon: Crown },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'exams', label: 'Exams', icon: BookOpen },
  ];

  const teacherTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'meeting-links', label: 'Meeting Links', icon: Video },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  ];
  
  const adminTabs = [
    { id: 'enrollment-analytics', label: 'Student Analytics', icon: BarChart2 },
    { id: 'teacher-analytics', label: 'Teacher Analytics', icon: BarChart2 },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'meeting-manager', label: 'Meeting Links', icon: LinkIcon },
    { id: 'feedback-viewer', label: 'Feedback Viewer', icon: MessageSquare },
    { id: 'monitoring', label: 'Monitoring', icon: Monitor },
  ];

  const getTabs = () => {
    switch (profile?.role) {
      case 'student':
        return studentTabs;
      case 'teacher':
        return teacherTabs;
      case 'super_admin':
        return adminTabs;
      default:
        return [];
    }
  };

  const tabs = getTabs();

  const getPortalName = () => {
     switch (profile?.role) {
      case 'student':
        return 'Student Portal';
      case 'teacher':
        return 'Teacher Portal';
      case 'super_admin':
        return 'Admin Portal';
      default:
        return 'Portal';
    }
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800 text-lg">
          {getPortalName()}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{profile?.name}</p>
      </div>
      
      <nav className="p-4 space-y-2 flex-grow">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            className={`w-full justify-start ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            <tab.icon className="mr-3 h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <Button
          variant="outline"
          className="w-full justify-center"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};
