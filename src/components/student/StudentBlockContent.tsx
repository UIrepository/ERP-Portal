import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentSchedule } from './StudentSchedule';
import { StudentRecordings } from './StudentRecordings';
import { StudentNotes } from './StudentNotes';
import { StudentUIKiPadhai } from './StudentUIKiPadhai';
import { StudentAnnouncements } from './StudentAnnouncements';
import { StudentCommunity } from './StudentCommunity';
import { StudentConnect } from './StudentConnect';

interface StudentBlockContentProps {
  blockId: string;
  batch: string;
  subject: string;
  onBack: () => void;
}

const blockLabels: Record<string, string> = {
  recordings: 'Lectures',
  schedule: 'Schedule',
  notes: 'Notes',
  'ui-ki-padhai': 'UI Ki Padhai',
  announcements: 'Announcements',
  community: 'Community',
  connect: 'Connect with Mentors',
};

export const StudentBlockContent = ({
  blockId,
  batch,
  subject,
  onBack,
}: StudentBlockContentProps) => {
  const renderContent = () => {
    switch (blockId) {
      case 'schedule':
        return <StudentSchedule />;
      case 'recordings':
        return <StudentRecordings />;
      case 'notes':
        return <StudentNotes />;
      case 'ui-ki-padhai':
        return <StudentUIKiPadhai />;
      case 'announcements':
        return <StudentAnnouncements />;
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
    <div className="min-h-full bg-slate-50">
      {/* Header with breadcrumb */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-slate-300 hover:text-white hover:bg-slate-700/50 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {subject}
          </Button>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
            <span>{batch}</span>
            <span>→</span>
            <span>{subject}</span>
            <span>→</span>
            <span className="text-white font-medium">{blockLabels[blockId] || blockId}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
};
