import { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';

// How long the app must be continuously fetching before we assume the network
// is slow and show the snail. Long enough that normal loads never trigger it.
const SLOW_MS = 7000;



function OfflineScreen() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white px-6 text-center font-sans">
      <img src="/art/state-offline.png" alt="" aria-hidden width={240} height={240} draggable={false} className="object-contain" />
      <h1 className="mt-7 text-[21px] font-semibold text-slate-900">You're offline</h1>
      <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-slate-500">
        We can't reach the internet right now. Check your Wi-Fi or mobile data, then try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-7 rounded-xl bg-indigo-600 px-6 py-3 text-[14px] font-medium text-white hover:bg-indigo-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

function SlowConnection() {
  return (
    <div className="fixed inset-0 z-[190] flex flex-col items-center justify-center bg-white px-6 text-center font-sans">
      <img src="/art/state-slow.png" alt="" aria-hidden width={240} height={240} draggable={false} className="object-contain" />
      <h1 className="mt-7 text-[21px] font-semibold text-slate-900">Taking longer than usual…</h1>
      <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-slate-500">
        You seem to be on a slow connection. Hang tight — we're still loading.
      </p>
    </div>
  );
}

/**
 * Global connectivity feedback: a full-screen "You're offline" state when the
 * browser loses its connection, and a full-screen snail "still loading" state
 * when the app has been fetching unusually long (likely a slow connection).
 * Mounted once at the app root. In dev, force a state with
 * ?__net=offline | ?__net=slow (use it on a route that keeps the query string).
 */
export const ConnectivityStates = () => {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [slow, setSlow] = useState(false);
  const isFetching = useIsFetching();
  const anyFetching = isFetching > 0;

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!anyFetching) { setSlow(false); return; }
    const t = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(t);
  }, [anyFetching]);

  const force = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('__net')
    : null;
  const showOffline = force === 'offline' || (!force && offline);
  const showSlow = force === 'slow' || (!force && !offline && slow);

  if (!showOffline && !showSlow) return null;
  return showOffline ? <OfflineScreen /> : <SlowConnection />;
};
