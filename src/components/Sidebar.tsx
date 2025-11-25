import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useEffect } from 'react';
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
  Link as LinkIcon,
  BarChart2,
  LogOut,
  Megaphone,
  History,
  Phone, // ADDED: Phone icon for Contact Admin
} from 'lucide-react';

// ADDED: Imports for AlertDialog components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'; 

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Define the structure for an enrollment record from the user_enrollments table
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();

  // MODIFIED: WhatsApp contact details and handler logic
  const ADMIN_WHATSAPP_NUMBER = '6297143798'; // Using the number without +91 for wa.me link
  const WHATSAPP_MESSAGE_TEMPLATE = "Hello Sir, this is (NAME) from the (BATCH_NAME). I wanted to clarify a few doubts about the class workflow.";

  const getWhatsAppLink = (studentName: string, batchName: string) => {
      // Replace placeholders in the template with the actual name and batch
      const name = studentName || 'Student';
      // Use the batchName, defaulting if not provided
      const batch = batchName || 'Unknown Batch'; 
      
      let message = WHATSAPP_MESSAGE_TEMPLATE.replace('(NAME)', name);
      message = message.replace('(BATCH_NAME)', batch);
      
      const encodedMessage = encodeURIComponent(message);
      // Construct the WhatsApp URL
      return `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodedMessage}`;
  };

  const handleContactAdmin = () => {
      const studentName = profile?.name || 'Student'; 
      // Use the first batch name found for the message, or a default
      const batchName = availableBatches.length > 0 ? availableBatches[0] : 'your batch';
      const whatsappLink = getWhatsAppLink(studentName, batchName); 
      // Open the WhatsApp link in a new tab/window
      window.open(whatsappLink, '_blank');
  };
  // END MODIFIED LOGIC

  // Fetch user's specific enrollments for sidebar display
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['sidebarUserEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching sidebar user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Extract unique batches and subjects from the fetched enrollments for display
  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.subject_name) || [])).sort();
  }, [userEnrollments]);

  // Set up real-time subscriptions for sidebar data
  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel('sidebar-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_enrollments',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: user_enrollments changed');
          queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: profiles changed');
          queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, queryClient]);

  const studentTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'schedule', label: 'Class Schedule', icon: Calendar },
    { id: 'current-class', label: 'Ongoing Class', icon: Clock },
    { id: 'recordings', label: 'Recordings', icon: Video },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'dpp', label: 'DPP Section', icon: Target },
    { id: 'ui-ki-padhai', label: 'UI Ki Padhai', icon: Crown },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'exams', label: 'Exams', icon: BookOpen },
    { id: 'contact-admin', label: 'Contact Admin', icon: Phone }, // ADDED new tab definition
  ];

  const adminTabs = [
    { id: 'enrollment-analytics', label: 'Student Analytics', icon: BarChart2 },
    { id: 'community-admin', label: 'Community Chat', icon: Users }, // ADDED COMMUNITY TAB
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'meeting-manager', label: 'Meeting Links', icon: LinkIcon },
    { id: 'feedback-viewer', label: 'Feedback Viewer', icon: MessageSquare },
    { id: 'create-announcement', label: 'Create Announcement', icon: Megaphone },
    { id: 'announcement-history', label: 'Announcement History', icon: History },
  ];

  const getTabs = () => {
    switch (profile?.role) {
      case 'student':
        return studentTabs;
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
      case 'super_admin':
        return 'Admin Portal';
      default:
        return 'Portal';
    }
  }

  const formatArrayString = (arr: string | string[] | null | undefined) => {
    if (!arr) return '';

    if (Array.isArray(arr)) {
      return arr.map(item =>
        typeof item === 'string' ? item.replace(/[\\"]/g, '') : item
      ).join(', ');
    }

    try {
      const parsed = JSON.parse(arr);
      if (Array.isArray(parsed)) {
        return parsed.map(item =>
          typeof item === 'string' ? item.replace(/[\\"]/g, '') : item
        ).join(', ');
      }
    } catch (e) {
      // JSON parsing failed, treat as a raw string and clean it
    }

    return String(arr).replace(/[\\"\\[\\]]/g, '');
  };

  return (
    <div className="w-full bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 shrink-0">
        <img src="/imagelogo.png" alt="Unknown IITians Logo" className="h-16 w-auto mx-auto mb-4 md:hidden" />
        <h2 className="font-semibold text-gray-800 text-lg">
          {getPortalName()}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{profile?.name}</p>
        
        {/* Updated to display batches from availableBatches */}
        {profile?.role === 'student' && availableBatches.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">Batch: {availableBatches.join(', ')}</p>
        )}
        {/* Updated to display subjects from availableSubjects */}
        {profile?.role === 'student' && availableSubjects.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">Subjects: {availableSubjects.join(', ')}</p>
        )}

        {/* Display loading state for enrollments */}
        {profile?.role === 'student' && isLoadingEnrollments && (
             <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-gray-400"></span>
                Loading enrollments...
             </p>
        )}
        {/* If no enrollments and not loading, display a message */}
        {profile?.role === 'student' && !isLoadingEnrollments && availableBatches.length === 0 && availableSubjects.length === 0 && (
             <p className="text-xs text-gray-500 mt-1">No enrollments found.</p>
        )}

        {/* For Teacher/Admin roles, if profile.batch/subjects still exist in DB, keep old display */}
        {(profile?.role === 'super_admin') && profile?.batch && (
            <p className="text-xs text-gray-500 mt-1">Batch: {formatArrayString(profile.batch)}</p>
        )}
      </div>
      
      <div className="flex flex-col flex-grow">
          <nav className="overflow-y-auto p-4 space-y-2">
              {tabs.map((tab) => {
                const isContactAdminTab = tab.id === 'contact-admin';

                if (isContactAdminTab) {
                    // Render the Contact Admin button wrapped in an AlertDialog for confirmation
                    return (
                        <AlertDialog key={tab.id}>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                                    className={`w-full justify-start ${
                                        activeTab === tab.id 
                                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                >
                                    <tab.icon className="mr-3 h-4 w-4" />
                                    {tab.label}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Contact Admin on WhatsApp</AlertDialogTitle>
                                    {/* MODIFIED: Simplified description to remove phone number and message preview */}
                                    <AlertDialogDescription>
                                        Are you sure you want to proceed and open a new WhatsApp chat with the Admin?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    {/* The AlertDialogAction triggers the WhatsApp link logic */}
                                    <AlertDialogAction onClick={handleContactAdmin}>
                                        Proceed to WhatsApp
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    );
                }

                // Default rendering for all other tabs
                return (
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
                )
              })}
          </nav>
          <div className="p-4 border-t border-gray-200 mt-auto">
            <Button
              variant="destructive"
              className="w-full justify-center"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
      </div>
    </div>
  );
};
