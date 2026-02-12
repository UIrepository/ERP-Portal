import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom'; // 🟢 Added useNavigate

export const NotificationCenter = () => {
  const { profile } = useAuth();
  const navigate = useNavigate(); // 🟢 Hook for navigation
  const [isOpen, setIsOpen] = useState(false);

  // Fetch "Virtual" Notifications from Chat Tables
  const { data: notifications = [] } = useQuery({
    queryKey: ['virtual-notifications', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];

      // A. Get My Enrollments (to filter community messages)
      const { data: enrollments } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);

      const myBatches = enrollments?.map(e => e.batch_name) || [];

      // B. Fetch Community Messages (Filtered by Batch first)
      const { data: commData } = await supabase
        .from('community_messages')
        .select('*, profiles(name)')
        .in('batch', myBatches)
        .order('created_at', { ascending: false })
        .limit(20);

      // Strict Client-Side Filter: Subject must also match
      const communityMsgs = (commData || [])
        .filter(msg => 
            msg.user_id !== profile.user_id && // Don't notify me of my own messages
            enrollments?.some(e => e.batch_name === msg.batch && e.subject_name === msg.subject)
        )
        .map(msg => ({
          id: msg.id,
          type: 'community',
          title: `New in ${msg.subject}`,
          message: `${msg.profiles?.name || 'User'}: ${msg.content || 'Sent an image'}`,
          // 🟢 Deep Link Construction
          link: `/student/community?batch=${encodeURIComponent(msg.batch)}&subject=${encodeURIComponent(msg.subject)}`,
          created_at: msg.created_at
        }));

      // C. Fetch Direct Messages (Sent to me)
      const { data: dmData } = await supabase
        .from('direct_messages')
        .select('*, profiles:sender_id(name)')
        .eq('receiver_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(20);

      const directMsgs = (dmData || []).map(msg => ({
        id: msg.id,
        type: 'dm',
        title: `Message from ${msg.profiles?.name || 'Unknown'}`,
        message: msg.content || 'Sent an attachment',
        // 🟢 Deep Link to DM
        link: `/student/messages?chatId=${msg.sender_id}`, 
        created_at: msg.created_at
      }));

      // D. Merge & Sort by newest
      return [...communityMsgs, ...directMsgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!profile?.user_id,
    refetchInterval: 30000, // Poll every 30s to keep it somewhat fresh
  });

  const count = notifications.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-background animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 md:w-96 p-0 mr-4 font-sans border-border/40 shadow-xl" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40 backdrop-blur-sm">
          <h4 className="font-semibold text-sm">Latest Messages</h4>
        </div>

        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground/50 p-8 text-center">
              <p className="text-sm font-medium">All caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className="flex gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setIsOpen(false);
                    navigate(notif.link); // 🟢 Instant Navigation
                  }}
                >
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notif.type === 'dm' ? 'bg-blue-500' : 'bg-green-500'}`} />
                  
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground leading-none">
                      {notif.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 font-medium pt-1">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
