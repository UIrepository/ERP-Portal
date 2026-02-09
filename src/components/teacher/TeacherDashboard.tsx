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
      
      {/* --- WELCOME BANNER (Purplish Patterned CTA Style) --- */}
      <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 shadow-xl shadow-purple-200 transition-all hover:shadow-2xl hover:shadow-purple-300/50 group">
        
        {/* Background Pattern Effects (CSS Shapes) */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 rounded-full bg-white/10 blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 rounded-full bg-white/10 blur-2xl group-hover:scale-110 transition-transform duration-700 delay-100"></div>
        <div className="absolute top-1/2 left-1/4 w-20 h-20 rounded-full bg-indigo-400/20 blur-xl"></div>
        
        {/* Decorative Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              Welcome back, {profile?.name}! 👋
            </h1>
            <p className="text-purple-100 text-lg font-medium opacity-90 max-w-lg leading-relaxed">
              Another day to deal with students. 
            </p>
          </div>
        </div>
      </div>

      {renderTabContent()}
    </div>
  );
};
