import { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';

// How long the app must be continuously fetching before we assume the network
// is slow and show the snail. Long enough that normal loads never trigger it.
const SLOW_MS = 7000;

/** Hand-drawn snail — indigo spiral shell, gently crawling with a slime trail. */
const Snail = ({ size = 120 }: { size?: number }) => (
  <svg className="ui-snail" viewBox="0 0 96 64" width={size} height={(size * 64) / 96} aria-hidden="true">
    <path className="ui-snail-trail" d="M4 55 H84" stroke="#c7d2fe" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 8" fill="none" />
    <ellipse cx="42" cy="58" rx="34" ry="3.5" fill="#e2e8f0" opacity="0.7" />
    {/* foot */}
    <path d="M10 54 q2 -10 16 -10 h34 q8 0 8 8 q0 4 -5 4 H16 q-6 0 -6 -2 Z" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" />
    {/* head + neck */}
    <path className="ui-snail-head" d="M60 46 q10 -2 13 -12" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="74" cy="33" r="4.5" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2.5" />
    {/* antennae */}
    <path className="ui-snail-ant" d="M76 30 l4 -8" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
    <path className="ui-snail-ant" d="M72 29 l1 -9" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="80" cy="21" r="1.9" fill="#4f46e5" />
    <circle cx="73" cy="19" r="1.9" fill="#4f46e5" />
    {/* shell — spiral, with a soft two-tone */}
    <circle cx="38" cy="34" r="17" fill="#eef2ff" stroke="#4f46e5" strokeWidth="2.5" />
    <circle cx="38" cy="34" r="17" fill="url(#uiShell)" opacity="0.5" />
    <path d="M38 34 m0 -10 a10 10 0 1 1 -7 3 a6.5 6.5 0 1 0 5 -2 a3 3 0 1 1 -2 1" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
    <defs>
      <linearGradient id="uiShell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#c7d2fe" />
      </linearGradient>
    </defs>
  </svg>
);

/** Enhanced "no connection" artwork — a soft two-tone cloud, unplugged from a
 *  dangling cord, sitting on a gentle shadow, with a red disconnect slash. */
const CloudOff = () => (
  <svg viewBox="0 0 180 156" width="188" height="163" aria-hidden="true">
    <defs>
      <linearGradient id="uiCloud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f8fafc" />
        <stop offset="1" stopColor="#e2e8f0" />
      </linearGradient>
    </defs>
    {/* ground shadow */}
    <ellipse cx="90" cy="140" rx="52" ry="8" fill="#e2e8f0" opacity="0.7" />

    {/* dangling cord + unplugged plug (the "disconnected" cue) */}
    <path d="M96 108 q6 12 -2 20" fill="none" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
    <rect x="86" y="126" width="12" height="9" rx="2.5" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2.5" />
    <path d="M89 126 v-3 M95 126 v-3" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
    {/* a couple of little "no signal" sparks */}
    <path d="M110 120 l6 -4 M112 128 l7 -1" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

    {/* cloud */}
    <path d="M54 104 a26 26 0 0 1 -2 -52 a34 34 0 0 1 66 -9 a23 23 0 0 1 5 61 Z"
      fill="url(#uiCloud)" stroke="#94a3b8" strokeWidth="3.5" strokeLinejoin="round" />

    {/* red disconnect slash, lifted off the cloud with a white underlay */}
    <line x1="44" y1="34" x2="132" y2="110" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
    <line x1="44" y1="34" x2="132" y2="110" stroke="#ef4444" strokeWidth="5.5" strokeLinecap="round" />
  </svg>
);

function OfflineScreen() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white px-6 text-center font-sans">
      <div className="ui-net-float"><CloudOff /></div>
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
      <Snail />
      <h1 className="mt-7 text-[21px] font-semibold text-slate-900">Taking longer than usual…</h1>
      <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-slate-500">
        You seem to be on a slow connection. Hang tight — we're still loading.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <span className="ui-dot" style={{ animationDelay: '0s' }} />
        <span className="ui-dot" style={{ animationDelay: '.2s' }} />
        <span className="ui-dot" style={{ animationDelay: '.4s' }} />
      </div>
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

  return (
    <>
      <style>{`
        @keyframes uiNetFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        @keyframes uiSnailCrawl { 0%,100% { transform: translateX(-4px) } 50% { transform: translateX(4px) } }
        @keyframes uiSnailTrail { 0% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: -20 } }
        @keyframes uiSnailAnt { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }
        @keyframes uiDot { 0%,100% { opacity:.25; transform: translateY(0) } 50% { opacity:1; transform: translateY(-4px) } }
        .ui-net-float { animation: uiNetFloat 3s ease-in-out infinite; }
        .ui-snail { animation: uiSnailCrawl 2.8s ease-in-out infinite; overflow: visible; }
        .ui-snail-trail { animation: uiSnailTrail 1.4s linear infinite; }
        .ui-snail-ant { transform-box: fill-box; transform-origin: bottom center; animation: uiSnailAnt 2s ease-in-out infinite; }
        .ui-dot { width:8px; height:8px; border-radius:9999px; background:#818cf8; display:inline-block; animation: uiDot 1.1s ease-in-out infinite; }
      `}</style>
      {showOffline ? <OfflineScreen /> : <SlowConnection />}
    </>
  );
};
