import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const NotificationListener = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const enrollmentsRef = useRef<any[]>([]);

  // 1. Fetch Enrollments
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

    // 2. Direct Messages Listener
    const dmChannel = supabase
      .channel('dm-listener')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages', 
        filter: `receiver_id=eq.${profile.user_id}` 
      }, 
      (payload) => {
        const newMsg = payload.new as any;
        playNotificationSound();
        toast.info("New Direct Message", {
          description: "Click to view chat",
          action: {
            label: "Open Chat",
            // 🟢 Opens the specific chat
            onClick: () => navigate(`/student/messages?chatId=${newMsg.sender_id}`) 
          }
        });
        queryClient.invalidateQueries({ queryKey: ['virtual-notifications'] });
      })
      .subscribe();

    // 3. Community Messages Listener
    const commChannel = supabase
      .channel('community-listener')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'community_messages' 
      }, 
      (payload) => {
        const newMsg = payload.new as any;
        
        if (newMsg.user_id === profile.user_id) return;

        const isRelevant = enrollmentsRef.current.some(
          e => e.batch_name === newMsg.batch && e.subject_name === newMsg.subject
        );

        if (isRelevant) {
          playNotificationSound();
          toast.info(`New in ${newMsg.subject}`, {
            description: newMsg.content ? (newMsg.content.length > 40 ? newMsg.content.substring(0,40)+'...' : newMsg.content) : "Sent an attachment",
            action: {
              label: "View",
              // 🟢 Just opens the Community page (Normal Link)
              onClick: () => navigate('/student/community') 
            }
          });
          queryClient.invalidateQueries({ queryKey: ['virtual-notifications'] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dmChannel);
      supabase.removeChannel(commChannel);
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
