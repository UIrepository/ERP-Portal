import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from 'date-fns';

export const NotificationCenter = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // 1. Fetch "Notifications" (Actually fetching Messages directly)
  const { data: notifications = [] } = useQuery({
    queryKey: ['virtual-notifications', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];

      // A. Get my enrollments (to know which batches I belong to)
      const { data: enrollments } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);

      const myBatches = enrollments?.map(e => e.batch_name) || [];
      const mySubjects = enrollments?.map(e => e.subject_name) || [];

      // B. Fetch Community Messages (Only for my batch & subject)
      const { data: commData } = await supabase
        .from('community_messages')
        .select('*, profiles(name)')
        .in('batch', myBatches)   // Initial filter by batch
        .order('created_at', { ascending: false })
        .limit(20);

      // Strict Filter: Ensure Subject matches too (avoiding cross-batch errors)
      // And filter out my own messages
      const communityMsgs = (commData || [])
        .filter(msg => 
            msg.user_id !== profile.user_id && // Don't notify me of my own msgs
            enrollments?.some(e => e.batch_name === msg.batch && e.subject_name === msg.subject)
        )
        .map(msg => ({
          id: msg.id,
          type: 'community',
          title: `New in ${msg.subject}`,
          message: `${msg.profiles?.name || 'User'}: ${msg.content || 'Sent an image'}`,
          link: '/student/community', // Adjust link as needed
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
        link: '/student/messages',
        created_at: msg.created_at
      }));

      // D. Merge and Sort
      const combined = [...communityMsgs, ...directMsgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return combined;
    },
    enabled: !!profile?.user_id,
    refetchInterval: 30000, // Poll every 30s to keep fresh
  });

  const count = notifications.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-background animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0 mr-4 shadow-xl" align="end">
        <div className="px-4 py-3 border-b bg-muted/40">
          <h4 className="font-semibold text-sm">Latest Messages</h4>
        </div>

        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No new messages.
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => window.location.href = notif.link}
                >
                  <div className="flex gap-3">
                    <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notif.type === 'dm' ? 'bg-blue-500' : 'bg-green-500'}`} />
                    <div>
                      <p className="text-sm font-medium leading-none mb-1">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
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
