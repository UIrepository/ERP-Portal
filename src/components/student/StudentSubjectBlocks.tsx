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
  MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChatDrawer } from '@/hooks/useChatDrawer';

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
  const { openSubjectConnect } = useChatDrawer();

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
      isLive: true,
    },
    {
      id: 'recordings',
      label: 'Lectures',
      stats: [
        isLoading ? 'Loading...' : `${stats?.videos} Videos`, 
        isLoading ? '...' : `${stats?.exercises} Exercises`
      ], 
    },
    {
      id: 'notes',
      label: 'Notes & PDFs',
      stats: [
        isLoading ? 'Loading...' : `${stats?.notes} Notes`, 
        'Assignments'
      ],
    },
    {
      id: 'ui-ki-padhai',
      label: 'UI Ki Padhai',
      stats: [
        isLoading ? 'Loading...' : `${stats?.premium} Premium Content`, 
        'Exclusive Series'
      ],
    },
    {
      id: 'announcements',
      label: 'Announcements',
      stats: ['Latest Updates', 'Batch News'],
    },
    {
      id: 'community',
      label: 'Community',
      stats: ['Discussions', 'Peer Support'],
    },
    {
      id: 'connect',
      label: 'Connect',
      stats: ['Chat with Teachers', 'Mentorship'],
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
                onClick={() => {
                  if (block.id === 'connect') {
                    openSubjectConnect(batch, subject);
                  } else {
                    onBlockSelect(block.id);
                  }
                }}
                className={cn(
                  "group relative w-full text-left",
                  // White Background, Rounded Corners
                  "bg-white rounded-[4px]", 
                  // Static Border (No hover change)
                  "border border-slate-200", 
                  // No hover effects (transform, shadow, etc. removed)
                  "p-6", 
                  "flex items-stretch gap-4"
                )}
              >
                {/* Blue Bar */}
                <div className="w-1 bg-[#3b82f6] rounded-full shrink-0" />

                {/* Content */}
                <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-[17px] font-semibold text-[#1e293b] mb-2">
                      {block.label}
                    </h3>
                    
                    {/* Stats Row */}
                    <div className="flex items-center text-[13px] text-[#71717a] font-normal">
                      {block.stats.map((stat, index) => (
                        <span key={index} className="flex items-center">
                          {index > 0 && <span className="mx-3 text-[#d4d4d8]">|</span>}
                          {stat}
                        </span>
                      ))}
                    </div>
                </div>

                {/* Live Indicator */}
                {'isLive' in block && block.isLive && (
                  <div className="absolute top-4 right-4">
                     <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
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
