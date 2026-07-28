import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const NotificationListener = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile?.user_id) return;

    // Direct messages addressed to me — filtered server-side, so this is cheap.
    //
    // NOTE: the global `community_messages` realtime listener that used to live
    // here was removed to cut Supabase egress. It was mounted app-wide (Layout)
    // for every user on every page and streamed EVERY community message to EVERY
    // connected client — the dominant egress driver. New community messages are
    // already delivered via web push, and the unread badge polls on its own, so
    // nothing is lost.
    const dmChannel = supabase
      .channel('dm-listener')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${profile.user_id}`,
      }, () => {
        playNotificationSound();
        toast.info("New Direct Message", {
          description: "Click to view chat",
          action: { label: "Open Chat", onClick: () => navigate('/') },
        });
        // Refresh the bell (unread DMs) and the support-FAB badge.
        queryClient.invalidateQueries({ queryKey: ['notifications-standard'] });
        queryClient.invalidateQueries({ queryKey: ['support-unread'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dmChannel);
    };
  }, [profile?.user_id, queryClient, navigate]);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  return null;
};
