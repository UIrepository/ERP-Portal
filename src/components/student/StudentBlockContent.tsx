import { ChevronLeft } from 'lucide-react';
import { StudentSchedule } from './StudentSchedule';
import { StudentRecordings } from './StudentRecordings';
import { StudentNotes } from './StudentNotes';
import { StudentUIKiPadhai } from './StudentUIKiPadhai';
import { StudentAnnouncements } from './StudentAnnouncements';
import { StudentCommunity } from './StudentCommunity';
import { StudentConnect } from './StudentConnect';
import { StudentLiveClass } from './StudentLiveClass';
import { StudentDPP } from './StudentDPP';

interface StudentBlockContentProps {
  blockId: string;
  batch: string;
  subject: string;
  onBack: () => void;
}

export const StudentBlockContent = ({
  blockId,
  batch,
  subject,
  onBack,
}: StudentBlockContentProps) => {
  const renderContent = () => {
    switch (blockId) {
      case 'live-class':
        return <div className="p-4 md:p-6"><StudentLiveClass batch={batch} subject={subject} /></div>;
      case 'recordings':
        return <StudentRecordings batch={batch} subject={subject} />;
      case 'notes':
        return <StudentNotes batch={batch} subject={subject} />;
      case 'dpps':
        return <StudentDPP batch={batch} subject={subject} />;
      case 'ui-ki-padhai':
        return <StudentUIKiPadhai batch={batch} subject={subject} />;
      case 'announcements':
        return <StudentAnnouncements batch={batch} subject={subject} />;
      case 'community':
        return <StudentCommunity />;
      case 'connect':
        return <StudentConnect />;
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Content not found</p>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-[1840px] mx-auto px-4 md:px-6 py-6 font-sans">

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#1e293b] font-medium text-[15px] hover:opacity-80 transition-opacity mb-4"
      >
        <ChevronLeft className="h-5 w-5" />
        Back
      </button>

      {/* Framed content card (matches dashboard frame) */}
      <div className="w-full bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
};
