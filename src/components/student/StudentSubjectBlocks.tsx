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
  ChevronLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface StudentSubjectBlocksProps {
  batch: string;
  subject: string;
  onBack: () => void;
  onBlockSelect: (blockId: string) => void;
}

// Updated blocks with specific content counts ("stats")
const blocks = [
  {
    id: 'live-class',
    label: 'Join Live Class',
    // Live classes usually don't have "notes" counts in the same way, but keeping consistent format
    stats: ['Ongoing Classes', 'Upcoming Schedule'],
    icon: Radio,
    isLive: true,
  },
  {
    id: 'recordings',
    label: 'All Contents', // Changed to match "All Contents" from your example
    stats: ['120 Videos', '45 Exercises', '89 Notes'],
    icon: PlayCircle,
  },
  {
    id: 'mind-maps',
    label: 'Mind Maps || Only PDF',
    stats: ['0 Videos', '0 Exercises', '27 Notes'],
    icon: FileText,
  },
  {
    id: 'short-notes',
    label: 'Short Notes || Only PDF',
    stats: ['0 Videos', '0 Exercises', '35 Notes'],
    icon: FileText,
  },
  {
    id: 'pyq',
    label: 'PYQ Practice Sheet || Only PDF',
    stats: ['0 Videos', '0 Exercises', '58 Notes'],
    icon: FileText,
  },
  {
    id: 'ui-ki-padhai',
    label: 'UI Ki Padhai',
    stats: ['Premium Content', 'Exclusive Series'],
    icon: Crown,
  },
  {
    id: 'announcements',
    label: 'Announcements',
    stats: ['Latest Updates', 'Batch News'],
    icon: Megaphone,
  },
  {
    id: 'community',
    label: 'Community',
    stats: ['Discussions', 'Peer Support'],
    icon: Users,
  },
  {
    id: 'connect',
    label: 'Connect',
    stats: ['Chat with Teachers', 'Mentorship'],
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
      
      {/* Top Navbar - Clean, no XP badge */}
      <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#1e293b] font-medium text-[15px] hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
      </nav>

      {/* Main Content Wrapper - "Zoomed Out" Container */}
      <div className="max-w-[1000px] mx-auto mt-8 px-4 md:px-0">
        <div className="bg-white rounded-md border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-8">
          
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
                
                {/* Stats Row with Separators */}
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
