// Shared Web Push helper for Supabase Edge Functions (Deno).
// Sends notifications to stored push subscriptions using VAPID.
import webpush from 'npm:web-push@3.6.7';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@unknowniitians.com';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('VAPID keys not configured — skipping push.');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  // When true, the service worker compiles repeated pushes sharing this tag
  // into one WhatsApp-style threaded notification instead of replacing it.
  stack?: boolean;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendToSubs(supabase: SupabaseClient, subs: SubRow[], payload: PushPayload) {
  if (!ensureConfigured() || subs.length === 0) return { sent: 0, failed: 0 };
  const data = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        sent++;
      } catch (err) {
        failed++;
        const code = (err as { statusCode?: number })?.statusCode;
        // Subscription gone — clean it up.
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        } else {
          console.error('push send error', code, (err as Error)?.message);
        }
      }
    }),
  );
  return { sent, failed };
}

export async function sendPushToUserIds(supabase: SupabaseClient, userIds: string[], payload: PushPayload) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return { sent: 0, failed: 0 };
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', ids);
  return await sendToSubs(supabase, (subs ?? []) as SubRow[], payload);
}

/** Resolve every user (students enrolled + assigned teachers) for a batch + subject. */
export async function resolveBatchSubjectUserIds(
  supabase: SupabaseClient,
  batch: string,
  subject: string,
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: enrollments } = await supabase
    .from('user_enrollments')
    .select('user_id')
    .eq('batch_name', batch)
    .eq('subject_name', subject);
  (enrollments ?? []).forEach((e: { user_id?: string }) => e.user_id && ids.add(e.user_id));

  // Teachers assigned to this batch + subject (resolve their user_id via email).
  const { data: teachers } = await supabase
    .from('teachers')
    .select('email')
    .contains('assigned_batches', [batch])
    .contains('assigned_subjects', [subject]);
  const teacherEmails = (teachers ?? []).map((t: { email?: string }) => t.email).filter(Boolean) as string[];
  if (teacherEmails.length > 0) {
    const { data: teacherProfiles } = await supabase
      .from('profiles')
      .select('user_id')
      .in('email', teacherEmails);
    (teacherProfiles ?? []).forEach((p: { user_id?: string }) => p.user_id && ids.add(p.user_id));
  }

  return Array.from(ids);
}

/** Resolve all enrolled students who currently have a push subscription. */
export async function resolveAllStudentUserIds(supabase: SupabaseClient): Promise<string[]> {
  const { data: enrollments } = await supabase
    .from('user_enrollments')
    .select('user_id');

  return Array.from(
    new Set((enrollments ?? []).map((row: { user_id?: string }) => row.user_id).filter(Boolean) as string[]),
  );
}

type StudentTargetFilters = {
  batch?: string | null;
  subject?: string | null;
  allStudents?: boolean;
};

async function resolveStudentTargetUserIds(
  supabase: SupabaseClient,
  filters: StudentTargetFilters,
): Promise<string[]> {
  if (filters.allStudents) {
    return await resolveAllStudentUserIds(supabase);
  }

  const ids = new Set<string>();
  let query = supabase.from('user_enrollments').select('user_id');

  if (filters.batch) query = query.eq('batch_name', filters.batch);
  if (filters.subject) query = query.eq('subject_name', filters.subject);

  const { data } = await query;
  (data ?? []).forEach((row: { user_id?: string }) => {
    if (row.user_id) ids.add(row.user_id);
  });
  return Array.from(ids);
}

export async function sendPushToStudents(
  supabase: SupabaseClient,
  filters: StudentTargetFilters,
  payload: PushPayload,
) {
  try {
    const ids = await resolveStudentTargetUserIds(supabase, filters);
    if (ids.length === 0) return { sent: 0, failed: 0 };
    return await sendPushToUserIds(supabase, ids, payload);
  } catch (err) {
    console.error('sendPushToStudents error:', (err as Error)?.message);
    return { sent: 0, failed: 0 };
  }
}

/** Convenience: push to everyone in a batch + subject. Never throws. */
export async function sendPushToBatchSubject(
  supabase: SupabaseClient,
  batch: string,
  subject: string,
  payload: PushPayload,
  excludeUserId?: string,
) {
  try {
    let ids = await resolveBatchSubjectUserIds(supabase, batch, subject);
    if (excludeUserId) ids = ids.filter((id) => id !== excludeUserId);
    return await sendPushToUserIds(supabase, ids, payload);
  } catch (err) {
    console.error('sendPushToBatchSubject error:', (err as Error)?.message);
    return { sent: 0, failed: 0 };
  }
}

/** Convenience: push to every student. Never throws. */
export async function sendPushToAllStudents(
  supabase: SupabaseClient,
  payload: PushPayload,
) {
  try {
    const ids = await resolveAllStudentUserIds(supabase);
    if (ids.length === 0) return { sent: 0, failed: 0 };
    const { data: subscriptionRows } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', ids);
    return await sendToSubs(supabase, (subscriptionRows ?? []) as SubRow[], payload);
  } catch (err) {
    console.error('sendPushToAllStudents error:', (err as Error)?.message);
    return { sent: 0, failed: 0 };
  }
}
