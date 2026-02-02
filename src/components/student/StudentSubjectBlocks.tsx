import { 
  Video, 
  Calendar, 
  FileText, 
  Crown, 
  Megaphone, 
  Users, 
  UserCog,
  PlayCircle,
  Radio
} from 'lucide-react';
import { StudentSubjectHeader } from './StudentSubjectHeader';
import { cn } from '@/lib/utils';

interface StudentSubjectBlocksProps {
  batch: string;
  subject: string;
  onBack: () => void;
  onBlockSelect: (blockId: string) => void;
}

const blocks = [
  {
    id: 'live-class',
    label: 'Join Live Class',
    description: 'Ongoing & upcoming classes',
    icon: Radio,
    gradient: 'from-emerald-500 to-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    iconColor: 'text-emerald-600',
    isLive: true,
  },
  {
    id: 'recordings',
    label: 'Lectures',
    description: 'Watch recorded classes',
    icon: PlayCircle,
    gradient: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Download study materials',
    icon: FileText,
    gradient: 'from-violet-500 to-violet-600',
    bgColor: 'bg-violet-50 hover:bg-violet-100',
    iconColor: 'text-violet-600',
  },
  {
    id: 'ui-ki-padhai',
    label: 'UI Ki Padhai',
    description: 'Premium content',
    icon: Crown,
    gradient: 'from-amber-500 to-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    id: 'announcements',
    label: 'Announcements',
    description: 'Important updates',
    icon: Megaphone,
    gradient: 'from-rose-500 to-rose-600',
    bgColor: 'bg-rose-50 hover:bg-rose-100',
    iconColor: 'text-rose-600',
  },
  {
    id: 'community',
    label: 'Community',
    description: 'Discuss with peers',
    icon: Users,
    gradient: 'from-cyan-500 to-cyan-600',
    bgColor: 'bg-cyan-50 hover:bg-cyan-100',
    iconColor: 'text-cyan-600',
  },
  {
    id: 'connect',
    label: 'Connect',
    description: 'Chat with teachers & mentors',
    icon: UserCog,
    gradient: 'from-fuchsia-500 to-fuchsia-600',
    bgColor: 'bg-fuchsia-50 hover:bg-fuchsia-100',
    iconColor: 'text-fuchsia-600',
  },
];

export const StudentSubjectBlocks = ({
  batch,
  subject,
  onBack,
  onBlockSelect,
}: StudentSubjectBlocksProps) => {
  return (
    <div className="min-h-full bg-slate-50">
      {/* White sticky header */}
      <StudentSubjectHeader
        batch={batch}
        subject={subject}
        onBack={onBack}
      />

      {/* Blocks grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map((block) => (
            <button
              key={block.id}
              onClick={() => onBlockSelect(block.id)}
              className={cn(
                "group p-6 rounded-2xl text-left transition-all duration-300 relative",
                "border border-slate-200 hover:border-transparent",
                "hover:shadow-xl hover:-translate-y-1",
                block.bgColor
              )}
            >
              {/* Live indicator for live-class block */}
              {'isLive' in block && block.isLive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 uppercase">Live</span>
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg flex-shrink-0",
                  block.gradient
                )}>
                  <block.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg text-slate-800 group-hover:text-slate-900">
                    {block.label}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 truncate">
                    {block.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
