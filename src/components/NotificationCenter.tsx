import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export const NotificationCenter = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  // Track IDs of notifications the student has swiped/removed
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const { data: rawNotifications = [] } = useQuery({
    queryKey: ['virtual-notifications', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];

      const { data: enrollments } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);

      const myBatches = enrollments?.map(e => e.batch_name) || [];
      let communityMsgs: any[] = [];
      
      if (myBatches.length > 0) {
        const { data: commData } = await supabase
          .from('community_messages')
          .select('*, profiles(name)')
          .in('batch', myBatches)
          .order('created_at', { ascending: false })
          .limit(20);

        communityMsgs = (commData || [])
          .filter(msg => 
              msg.user_id !== profile.user_id && 
              enrollments?.some(e => e.batch_name === msg.batch && e.subject_name === msg.subject)
          )
          .map(msg => ({
            id: msg.id,
            type: 'community',
            title: `New in ${msg.subject}`,
            message: `${msg.profiles?.name || 'User'}: ${msg.content || 'Sent an image'}`,
            created_at: msg.created_at
          }));
      }

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
        created_at: msg.created_at
      }));

      // Merge and ensure most recent are at the top
      return [...communityMsgs, ...directMsgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!profile?.user_id,
    refetchInterval: 5000,
  });

  // Filter out notifications the user has removed
  const activeNotifications = rawNotifications.filter(n => !dismissedIds.includes(n.id));
  const count = activeNotifications.length;

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => [...prev, id]);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 md:w-96 p-0 mr-4 font-sans border-border/40 shadow-xl" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40 backdrop-blur-sm">
          <h4 className="font-semibold text-sm">Latest Messages</h4>
          {count > 0 && (
            <button 
              onClick={() => setDismissedIds(rawNotifications.map(n => n.id))}
              className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-primary"
            >
              Clear All
            </button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {activeNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground/50 p-8 text-center">
              <p className="text-sm font-medium">No new notifications</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <AnimatePresence initial={false}>
                {activeNotifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="relative border-b border-border/30 bg-background"
                  >
                    <div className="flex gap-3 p-4 group">
                      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notif.type === 'dm' ? 'bg-blue-500' : 'bg-teal-500'}`} />
                      
                      <div className="flex-1 space-y-1 pr-6">
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

                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(notif.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
