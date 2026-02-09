import { useAuth } from '@/hooks/useAuth';
import { TeacherSchedule } from './TeacherSchedule';
import { TeacherRecordings } from './TeacherRecordings';
import { TeacherScheduleRequests } from './TeacherScheduleRequests';
import { StaffInbox } from '@/components/shared/StaffInbox';
import { TeacherFeedbackViewer } from './TeacherFeedbackViewer';
import { TeacherJoinClass } from './TeacherJoinClass';
import { TeacherCommunity } from './TeacherCommunity'; 

interface TeacherDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TeacherDashboard = ({ activeTab, onTabChange }: TeacherDashboardProps) => {
  const { profile, resolvedRole } = useAuth();

  if (resolvedRole !== 'teacher') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have teacher permissions.</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'teacher-schedule':
        return <TeacherSchedule />;
      case 'teacher-join-class':
        return <TeacherJoinClass />;
      case 'teacher-community': 
        return <TeacherCommunity />;
      case 'teacher-recordings':
        return <TeacherRecordings />;
      case 'teacher-schedule-requests':
        return <TeacherScheduleRequests />;
      case 'teacher-messages':
        return <StaffInbox />;
      case 'teacher-feedback':
        return <TeacherFeedbackViewer />;
      default:
        return <TeacherSchedule />;
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      
      {/* --- WELCOME BANNER (Student Header Design Style) --- */}
      <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl transition-all hover:shadow-2xl hover:shadow-slate-900/20 group">
        
        {/* Subtle Decorative Glow (Optional, to match the sleek feel) */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 rounded-full bg-cyan-500/5 blur-3xl group-hover:bg-cyan-500/10 transition-colors duration-700"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 rounded-full bg-slate-700/10 blur-2xl"></div>

        <div className="relative z-10 px-6 py-8 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-cyan-400/90 text-xs font-bold uppercase tracking-widest mb-2">
              Teacher Dashboard
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-sm">
              Welcome back, {profile?.name}! 👋
            </h1>
            <p className="text-slate-400 text-lg font-medium opacity-90 pt-1">
              Another day to deal with students. 🚀
            </p>
          </div>
        </div>
      </div>

      {renderTabContent()}
    </div>
  );
};
