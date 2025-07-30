import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useRealtimeSync = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase.channel('database-changes');

    const subscription = channel
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('Realtime change received!', payload);
        
        // A change has occurred, so we invalidate all queries.
        // This is a "catch-all" approach to ensure data is always fresh.
        // TanStack Query is smart and will only refetch data for active components.
        queryClient.invalidateQueries();
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates!');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Real-time channel error:', err);
        }
        if (status === 'TIMED_OUT') {
          console.warn('Real-time connection timed out.');
        }
        if (status === 'CLOSED') {
          console.warn('Real-time connection closed.');
        }
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [profile?.user_id, queryClient]);

  return { isConnected: !!profile?.user_id };
};
