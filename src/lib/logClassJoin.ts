import { supabase } from '@/integrations/supabase/client';

interface JoinInfo {
  /** auth uid of the clicker — REQUIRED, the RLS insert check is user_id = auth.uid() */
  userId: string;
  batch: string;
  subject: string;
  scheduleId?: string | null;
  /** IST calendar day of the class, yyyy-mm-dd */
  classDate: string;
  roomUrl?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  role?: string;
}

/**
 * Fire-and-forget: record that this user clicked "Join" for a class. Rows are
 * admin-only to read (RLS) and power the admin "Join Activity" dashboard.
 *
 * Deliberately NOT awaited by callers and never throws — logging must never
 * delay or block a student entering class, and the room tab must open on the
 * user gesture regardless of whether this insert succeeds.
 */
export const logClassJoin = (info: JoinInfo): void => {
  if (!info.userId || !info.batch || !info.subject || !info.classDate) return;
  try {
    // Cast: class_join_events is newer than the generated Database types.
    void (supabase.from('class_join_events' as never) as any)
      .insert({
        user_id: info.userId,
        user_name: info.userName ?? null,
        user_email: info.userEmail ?? null,
        role: info.role ?? 'student',
        batch: info.batch,
        subject: info.subject,
        schedule_id: info.scheduleId ?? null,
        class_date: info.classDate,
        room_url: info.roomUrl ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn('[logClassJoin] failed:', error.message);
      });
  } catch (e) {
    console.warn('[logClassJoin] threw:', e);
  }
};
