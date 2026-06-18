// Cross-device video progress via a tiny `video_progress` table (one upsert row
// per user+video). Designed to be very light on usage: writes are throttled by
// the caller (~once a minute + on close), reads happen once when the dashboard
// or a lecture opens. localStorage stays the source of truth on-device; this
// just keeps devices in agreement.

import { supabase } from '@/integrations/supabase/client';
import { mergeProgress, type ProgressMap } from './videoProgress';

/** Upsert a single progress row. Best-effort (never throws). */
export async function pushProgressRow(
  userId: string | null | undefined,
  recordingId: string,
  seconds: number,
  duration: number,
) {
  if (!userId || !recordingId) return;
  try {
    await supabase
      .from('video_progress')
      .upsert(
        {
          user_id: userId,
          recording_id: recordingId,
          progress_seconds: Math.round(seconds),
          duration_seconds: Math.round(duration),
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,recording_id' },
      );
  } catch {
    /* best-effort; localStorage already has it */
  }
}

// Build a ProgressMap entry from a row + its recording metadata.
function toEntry(row: { recording_id: string; progress_seconds: number; duration_seconds: number; last_watched_at: string }, rec: { topic: string; subject: string; batch: string; embed_link: string }) {
  const seconds = Number(row.progress_seconds) || 0;
  const duration = Number(row.duration_seconds) || 0;
  const percent = duration > 0 ? Math.min(100, Math.round((seconds / duration) * 100)) : 0;
  return {
    videoId: row.recording_id,
    title: rec.topic,
    subject: rec.subject,
    batch: rec.batch,
    videoUrl: rec.embed_link,
    seconds,
    duration,
    percent,
    updatedAt: new Date(row.last_watched_at).getTime(),
  };
}

/**
 * Pull this user's most-recent progress rows (one query), look up the matching
 * recordings' metadata (one query), and merge into localStorage. Returns true
 * if anything was merged so the caller can refresh. Best-effort.
 */
export async function pullProgress(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data: rows } = await supabase
      .from('video_progress')
      .select('recording_id, progress_seconds, duration_seconds, last_watched_at')
      .eq('user_id', userId)
      .order('last_watched_at', { ascending: false })
      .limit(40);
    if (!rows || rows.length === 0) return false;

    const ids = rows.map((r) => r.recording_id);
    const { data: recs } = await supabase
      .from('recordings')
      .select('id, topic, subject, batch, embed_link')
      .in('id', ids);
    const recMap = new Map((recs ?? []).map((r) => [r.id, r]));

    const incoming: ProgressMap = {};
    for (const row of rows) {
      const rec = recMap.get(row.recording_id);
      if (rec) incoming[row.recording_id] = toEntry(row, rec);
    }
    if (Object.keys(incoming).length === 0) return false;
    mergeProgress(userId, incoming);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull progress for a single recording (cheap — used when a lecture opens so it
 * resumes even on a device that hasn't synced via the dashboard). The caller
 * already has the recording metadata. Best-effort.
 */
export async function pullOneProgress(
  userId: string | null | undefined,
  recordingId: string,
  rec: { topic: string; subject: string; batch: string; embed_link: string },
): Promise<boolean> {
  if (!userId || !recordingId) return false;
  try {
    const { data: row } = await supabase
      .from('video_progress')
      .select('recording_id, progress_seconds, duration_seconds, last_watched_at')
      .eq('user_id', userId)
      .eq('recording_id', recordingId)
      .maybeSingle();
    if (!row) return false;
    mergeProgress(userId, { [recordingId]: toEntry(row, rec) });
    return true;
  } catch {
    return false;
  }
}
