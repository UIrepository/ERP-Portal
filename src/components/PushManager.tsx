import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToPush, pushSupported } from '@/lib/push';

/**
 * Keeps the logged-in user subscribed to web push.
 * - If permission is already granted, (re)subscribes silently and stores it.
 * - After the PWA is installed, enables notifications too.
 * The explicit opt-in lives in the navbar toggle beside the bell.
 */
export const PushManager = () => {
  const { profile, user } = useAuth();
  const userId = user?.id || profile?.user_id;

  useEffect(() => {
    if (!userId || !pushSupported()) return;
    // Already granted → make sure we have a fresh subscription saved.
    if (Notification.permission === 'granted') {
      void subscribeToPush(userId);
    }
  }, [userId]);

  // When the app gets installed, enable notifications too.
  useEffect(() => {
    if (!userId) return;
    const onInstalled = () => { void subscribeToPush(userId); };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [userId]);

  return null;
};
