import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner"; 

export const NotificationListener = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.user_id) return;

    // Listen for NEW notifications specifically for this user
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          // ⚠️ IMPORTANT: This must match the column name in your DB
          filter: `target_user_id=eq.${profile.user_id}`
        },
        (payload) => {
          const newNotif = payload.new as any;
          
          // 1. Play Sound
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.5;
            audio.play().catch((e) => console.log("Audio play failed", e));
          } catch (e) {
            console.error("Audio error", e);
          }
          
          // 2. Show Toast
          toast.info(newNotif.title || "New Notification", {
            description: newNotif.message,
            duration: 5000,
            action: {
              label: "Mark Read",
              onClick: async () => {
                await supabase
                  .from('notifications')
                  .update({ is_active: false } as any)
                  .eq('id', newNotif.id);
                // Refresh the bell icon count immediately
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }
            }
          });

          // 3. Refresh Bell Icon Count (Refetch the query in NotificationCenter)
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
