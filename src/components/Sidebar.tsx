
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Calendar, 
  BookOpen, 
  Video, 
  MessageSquare,
  CreditCard,
  Link,
  Crown,
  Clock,
  FileText,
  Target,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile, signOut } = useAuth();

  const studentMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'schedule', label: 'Class Schedule', icon: Calendar },
    { id: 'current-class', label: 'Ongoing Class', icon: Clock },
    { id: 'recordings', label: 'Recordings', icon: Video },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'dpp', label: 'DPP Section', icon: Target },
    { id: 'ui-ki-padhai', label: 'UI Ki Padhai', icon: Crown },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'exams', label: 'Exams', icon: BookOpen },
  ];

  const teacherMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'schedule', label: 'Class Schedule', icon: Calendar },
    { id: 'meeting-links', label: 'Meeting Links', icon: Link },
    { id: 'feedback', label: 'Student Feedback', icon: MessageSquare },
    { id: 'bank-details', label: 'Bank Details', icon: CreditCard },
  ];

  const menuItems = profile?.role === 'student' ? studentMenuItems : teacherMenuItems;

  return (
    <div className="w-64 bg-card border-r border-border h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">
              {profile?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{profile?.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {profile?.role}
              </Badge>
              {profile?.batch && (
                <Badge variant="outline" className="text-xs">
                  {profile?.batch}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => onTabChange(item.id)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};
