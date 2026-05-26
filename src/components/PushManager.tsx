import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { subscribeToPush, pushSupported } from '@/lib/push';

/**
 * Keeps the logged-in user subscribed to web push.
 * - If permission is already granted, (re)subscribes silently and stores it.
 * - If undecided, shows a one-time "Turn on notifications" prompt.
 * - After the PWA is installed, enables notifications too.
 * (No success confirmation popup — the navbar toggle reflects the state.)
 */
export const PushManager = () => {
  const { profile, user } = useAuth();
  const userId = user?.id || profile?.user_id;
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!userId || !pushSupported()) return;

    // Already granted → make sure we have a fresh subscription saved.
    if (Notification.permission === 'granted') {
      void subscribeToPush(userId);
      return;
    }

    // Undecided → nudge once per session (no confirmation popup afterwards).
    if (Notification.permission === 'default' && !promptedRef.current) {
      promptedRef.current = true;
      const t = setTimeout(() => {
        toast('Turn on notifications', {
          description: 'Get class reminders, new recordings and updates — even when the app is closed.',
          duration: 12000,
          action: {
            label: 'Enable',
            onClick: () => { void subscribeToPush(userId); },
          },
        });
      }, 3000);
      return () => clearTimeout(t);
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
