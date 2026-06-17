import { supabase } from '@/integrations/supabase/client';

// Public VAPID key (safe to ship to the client). The matching private key
// lives only as the VAPID_PRIVATE_KEY secret on the Supabase project.
export const VAPID_PUBLIC_KEY =
  'BIikKmURexpi1Lf2NQEWA0lO0HyKXOE5BAISLAZ2ZWY0C79w3NeDOjIDtBy-hfc-x3q_1EjbuSgY8wuxKvkamq8';

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Ensure the browser is subscribed to push and the subscription is stored
 * against the user. Requests notification permission if not yet decided.
 * Returns true when a subscription is active and saved.
 */
export async function subscribeToPush(userId?: string | null): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission === 'denied') return false;

  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Without a user we can't map the subscription; it'll be stored on the
    // next authenticated load (PushManager handles that).
    if (!userId) return true;

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    // push_subscriptions isn't in the generated types yet — cast to call it.
    await (supabase as unknown as { from: (t: string) => any }).from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    return true;
  } catch (e) {
    console.warn('subscribeToPush failed', e);
    return false;
  }
}

/** Turn push off: remove the browser subscription and its stored row. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await (supabase as unknown as { from: (t: string) => any })
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);
    return true;
  } catch (e) {
    console.warn('unsubscribeFromPush failed', e);
    return false;
  }
}

/** True when this browser currently has an active push subscription. */
export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}
