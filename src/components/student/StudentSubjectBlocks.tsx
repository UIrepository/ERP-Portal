import { 
  Video, 
  Calendar, 
  FileText, 
  Crown, 
  Megaphone, 
  Users, 
  UserCog,
  PlayCircle,
  Radio,
  ChevronLeft,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
    stats: ['Ongoing', 'Upcoming'],
    icon: Radio,
    isLive: true,
  },
  {
    id: 'recordings',
    label: 'Lectures',
    stats: ['All Videos', 'Recorded'],
    icon: PlayCircle,
  },
  {
    id: 'notes',
    label: 'Notes & PDFs',
    stats: ['Study Material', 'Assignments'],
    icon: FileText,
  },
  {
    id: 'ui-ki-padhai',
    label: 'UI Ki Padhai',
    stats: ['Premium Content', 'Exclusive'],
    icon: Crown,
  },
  {
    id: 'announcements',
    label: 'Announcements',
    stats: ['Updates', 'News'],
    icon: Megaphone,
  },
  {
    id: 'community',
    label: 'Community',
    stats: ['Discussions', 'Doubts'],
    icon: Users,
  },
  {
    id: 'connect',
    label: 'Connect',
    stats: ['Chat with Teachers', 'Support'],
    icon: UserCog,
  },
];

export const StudentSubjectBlocks = ({
  batch,
  subject,
  onBack,
  onBlockSelect,
}: StudentSubjectBlocksProps) => {
  return (
    <div className="min-h-screen bg-[#f4f4f5] font-sans pb-10">
      
      {/* Top Navbar */}
      <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#1e293b] font-medium text-[15px] hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>

        <div className="bg-[#f1f5f9] px-3.5 py-1.5 rounded flex items-center gap-2 border border-slate-200 text-[#475569] text-sm font-semibold">
          <Award className="h-4 w-4" />
          XP 0
        </div>
      </nav>

      {/* Main Content Wrapper */}
      <div className="max-w-[1000px] mx-auto mt-10 px-4 md:px-0">
        <div className="bg-white rounded-md border border-slate-200 shadow-sm p-6 md:p-10">
          
          <h2 className="text-[26px] font-bold text-[#1e293b] mb-8 tracking-tight">
            {subject}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {blocks.map((block) => (
              <button
                key={block.id}
                onClick={() => onBlockSelect(block.id)}
                className={cn(
                  "group relative w-full text-left",
                  "bg-[#efede7] hover:bg-[#e5e2d9]", // Mud Light background + darker hover
                  "p-6 rounded-[4px]", // Very low rounded corners
                  "transition-all duration-200 ease-in-out",
                  "flex flex-col justify-center",
                  "transform hover:-translate-y-[2px]" // Subtle lift
                )}
              >
                {/* Live Indicator */}
                {'isLive' in block && block.isLive && (
                  <div className="absolute top-4 right-4">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  </div>
                )}

                <h3 className="text-[17px] font-semibold text-[#27272a] mb-2 group-hover:text-black">
                  {block.label}
                </h3>
                
                <div className="flex items-center text-[13px] text-[#71717a] font-normal">
                  {block.stats.map((stat, index) => (
                    <span key={index} className="flex items-center">
                      {index > 0 && <span className="mx-3 text-[#d4d4d8]">|</span>}
                      {stat}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};
