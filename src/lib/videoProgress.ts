// On-device video watch progress. Stored entirely in localStorage (no database,
// no egress). Each entry keeps enough metadata to render a "Continue watching"
// card without any query. Cross-device sync (optional, via Google Drive) layers
// on top of this later; localStorage is always the source of truth on the device.

export interface VideoProgressEntry {
  videoId: string;
  title: string;
  subject?: string;
  batch: string;
  videoUrl: string;
  seconds: number;   // last playback position
  duration: number;  // total length (0 if unknown)
  percent: number;   // 0–100
  updatedAt: number;  // epoch ms
}

type ProgressMap = Record<string, VideoProgressEntry>;

const keyFor = (userId: string) => `ui_video_progress_${userId}`;

// Below this we treat it as "not really started"; above COMPLETE_PCT as "done".
const MIN_PCT = 2;
const COMPLETE_PCT = 95;
const MAX_ENTRIES = 60;

function readMap(userId: string): ProgressMap {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

function writeMap(userId: string, map: ProgressMap) {
  try {
    // Cap the stored set to the most recently watched to bound localStorage size.
    const entries = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    const trimmed: ProgressMap = {};
    entries.slice(0, MAX_ENTRIES).forEach((e) => { trimmed[e.videoId] = e; });
    localStorage.setItem(keyFor(userId), JSON.stringify(trimmed));
  } catch {
    /* storage full / unavailable — ignore, progress is best-effort */
  }
}

/** Save/update progress for one video. No-ops for empty user/video. */
export function saveProgress(
  userId: string | null | undefined,
  entry: Omit<VideoProgressEntry, 'percent' | 'updatedAt'>,
) {
  if (!userId || !entry.videoId || !entry.batch) return;
  const percent = entry.duration > 0
    ? Math.min(100, Math.round((entry.seconds / entry.duration) * 100))
    : 0;
  const map = readMap(userId);
  // Once a video is essentially finished, drop it from "continue watching".
  if (percent >= COMPLETE_PCT) {
    delete map[entry.videoId];
    writeMap(userId, map);
    return;
  }
  if (percent < MIN_PCT && !map[entry.videoId]) return; // ignore the first seconds
  map[entry.videoId] = { ...entry, percent, updatedAt: Date.now() };
  writeMap(userId, map);
}

/** Saved position (seconds) for a video, or 0. */
export function getResumeSeconds(userId: string | null | undefined, videoId: string): number {
  if (!userId || !videoId) return 0;
  const e = readMap(userId)[videoId];
  return e ? e.seconds : 0;
}

/** In-progress videos for a batch, most recently watched first. */
export function listForBatch(userId: string | null | undefined, batch: string | null | undefined): VideoProgressEntry[] {
  if (!userId || !batch) return [];
  return Object.values(readMap(userId))
    .filter((e) => e.batch === batch && e.percent >= MIN_PCT && e.percent < COMPLETE_PCT)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Remove one video from progress (e.g. a "remove from continue watching" action). */
export function removeProgress(userId: string | null | undefined, videoId: string) {
  if (!userId || !videoId) return;
  const map = readMap(userId);
  if (map[videoId]) {
    delete map[videoId];
    writeMap(userId, map);
  }
}
