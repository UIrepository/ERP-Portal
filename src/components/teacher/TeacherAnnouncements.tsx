import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  created_by_name: string | null;
}

const CardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white border border-[#eaebed] rounded-[4px] p-6 h-[220px] flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-[34px] h-[34px] rounded-full" />
          <div className="space-y-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-2 w-12" /></div>
        </div>
        <Skeleton className="h-5 w-3/4" />
        <div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /></div>
      </div>
    ))}
  </div>
);

const AnnouncementCard = ({ a }: { a: Announcement }) => (
  <div className="bg-white border border-[#eaebed] rounded-[4px] p-5 hover:border-[#d1d5db] transition-colors duration-200 flex flex-col h-[240px]">
    <div className="flex items-center gap-3 mb-3 shrink-0">
      <div className="w-[36px] h-[36px] shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-primary/10 border border-slate-100">
        <Megaphone className="h-4 w-4 text-primary" />
      </div>
      <div className="flex flex-col">
        <span className="text-[14px] font-semibold text-black font-sans leading-tight">UI Team</span>
        <span className="text-[11px] text-[#888888] font-sans mt-0.5">
          Sent by {a.created_by_name || 'Admin'} • {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
    <h3 className="text-[15px] font-semibold text-black mb-2 leading-snug tracking-tight shrink-0">{a.title}</h3>
    <div className="flex-1 overflow-y-auto pr-2 min-h-0">
      <p className="text-[13px] text-[#444444] font-normal leading-relaxed whitespace-pre-wrap font-sans">{a.message}</p>
    </div>
  </div>
);

export const TeacherAnnouncements = () => {
  const { profile } = useAuth();

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['teacher-my-announcements', profile?.user_id],
    queryFn: async (): Promise<Announcement[]> => {
      if (!profile?.user_id) return [];
      // RLS only returns rows targeted at this teacher; the explicit filters keep
      // the payload tight and the intent clear.
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, created_at, created_by_name')
        .eq('target_role', 'teacher')
        .eq('target_user_id', profile.user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as Announcement[];
    },
    enabled: !!profile?.user_id,
  });

  return (
    <div className="w-full font-sans antialiased">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" /> Announcements
        </h1>
        <p className="text-sm text-slate-500 mt-1">Updates sent to you by the admin team.</p>
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : announcements && announcements.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {announcements.map((a) => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-[#eaebed] rounded-[4px]">
          <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-3">
            <span className="text-lg opacity-50">📭</span>
          </div>
          <h3 className="text-sm font-bold text-black">No announcements yet</h3>
          <p className="text-xs text-[#888888] mt-1">Messages from the admin team will appear here.</p>
        </div>
      )}
    </div>
  );
};
