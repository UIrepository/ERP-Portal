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
      
      {/* --- COMPACT WELCOME BANNER --- */}
      <div className="mb-6 relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-lg group">
        
        {/* Subtle Decorative Glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 rounded-full bg-cyan-500/5 blur-2xl group-hover:bg-cyan-500/10 transition-colors duration-700"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 rounded-full bg-slate-700/10 blur-xl"></div>

        <div className="relative z-10 px-5 py-4 flex flex-row items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-cyan-400/90 text-[10px] font-bold uppercase tracking-widest">
              Teacher Dashboard
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome back, {profile?.name}! 👋
            </h1>
          </div>
          
          <div className="hidden sm:block">
            <p className="text-slate-400 text-sm font-medium opacity-90">
              Another day to deal with students. 🚀
            </p>
          </div>
        </div>
      </div>

      {renderTabContent()}
    </div>
  );
};
