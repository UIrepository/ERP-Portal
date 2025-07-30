import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Custom hook for centralizing ALL real-time synchronization logic
export const useRealtimeSync = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel('global-realtime-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules',
        },
        (payload) => {
          console.log('REALTIME: schedules changed', payload);
          queryClient.invalidateQueries({ queryKey: ['student-schedule-direct'] });
          queryClient.invalidateQueries({ queryKey: ['allStudentSchedulesRPC'] });
          queryClient.invalidateQueries({ queryKey: ['ongoingClassRPC'] });
          queryClient.invalidateQueries({ queryKey: ['teacher-schedule'] });
          queryClient.invalidateQueries({ queryKey: ['teacher-upcoming-classes'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_links',
        },
        (payload) => {
          console.log('REALTIME: meeting_links changed', payload);
          queryClient.invalidateQueries({ queryKey: ['allStudentSchedulesRPC'] });
          queryClient.invalidateQueries({ queryKey: ['ongoingClassRPC'] });
          queryClient.invalidateQueries({ queryKey: ['teacher-upcoming-classes'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_enrollments',
          filter: `user_id=eq.${profile.user_id}`
        },
        (payload) => {
          console.log('REALTIME: user_enrollments changed', payload);
          // Invalidate all queries as enrollments affect everything a user sees
          queryClient.invalidateQueries(); 
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes'
        },
        () => {
          console.log('Real-time update: notes changed');
          queryClient.invalidateQueries({ queryKey: ['student-notes'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recordings'
        },
        () => {
          console.log('Real-time update: recordings changed');
          queryClient.invalidateQueries({ queryKey: ['student-recordings'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dpp_content'
        },
        () => {
          console.log('Real-time update: dpp_content changed');
          queryClient.invalidateQueries({ queryKey: ['student-dpp'] });
          queryClient.invalidateQueries({ queryKey: ['student-ui-ki-padhai'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
        }
      )
      .subscribe((status) => {
        console.log(`Global real-time subscription status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, queryClient]);

  return { isConnected: !!profile?.user_id };
};
