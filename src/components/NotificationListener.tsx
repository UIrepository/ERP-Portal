import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner"; // Using Sonner for cleaner toasts

export const NotificationListener = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `target_user_id=eq.${profile.user_id}`
        },
        (payload) => {
          const newNotif = payload.new as any;
          
          // 1. Play Sound (Subtle "Ding")
          // Ensure this file exists in /public or use a remote URL
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.4;
          audio.play().catch(() => {});
          
          // 2. Show Toast
          toast.info(newNotif.title, {
            description: newNotif.message,
            duration: 5000,
            action: {
              label: "Mark Read",
              onClick: async () => {
                await supabase
                  .from('notifications')
                  .update({ is_active: false } as any)
                  .eq('id', newNotif.id);
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          });

          // 3. Refresh Bell Icon Count
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, queryClient]);

  return null;
};
