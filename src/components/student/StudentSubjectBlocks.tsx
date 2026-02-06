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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StudentSubjectBlocksProps {
  batch: string;
  subject: string;
  onBack: () => void;
  onBlockSelect: (blockId: string) => void;
}

export const StudentSubjectBlocks = ({
  batch,
  subject,
  onBack,
  onBlockSelect,
}: StudentSubjectBlocksProps) => {

  // Fetch real content counts from the database
  const { data: stats, isLoading } = useQuery({
    queryKey: ['subject-stats', batch, subject],
    queryFn: async () => {
      const [recordings, notes, dpp, premium] = await Promise.all([
        supabase
          .from('recordings')
          .select('*', { count: 'exact', head: true })
          .eq('batch', batch)
          .eq('subject', subject),
        supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('batch', batch)
          .eq('subject', subject),
        supabase
          .from('dpp_content')
          .select('*', { count: 'exact', head: true })
          .eq('batch', batch)
          .eq('subject', subject),
        supabase
          .from('ui_ki_padhai_content')
          .select('*', { count: 'exact', head: true })
          .eq('batch', batch)
          .eq('subject', subject),
      ]);

      return {
        videos: recordings.count || 0,
        notes: notes.count || 0,
        exercises: dpp.count || 0,
        premium: premium.count || 0,
      };
    },
    staleTime: 1000 * 60 * 5, 
  });

  const blocks = [
    {
      id: 'live-class',
      label: 'Join Live Class',
      stats: ['Ongoing Classes', 'Upcoming Schedule'],
      icon: Radio,
      isLive: true,
    },
    {
      id: 'recordings',
      label: 'Lectures',
      stats: [
        isLoading ? 'Loading...' : `${stats?.videos} Videos`, 
        isLoading ? '...' : `${stats?.exercises} Exercises`
      ], 
      icon: PlayCircle,
    },
    {
      id: 'notes',
      label: 'Notes & PDFs',
      stats: [
        isLoading ? 'Loading...' : `${stats?.notes} Notes`, 
        'Assignments'
      ],
      icon: FileText,
    },
    {
      id: 'ui-ki-padhai',
      label: 'UI Ki Padhai',
      stats: [
        isLoading ? 'Loading...' : `${stats?.premium} Premium Content`, 
        'Exclusive Series'
      ],
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

  return (
    <div className="min-h-screen bg-[#F8F8F8] font-sans pb-10">
      
      {/* Top Navbar */}
      <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#1e293b] font-medium text-[15px] hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
      </nav>

      {/* Main Content Wrapper */}
      <div className="max-w-[1200px] mx-auto mt-8 px-4 md:px-6">
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
                  // Premium Background: Slate 50 -> White on Hover
                  "bg-[#F8FAFC] hover:bg-white", 
                  // Border & Shadow
                  "border border-slate-100 hover:border-slate-200",
                  "shadow-sm hover:shadow-md",
                  // Layout & Transition
                  "p-5 rounded-xl",
                  "transition-all duration-300 ease-out",
                  "flex items-stretch gap-5",
                  "transform hover:-translate-y-[2px]"
                )}
              >
                {/* 1. Left Accent Bar (Not connected to sides) */}
                <div className={cn(
                    "w-1.5 rounded-full shrink-0 transition-colors duration-300",
                    "bg-slate-200 group-hover:bg-[#0F172A]" // Subtle Gray -> Dark Slate Accent
                )} />

                {/* 2. Content */}
                <div className="flex-1 flex flex-col justify-center py-0.5">
                    <div className="flex items-start justify-between">
                        <h3 className="text-[17px] font-semibold text-[#1e293b] mb-1.5 group-hover:text-[#0F172A] tracking-tight">
                        {block.label}
                        </h3>
                        
                        {/* Subtle Icon on Top Right */}
                        <block.icon className="h-5 w-5 text-slate-300 group-hover:text-[#5d87a8] transition-colors duration-300" strokeWidth={1.5} />
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center text-[13px] text-[#64748b] font-medium">
                        {block.stats.map((stat, index) => (
                            <span key={index} className="flex items-center">
                            {index > 0 && <span className="mx-2 text-slate-300 text-[8px]">•</span>}
                            {stat}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Live Indicator */}
                {'isLive' in block && block.isLive && (
                  <div className="absolute top-4 right-4">
                     {/* Hidden if icon is present to prevent overlap, or adjust position */}
                  </div>
                )}
                {'isLive' in block && block.isLive && (
                    <div className="absolute -top-1 -right-1 h-3 w-3">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                    </div>
                )}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};
