import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const NotificationListener = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // We use a ref to hold enrollments so we can access them inside the callback 
  // without re-subscribing constantly
  const enrollmentsRef = useRef<any[]>([]);

  // 1. Fetch Enrollments ONCE for filtering
  useEffect(() => {
    if (!profile?.user_id) return;
    const fetchEnrollments = async () => {
      const { data } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);
      if (data) enrollmentsRef.current = data;
    };
    fetchEnrollments();
  }, [profile?.user_id]);

  useEffect(() => {
    if (!profile?.user_id) return;

    // 2. Listen to DIRECT MESSAGES (Simple)
    const dmChannel = supabase
      .channel('dm-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${profile.user_id}`
        },
        () => {
          playNotificationSound();
          toast.info("New Direct Message");
          queryClient.invalidateQueries({ queryKey: ['virtual-notifications'] });
        }
      )
      .subscribe();

    // 3. Listen to COMMUNITY MESSAGES (Filter in Client)
    const commChannel = supabase
      .channel('community-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages'
        },
        (payload) => {
          const newMsg = payload.new as any;
          
          // A. Ignore my own messages
          if (newMsg.user_id === profile.user_id) return;

          // B. STRICT FILTER: Check if this msg belongs to one of my batches/subjects
          const isRelevant = enrollmentsRef.current.some(
            e => e.batch_name === newMsg.batch && e.subject_name === newMsg.subject
          );

          if (isRelevant) {
            playNotificationSound();
            toast.info(`New message in ${newMsg.subject}`);
            queryClient.invalidateQueries({ queryKey: ['virtual-notifications'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dmChannel);
      supabase.removeChannel(commChannel);
    };
  }, [profile?.user_id, queryClient]);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.error("Audio play failed", e));
    } catch (e) {
      console.error(e);
    }
  };

  return null;
};
