/**
 * Client helpers for the Vercel edge-cached read endpoints (see /api/*).
 *
 * These serve shared, non-personal data (e.g. a batch's timetable) from Vercel's
 * CDN so the same bytes aren't re-fetched from Supabase by every student — cutting
 * Supabase egress. Each helper THROWS on any non-JSON / error response so callers
 * can fall back to a direct Supabase query: this keeps `vite` dev (no /api server)
 * working and degrades gracefully if the endpoint is ever unavailable in prod.
 */

export interface CachedSchedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date?: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  const ct = res.headers.get('content-type') || '';
  // In `vite` dev the SPA fallback returns index.html (HTML, 200) for /api/* —
  // treat anything that isn't JSON as "endpoint unavailable" so callers fall back.
  if (!res.ok || !ct.includes('application/json')) {
    throw new Error(`cached read ${path} unavailable (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Fetch (CDN-cached) timetables for one or more batches and merge them. */
export async function fetchCachedSchedules(batches: string[]): Promise<CachedSchedule[]> {
  const unique = Array.from(new Set(batches.filter(Boolean)));
  if (unique.length === 0) return [];
  const lists = await Promise.all(
    unique.map((b) => getJson<CachedSchedule[]>(`/api/schedules?batch=${encodeURIComponent(b)}`)),
  );
  return lists.flat();
}

/** /api/shared?resource=today — a batch's day at a glance (no join/watch links). */
export interface CachedToday {
  today: string;
  dow: number;
  schedules: {
    subject: string;
    start_time: string;
    end_time: string;
    date: string | null;
    day_of_week: number | null;
  }[];
  active: { subject: string; started_at: string | null }[];
  recordings: { id: string; subject: string; topic: string; date: string }[];
}

export function fetchCachedToday(batch: string): Promise<CachedToday> {
  return getJson<CachedToday>(`/api/shared?resource=today&batch=${encodeURIComponent(batch)}`);
}

/** /api/shared?resource=flags — global app flags (world-readable under RLS anyway). */
export interface CachedFlags {
  maintenance: { is_maintenance_mode: boolean; maintenance_message: string | null };
  feedback_gate: { enabled: boolean; scope: string };
}

export function fetchCachedFlags(): Promise<CachedFlags> {
  return getJson<CachedFlags>('/api/shared?resource=flags');
}
