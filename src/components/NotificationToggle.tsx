import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, pushSupported } from '@/lib/push';

/**
 * Small toggle beside the notification bell to turn web-push on/off.
 * No popups — flipping it on requests permission and subscribes.
 */
export const NotificationToggle = () => {
  const { profile, user } = useAuth();
  const userId = user?.id || profile?.user_id;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported = pushSupported();
  const denied = supported && typeof Notification !== 'undefined' && Notification.permission === 'denied';

  useEffect(() => {
    let active = true;
    isPushSubscribed().then((s) => active && setOn(s));
    return () => { active = false; };
  }, [userId]);

  if (!supported) return null;

  const handleChange = async (next: boolean) => {
    if (busy || denied) return;
    setBusy(true);
    if (next) {
      const ok = await subscribeToPush(userId);
      setOn(ok);
    } else {
      await unsubscribeFromPush();
      setOn(false);
    }
    setBusy(false);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            <Switch
              checked={on}
              disabled={busy || denied}
              onCheckedChange={handleChange}
              aria-label="Toggle notifications"
              className="data-[state=checked]:bg-indigo-600"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-sans">
          {denied
            ? 'Notifications are blocked in your browser settings'
            : on
            ? 'Notifications on — click to turn off'
            : 'Turn on notifications'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
