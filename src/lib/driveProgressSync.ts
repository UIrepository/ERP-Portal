// Optional cross-device sync for video progress, stored in the student's OWN
// Google Drive hidden "appDataFolder" (not our database). localStorage stays the
// source of truth on the device; this layers cross-device sync on top.
//
// Token is obtained via a user gesture (drive.appdata scope) and lives only in
// memory for ~1h. Everything degrades gracefully: no token / storage full /
// declined → we simply keep localStorage.

import { getAllProgress, mergeProgress, type ProgressMap } from './videoProgress';

const FILE_NAME = 'ui_video_progress.json';
const CONNECTED_KEY = 'ui_video_drive_connected';
const FULL_KEY = 'ui_video_drive_full';

let accessToken: string | null = null;
let tokenExpiry = 0;
let cachedFileId: string | null = null;

export function setDriveToken(token: string, expiresInSec: number) {
  accessToken = token;
  // refresh a minute early to avoid edge-of-expiry failures
  tokenExpiry = Date.now() + (Math.max(60, expiresInSec) - 60) * 1000;
}
export function clearDriveToken() {
  accessToken = null;
  tokenExpiry = 0;
}
export function hasValidToken(): boolean {
  return !!accessToken && Date.now() < tokenExpiry;
}

export function isDriveConnected(): boolean {
  try { return localStorage.getItem(CONNECTED_KEY) === '1'; } catch { return false; }
}
export function setDriveConnected(v: boolean) {
  try { v ? localStorage.setItem(CONNECTED_KEY, '1') : localStorage.removeItem(CONNECTED_KEY); } catch { /* ignore */ }
}
export function isDriveFull(): boolean {
  try { return localStorage.getItem(FULL_KEY) === '1'; } catch { return false; }
}
function setDriveFull(v: boolean) {
  try { v ? localStorage.setItem(FULL_KEY, '1') : localStorage.removeItem(FULL_KEY); } catch { /* ignore */ }
}

interface DriveError { code: number; }

async function findFileId(): Promise<string | null> {
  if (cachedFileId) return cachedFileId;
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw { code: res.status } as DriveError;
  const data = await res.json();
  cachedFileId = data.files?.[0]?.id ?? null;
  return cachedFileId;
}

async function readRemote(fileId: string): Promise<ProgressMap> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw { code: 401 } as DriveError;
  if (!res.ok) return {};
  try { return (await res.json()) as ProgressMap; } catch { return {}; }
}

async function writeRemote(map: ProgressMap): Promise<void> {
  const body = JSON.stringify(map);
  const fileId = await findFileId();
  if (fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body },
    );
    if (!res.ok) throw { code: res.status } as DriveError;
  } else {
    const boundary = 'ui_vp_' + tokenExpiry.toString(36);
    const metadata = { name: FILE_NAME, parents: ['appDataFolder'] };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart },
    );
    if (!res.ok) throw { code: res.status } as DriveError;
    const data = await res.json();
    cachedFileId = data.id ?? null;
  }
}

function handleError(e: unknown): { ok: false; reason: string } {
  const code = (e as DriveError)?.code;
  if (code === 401) { clearDriveToken(); return { ok: false, reason: 'token-expired' }; }
  if (code === 403) { setDriveFull(true); return { ok: false, reason: 'storage-full' }; }
  return { ok: false, reason: 'error' };
}

/** Pull remote, merge with local (newest-per-video wins), write merged back. */
export async function syncWithDrive(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!hasValidToken()) return { ok: false, reason: 'no-token' };
  try {
    const fileId = await findFileId();
    const remote = fileId ? await readRemote(fileId) : {};
    const merged = mergeProgress(userId, remote);
    await writeRemote(merged);
    setDriveFull(false);
    return { ok: true };
  } catch (e) {
    return handleError(e);
  }
}

/** Lightweight push of the local map (no pull). Used for debounced in-session saves. */
export async function pushToDrive(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!hasValidToken() || isDriveFull()) return { ok: false, reason: 'unavailable' };
  try {
    await writeRemote(getAllProgress(userId));
    return { ok: true };
  } catch (e) {
    return handleError(e);
  }
}
