import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react';
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
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // 1. Fetch Active Notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_user_id', profile.user_id) // Matches Listener
        .eq('is_active', true) // Only show unread
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error("Error fetching notifications:", error);
        throw error;
      }
      return data;
    },
    enabled: !!profile?.user_id,
  });

  // 2. Realtime Listener for Badge Count (Updates count even if Listener is unmounted)
  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel('notification-badge-updater')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT (new) and UPDATE (read status)
          schema: 'public',
          table: 'notifications',
          filter: `target_user_id=eq.${profile.user_id}`
        },
        () => {
          // Whenever a notification is added or marked read, refresh the list
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, queryClient]);

  // 3. Mark Single Notification as Read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_active: false } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 4. Mark ALL as Read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_active: false } as any)
        .eq('target_user_id', profile.user_id)
        .eq('is_active', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsOpen(false);
    },
  });

  const unreadCount = notifications.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-background animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 md:w-96 p-0 mr-4 font-sans border-border/40 shadow-xl" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground/50 p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs">No new notifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map((notif: any) => (
                <div 
                  key={notif.id} 
                  className="flex gap-3 p-4 hover:bg-muted/30 transition-colors group relative cursor-pointer"
                  onClick={() => notif.link ? window.location.href = notif.link : null}
                >
                  {/* Status Indicator */}
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  
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

                  {/* Individual Mark Read Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-green-600 hover:bg-green-50 absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsReadMutation.mutate(notif.id);
                    }}
                    title="Mark as read"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
