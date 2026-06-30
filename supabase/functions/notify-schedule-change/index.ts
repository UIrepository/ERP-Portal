// Notifier for class schedule changes — PUSH + EMAIL. Called by DB triggers on
// the `schedules` table when a class is RESCHEDULED (date / time / day changes)
// or CANCELLED (row deleted).
//   • Push  -> the batch+subject's enrolled students AND assigned teachers.
//   • Email -> the batch+subject's Google Group (reaches every student) AND the
//              assigned teachers, via Resend.
// Self-contained so it deploys as a single file.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FROM = 'Unknown IITians <notifications@hq.unknowniitians.com>';

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

    const when = whenLabel(date, day_of_week);
    const time = `${hhmm(start_time)}${end_time ? `–${hhmm(end_time)}` : ''}`;
    const cancelled = event === 'cancelled';
    const added = event === 'added';

    // ---- assigned teachers (shared by push + email) --------------------------
    const { data: teacherRows } = await supabase
      .from('teachers').select('email, name')
      .contains('assigned_batches', [batch]).contains('assigned_subjects', [subject]);
    const teachers = (teacherRows ?? []) as { email?: string; name?: string }[];
    const teacherEmails = teachers.map((t) => t.email).filter(Boolean) as string[];

    // ================= PUSH ===================================================
    const ids = new Set<string>();
    const { data: enr } = await supabase
      .from('user_enrollments').select('user_id')
      .eq('batch_name', batch).eq('subject_name', subject);
    pick(enr, 'user_id').forEach((id) => ids.add(id));
    if (teacherEmails.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id').in('email', teacherEmails);
      pick(profs, 'user_id').forEach((id) => ids.add(id));
    }
    const userIds = [...ids];

    let pushSent = 0, pushFailed = 0;
    if (userIds.length && configurePush()) {
      const pushTitle = cancelled ? '❌ Class cancelled' : added ? '🆕 New class added' : '🗓️ Class rescheduled';
      const pushBody = cancelled
        ? `${subject} • ${batch}${when ? ` (${when}${time ? `, ${time}` : ''})` : ''} has been cancelled.`
        : added
        ? `${subject} • ${batch}${when ? ` on ${when}` : ''}${time ? ` at ${time}` : ''} has been added.`
        : `${subject} • ${batch} is now ${when || 'rescheduled'}${time ? ` at ${time}` : ''}.`;
      const payload = JSON.stringify({
        title: pushTitle, body: pushBody, url: '/schedule',
        tag: `schedule-${event}-${batch}-${subject}`, icon: '/icon-192.png',
      });
      const { data: subs } = await supabase
        .from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', userIds);
      await Promise.all((subs ?? []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          pushSent++;
        } catch (err) {
          pushFailed++;
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
        }
      }));
    }

    // ================= EMAIL ==================================================
    let emailSent = 0;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const resend = new Resend(resendKey);

      // Students: the active Google Group for this batch + subject reaches them all.
      const { data: group } = await supabase
        .from('google_groups').select('group_email')
        .eq('batch_name', batch).eq('subject_name', subject).eq('is_active', true).maybeSingle();

      const subjectLine = cancelled
        ? `Unknown IITians — Class cancelled: ${subject} (${batch})`
        : added
        ? `Unknown IITians — New class scheduled: ${subject} (${batch})`
        : `Unknown IITians — Class rescheduled: ${subject} (${batch})`;

      const studentBody = cancelled
        ? `Dear Student,\n\nYour ${subject} class for ${batch}${when ? ` scheduled for ${when}${time ? `, ${time}` : ''}` : ''} has been cancelled.\n\nPlease check your dashboard for updates.\n\nRegards,\nUnknown IITians Academic Team`
        : added
        ? `Dear Student,\n\nA new ${subject} class has been scheduled for ${batch}.\n\nWhen: ${when || 'see dashboard'}${time ? ` • ${time}` : ''}\n\nPlease check your dashboard for details.\n\nRegards,\nUnknown IITians Academic Team`
        : `Dear Student,\n\nYour ${subject} class for ${batch} has been rescheduled.\n\nNew schedule: ${when || 'see dashboard'}${time ? ` • ${time}` : ''}\n\nPlease check your dashboard for details.\n\nRegards,\nUnknown IITians Academic Team`;

      const recipients: string[] = [];
      if (group?.group_email) recipients.push(group.group_email);

      for (const to of recipients) {
        try { await resend.emails.send({ from: FROM, to: [to], subject: subjectLine, text: studentBody }); emailSent++; }
        catch (err) { console.error('schedule email (group) failed:', (err as Error)?.message); }
      }

      for (const t of teachers) {
        if (!t.email) continue;
        const teacherBody = cancelled
          ? `Dear ${t.name || 'Teacher'},\n\nThe ${subject} class for ${batch}${when ? ` scheduled for ${when}${time ? `, ${time}` : ''}` : ''} has been cancelled.\n\nRegards,\nUnknown IITians Academic Team`
          : added
          ? `Dear ${t.name || 'Teacher'},\n\nA new ${subject} class has been scheduled for ${batch}.\n\nWhen: ${when || 'see dashboard'}${time ? ` • ${time}` : ''}\n\nRegards,\nUnknown IITians Academic Team`
          : `Dear ${t.name || 'Teacher'},\n\nThe ${subject} class for ${batch} has been rescheduled.\n\nNew schedule: ${when || 'see dashboard'}${time ? ` • ${time}` : ''}\n\nRegards,\nUnknown IITians Academic Team`;
        try { await resend.emails.send({ from: FROM, to: [t.email], subject: subjectLine, text: teacherBody }); emailSent++; }
        catch (err) { console.error('schedule email (teacher) failed:', (err as Error)?.message); }
      }
    }

    return new Response(JSON.stringify({
      success: true, event, recipients: userIds.length,
      push: { sent: pushSent, failed: pushFailed }, emailSent,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('notify-schedule-change error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
