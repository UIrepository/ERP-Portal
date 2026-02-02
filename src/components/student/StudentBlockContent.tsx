import { StudentSubjectHeader } from './StudentSubjectHeader';
import { StudentSchedule } from './StudentSchedule';
import { StudentRecordings } from './StudentRecordings';
import { StudentNotes } from './StudentNotes';
import { StudentUIKiPadhai } from './StudentUIKiPadhai';
import { StudentAnnouncements } from './StudentAnnouncements';
import { StudentCommunity } from './StudentCommunity';
import { StudentConnect } from './StudentConnect';
import { StudentLiveClass } from './StudentLiveClass';

interface StudentBlockContentProps {
  blockId: string;
  batch: string;
  subject: string;
  onBack: () => void;
}

const blockLabels: Record<string, string> = {
  'live-class': 'Live Class',
  recordings: 'Lectures',
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
      case 'live-class':
        return <StudentLiveClass batch={batch} subject={subject} />;
      case 'recordings':
        return <StudentRecordings batch={batch} subject={subject} />;
      case 'notes':
        return <StudentNotes batch={batch} subject={subject} />;
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
    <div className="min-h-full bg-slate-50">
      {/* White sticky header with breadcrumb */}
      <StudentSubjectHeader
        batch={batch}
        subject={subject}
        block={blockId}
        blockLabel={blockLabels[blockId] || blockId}
        onBack={onBack}
      />

      {/* Content */}
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
};
