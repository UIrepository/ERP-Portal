
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
  BookOpen 
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile } = useAuth();

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

  const tabs = profile?.role === 'student' ? studentTabs : teacherTabs;

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800 text-lg">
          {profile?.role === 'student' ? 'Student Portal' : 'Teacher Portal'}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{profile?.name}</p>
      </div>
      
      <nav className="p-4 space-y-2">
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
    </div>
  );
};
