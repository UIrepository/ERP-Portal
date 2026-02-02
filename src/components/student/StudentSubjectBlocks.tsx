import { 
  Video, 
  Calendar, 
  FileText, 
  Crown, 
  Megaphone, 
  Users, 
  UserCog,
  ArrowLeft,
  PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StudentSubjectBlocksProps {
  batch: string;
  subject: string;
  onBack: () => void;
  onBlockSelect: (blockId: string) => void;
}

const blocks = [
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
    id: 'schedule',
    label: 'Schedule',
    description: 'View class timetable',
    icon: Calendar,
    gradient: 'from-emerald-500 to-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    iconColor: 'text-emerald-600',
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
      {/* Header with SELECTED BATCH styling */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-b-2xl shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-slate-300 hover:text-white hover:bg-slate-700/50 mb-3 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Subjects
          </Button>
          <div>
            <p className="text-cyan-400/80 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Selected Batch
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">{batch} - {subject}</h1>
          </div>
        </div>
      </div>

      {/* Blocks grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map((block) => (
            <button
              key={block.id}
              onClick={() => onBlockSelect(block.id)}
              className={cn(
                "group p-6 rounded-2xl text-left transition-all duration-300",
                "border border-slate-200 hover:border-transparent",
                "hover:shadow-xl hover:-translate-y-1",
                block.bgColor
              )}
            >
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
