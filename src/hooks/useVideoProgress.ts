/**
 * Hook to track and persist video playback progress per user
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface VideoProgress {
  progress_seconds: number;
  duration_seconds: number;
}

export const useVideoProgress = (recordingId: string | undefined) => {
  const { user } = useAuth();
  const lastSavedProgress = useRef<number>(0);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch saved progress for this video
  const fetchProgress = useCallback(async (): Promise<number> => {
    if (!user?.id || !recordingId) return 0;

    try {
      const { data, error } = await supabase
        .from('video_progress')
        .select('progress_seconds, duration_seconds')
        .eq('user_id', user.id)
        .eq('recording_id', recordingId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching video progress:', error);
        return 0;
      }

      if (data) {
        const progress = Number(data.progress_seconds);
        const duration = Number(data.duration_seconds);
        
        // If left at last 5 seconds or more, start from beginning
        if (duration > 0 && (duration - progress) <= 5) {
          return 0;
        }
        
        return progress;
      }

      return 0;
    } catch (err) {
      console.error('Error fetching progress:', err);
      return 0;
    }
  }, [user?.id, recordingId]);

  // Save progress to database
  const saveProgress = useCallback(async (currentTime: number, duration: number) => {
    if (!user?.id || !recordingId || duration <= 0) return;

    // Don't save if progress hasn't changed significantly (more than 5 seconds)
    if (Math.abs(currentTime - lastSavedProgress.current) < 5) return;

    try {
      const { error } = await supabase
        .from('video_progress')
        .upsert({
          user_id: user.id,
          recording_id: recordingId,
          progress_seconds: currentTime,
          duration_seconds: duration,
          last_watched_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,recording_id'
        });

      if (error) {
        console.error('Error saving video progress:', error);
      } else {
        lastSavedProgress.current = currentTime;
      }
    } catch (err) {
      console.error('Error saving progress:', err);
    }
  }, [user?.id, recordingId]);

  // Setup auto-save interval
  const startAutoSave = useCallback((getCurrentTime: () => number, getDuration: () => number) => {
    // Clear any existing interval
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
    }

    // Save progress every 10 seconds
    saveIntervalRef.current = setInterval(() => {
      const currentTime = getCurrentTime();
      const duration = getDuration();
      if (currentTime > 0 && duration > 0) {
        saveProgress(currentTime, duration);
      }
    }, 10000);
  }, [saveProgress]);

  // Stop auto-save
  const stopAutoSave = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoSave();
    };
  }, [stopAutoSave]);

  return {
    fetchProgress,
    saveProgress,
    startAutoSave,
    stopAutoSave,
  };
};
