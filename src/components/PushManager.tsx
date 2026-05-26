import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { subscribeToPush, isPushSubscribed, pushSupported } from '@/lib/push';

// How often to re-nudge while notifications are still off.
const REPROMPT_INTERVAL_MS = 4 * 60 * 1000;

/**
 * Keeps the logged-in user subscribed to web push.
 * - If permission is already granted, (re)subscribes silently and stores it.
 * - While notifications are OFF, shows a "Turn on notifications" prompt from
 *   time to time (not when the browser has hard-blocked them).
 * - After the PWA is installed, enables notifications too.
 * (No success confirmation popup — the bell-dropdown toggle reflects state.)
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

    const nudge = async () => {
      // Can't do anything if the user hard-blocked notifications.
      if (Notification.permission === 'denied') return;
      if (await isPushSubscribed()) return;
      toast('Turn on notifications', {
        id: 'enable-push', // stable id → never stacks
        description: 'Get class reminders, new recordings and updates — even when the app is closed.',
        duration: 12000,
        action: {
          label: 'Enable',
          onClick: () => { void subscribeToPush(userId); },
        },
      });
    };

    const startTimer = setTimeout(nudge, 3000);
    const interval = setInterval(nudge, REPROMPT_INTERVAL_MS);
    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
    };
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
