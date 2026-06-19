// Push-only notifier for class schedule changes. Called by DB triggers on the
// `schedules` table when a class is RESCHEDULED (date / time / day changes) or
// CANCELLED (row deleted). Notifies the batch+subject's enrolled students AND
// assigned teachers. Self-contained (inlines the push logic) so it deploys as a
// single file. No email — push only, as requested.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function configurePush(): boolean {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subj = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@unknowniitians.com';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subj, pub, priv);
  return true;
}

const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : '');

function whenLabel(date?: string | null, dow?: number | null): string {
  if (date) {
    try {
      return new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
      });
    } catch {
      return String(date);
    }
  }
  if (dow != null && dow >= 0 && dow <= 6) return `every ${DAYS[dow]}`;
  return '';
}

// deno-lint-ignore no-explicit-any
const pick = (rows: any[] | null, key: string) =>
  (rows ?? []).map((r) => r?.[key]).filter(Boolean) as string[];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { event, batch, subject, date, day_of_week, start_time, end_time } = await req.json();
    if (!batch || !subject) {
      return new Response(JSON.stringify({ error: 'Missing batch or subject' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Recipients = enrolled students + assigned teachers of this batch + subject.
    const ids = new Set<string>();
    const { data: enr } = await supabase
      .from('user_enrollments').select('user_id')
      .eq('batch_name', batch).eq('subject_name', subject);
    pick(enr, 'user_id').forEach((id) => ids.add(id));

    const { data: teachers } = await supabase
      .from('teachers').select('email')
      .contains('assigned_batches', [batch]).contains('assigned_subjects', [subject]);
    const emails = pick(teachers, 'email');
    if (emails.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id').in('email', emails);
      pick(profs, 'user_id').forEach((id) => ids.add(id));
    }
    const userIds = [...ids];
    if (!userIds.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, note: 'no recipients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const when = whenLabel(date, day_of_week);
    const time = `${hhmm(start_time)}${end_time ? `–${hhmm(end_time)}` : ''}`;
    const cancelled = event === 'cancelled';
    const title = cancelled ? '❌ Class cancelled' : '🗓️ Class rescheduled';
    const body = cancelled
      ? `${subject} • ${batch}${when ? ` (${when}${time ? `, ${time}` : ''})` : ''} has been cancelled.`
      : `${subject} • ${batch} is now ${when || 'rescheduled'}${time ? ` at ${time}` : ''}.`;

    const payload = JSON.stringify({
      title, body, url: '/schedule',
      tag: `schedule-${event}-${batch}-${subject}`, icon: '/icon-192.png',
    });

    if (!configurePush()) {
      return new Response(JSON.stringify({ success: false, error: 'VAPID not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subs } = await supabase
      .from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', userIds);

    let sent = 0, failed = 0;
    await Promise.all((subs ?? []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        failed++;
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    }));

    return new Response(JSON.stringify({ success: true, event, recipients: userIds.length, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('notify-schedule-change error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
