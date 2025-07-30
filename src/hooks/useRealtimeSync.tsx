
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Custom hook for centralizing real-time synchronization logic
export const useRealtimeSync = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.user_id) return;

    console.log('Setting up global real-time subscriptions for user:', profile.user_id);

    // Create a single channel for all real-time updates
    const globalChannel = supabase
      .channel('global-realtime-sync')
      // User enrollments changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_enrollments',
          filter: `user_id=eq.${profile.user_id}`
        },
        (payload) => {
          console.log('Global sync: user_enrollments changed', payload);
          queryClient.invalidateQueries({ queryKey: ['userEnrollments'] });
          queryClient.invalidateQueries({ queryKey: ['dashboardUserEnrollments'] });
          queryClient.invalidateQueries({ queryKey: ['sidebarUserEnrollments'] });
        }
      )
      // Profile changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${profile.user_id}`
        },
        (payload) => {
          console.log('Global sync: profiles changed', payload);
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
      )
      // Schedules changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules'
        },
        (payload) => {
          console.log('Global sync: schedules changed', payload);
          queryClient.invalidateQueries({ queryKey: ['student-schedule-direct'] });
          queryClient.invalidateQueries({ queryKey: ['allStudentSchedulesRPC'] });
          queryClient.invalidateQueries({ queryKey: ['ongoingClassRPC'] });
        }
      )
      // Meeting links changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_links'
        },
        (payload) => {
          console.log('Global sync: meeting_links changed', payload);
          queryClient.invalidateQueries({ queryKey: ['student-schedule-direct'] });
          queryClient.invalidateQueries({ queryKey: ['ongoingClassRPC'] });
        }
      )
      // Notes changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes'
        },
        (payload) => {
          console.log('Global sync: notes changed', payload);
          queryClient.invalidateQueries({ queryKey: ['student-notes'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
        }
      )
      // Recordings changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recordings'
        },
        (payload) => {
          console.log('Global sync: recordings changed', payload);
          queryClient.invalidateQueries({ queryKey: ['student-recordings'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
        }
      )
      // DPP content changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dpp_content'
        },
        (payload) => {
          console.log('Global sync: dpp_content changed', payload);
          queryClient.invalidateQueries({ queryKey: ['student-dpp'] });
          queryClient.invalidateQueries({ queryKey: ['student-ui-ki-padhai'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
        }
      )
      // Feedback changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback'
        },
        (payload) => {
          console.log('Global sync: feedback changed', payload);
          queryClient.invalidateQueries({ queryKey: ['student-submitted-feedback'] });
          queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
        }
      )
      // Student activities changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_activities',
          filter: `user_id=eq.${profile.user_id}`
        },
        (payload) => {
          console.log('Global sync: student_activities changed', payload);
          queryClient.invalidateQueries({ queryKey: ['student-activities'] });
        }
      )
      .subscribe((status) => {
        console.log('Global real-time subscription status:', status);
      });

    return () => {
      console.log('Cleaning up global real-time subscriptions');
      supabase.removeChannel(globalChannel);
    };
  }, [profile?.user_id, queryClient]);

  return { isConnected: !!profile?.user_id };
};
