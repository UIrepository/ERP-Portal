import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TeacherSchedule } from './TeacherSchedule';
import { TeacherRecordings } from './TeacherRecordings';
import { TeacherScheduleRequests } from './TeacherScheduleRequests';
import { StaffInbox } from '@/components/shared/StaffInbox';
import { TeacherFeedbackViewer } from './TeacherFeedbackViewer';
import { TeacherJoinClass } from './TeacherJoinClass';
import { TeacherCommunity } from './TeacherCommunity'; 
import { Button } from '@/components/ui/button';
import { FullScreenVideoPlayer } from '@/components/video-player/FullScreenVideoPlayer';
import { Lecture } from '@/components/video-player/types';

interface TeacherDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TeacherDashboard = ({ activeTab, onTabChange }: TeacherDashboardProps) => {
  const { profile, resolvedRole } = useAuth();
  const [showTutorial, setShowTutorial] = useState(false);

  // Define the tutorial video as a Lecture object for the player
  const tutorialLecture: Lecture = {
    id: 'dashboard-tutorial',
    title: 'How to use the Dashboard',
    videoUrl: 'https://youtu.be/qxk40T2SLJM',
    subject: 'Tutorial',
    duration: '5:00' // Estimated duration
  };

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
      
      {/* --- COMPACT WELCOME BANNER (Single Blue Theme) --- */}
      <div className="mb-6 relative overflow-hidden rounded-xl bg-blue-50 shadow-sm border border-blue-100 group">
        
        {/* Premium Effect Pattern (Refined Single Color Glows) */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl group-hover:bg-blue-500/10 transition-colors duration-1000"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 rounded-full bg-blue-400/5 blur-2xl"></div>
        
        <div className="relative z-10 px-5 py-5 flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight font-sans">
            Welcome back, {profile?.name}! 👋
          </h1>
          <p className="text-slate-500 text-sm font-normal font-sans">
            Another day to deal with students.
          </p>
          
          {/* Tutorial Button with Inter Regular font (font-sans font-normal) */}
          <Button 
            variant="outline"
            className="w-fit mt-3 bg-white hover:bg-slate-50 text-slate-700 border-blue-200 font-sans font-normal shadow-sm"
            onClick={() => setShowTutorial(true)}
          >
            How to use me?
          </Button>
        </div>
      </div>

      {renderTabContent()}

      {/* Video Player Overlay */}
      {showTutorial && (
        <FullScreenVideoPlayer
          currentLecture={tutorialLecture}
          lectures={[tutorialLecture]}
          onClose={() => setShowTutorial(false)}
          userName={profile?.name}
        />
      )}
    </div>
  );
};
