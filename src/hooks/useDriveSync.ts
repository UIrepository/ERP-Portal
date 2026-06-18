import { useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import {
  setDriveToken,
  setDriveConnected,
  isDriveConnected,
  isDriveFull,
  syncWithDrive,
} from '@/lib/driveProgressSync';

interface UseDriveSyncOptions {
  userId?: string | null;
  /** Called after a connect attempt finishes. ok = granted (sync may still have
   *  had a soft failure like storage-full). */
  onDone?: (ok: boolean) => void;
}

/**
 * Drive cross-device sync for video progress. `connect()` must be called from a
 * user gesture (it opens Google's consent popup for the drive.appdata scope).
 * On success it stores the token, marks the device connected, and does a full
 * pull+merge+push so this device and Drive agree.
 */
export function useDriveSync({ userId, onDone }: UseDriveSyncOptions) {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const login = useGoogleLogin({
    flow: 'implicit',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    onSuccess: async (resp) => {
      setDriveToken(resp.access_token, Number((resp as { expires_in?: number }).expires_in) || 3600);
      setDriveConnected(true);
      const uid = userIdRef.current;
      if (uid) {
        try { await syncWithDrive(uid); } catch { /* keep local */ }
      }
      onDoneRef.current?.(true);
    },
    onError: () => { onDoneRef.current?.(false); },
  });

  const connect = useCallback(() => login(), [login]);

  return {
    connect,
    isConnected: isDriveConnected(),
    isFull: isDriveFull(),
  };
}
