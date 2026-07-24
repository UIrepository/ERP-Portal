import React from 'react';

/* ------------------------------------------------------------------ *
 * Shared, on-brand artwork + scaffolding for full-page app states.
 * Soft two-tone indigo/slate illustrations, Inter. No animation.
 * ------------------------------------------------------------------ */

/** Roadwork scene — hi-vis worker, striped barricade, cone, cement & wires. */
export const RoadworkArt = () => (
  <svg viewBox="0 0 212 158" width="204" height="152" aria-hidden="true">
    <defs>
      <pattern id="uiStripe" width="14" height="14" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#f59e0b" />
        <rect width="7" height="14" fill="#fff7ed" />
      </pattern>
    </defs>

    <ellipse cx="106" cy="146" rx="90" ry="9" fill="#e2e8f0" opacity="0.6" />

    {/* loose wires / cables with exposed coloured ends */}
    <path d="M150 138 q18 -11 38 1" fill="none" stroke="#6366f1" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M150 143 q22 -3 40 7" fill="none" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="150" cy="138" r="2.6" fill="#ef4444" />
    <circle cx="150" cy="143" r="2.6" fill="#f59e0b" />

    {/* cement / brick stack */}
    <g stroke="#94a3b8" strokeWidth="2">
      <rect x="166" y="129" width="17" height="8" rx="1.5" fill="#e2e8f0" />
      <rect x="162" y="121" width="13" height="8" rx="1.5" fill="#eef2ff" />
      <rect x="176" y="121" width="13" height="8" rx="1.5" fill="#eef2ff" />
    </g>

    {/* striped barricade */}
    <g>
      <line x1="24" y1="104" x2="40" y2="137" stroke="#94a3b8" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="82" y1="104" x2="66" y2="137" stroke="#94a3b8" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="16" y="92" width="76" height="17" rx="3" fill="url(#uiStripe)" stroke="#78716c" strokeWidth="2.5" />
      <line x1="24" y1="120" x2="82" y2="120" stroke="#cbd5e1" strokeWidth="4.5" />
    </g>

    {/* traffic cone */}
    <g>
      <path d="M120 137 l11 -30 a3.5 3.5 0 0 1 6 0 l11 30 Z" fill="#fb923c" stroke="#ea580c" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M126 123 h16 M123 131 h22" stroke="#fff7ed" strokeWidth="4.5" />
      <rect x="112" y="135" width="44" height="7" rx="3" fill="#fb923c" stroke="#ea580c" strokeWidth="2" />
    </g>

    {/* worker */}
    <g>
      <rect x="88" y="119" width="8" height="20" rx="3.5" fill="#4f46e5" />
      <rect x="100" y="119" width="8" height="20" rx="3.5" fill="#4f46e5" />
      <path d="M84 89 h28 a6 6 0 0 1 6 6 v22 a4 4 0 0 1 -4 4 h-32 a4 4 0 0 1 -4 -4 v-22 a6 6 0 0 1 6 -6 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="2.5" />
      <path d="M98 89 v34 M84 105 h28" stroke="#e2e8f0" strokeWidth="3.5" />
      <path d="M82 95 l-9 12" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
      <path d="M114 95 l11 -12" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
      <circle cx="98" cy="77" r="10.5" fill="#f5d0a9" stroke="#e0b483" strokeWidth="2" />
      <path d="M85 75 a13 13 0 0 1 26 0 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2.5" />
      <rect x="83" y="73" width="30" height="5.5" rx="2.5" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
      <rect x="96" y="62" width="4" height="6" rx="2" fill="#f59e0b" />
    </g>
  </svg>
);

export const CrashArt = () => (
  <svg viewBox="0 0 168 148" width="176" height="155" aria-hidden="true">
    <defs>
      <linearGradient id="uiTri" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eef2ff" />
        <stop offset="1" stopColor="#e0e7ff" />
      </linearGradient>
    </defs>
    <ellipse cx="84" cy="132" rx="48" ry="7.5" fill="#e2e8f0" opacity="0.7" />
    <circle cx="34" cy="46" r="3" fill="#c7d2fe" />
    <circle cx="136" cy="40" r="4" fill="#c7d2fe" />
    <path d="M126 96 l7 -3 M32 92 l-7 -2" stroke="#c7d2fe" strokeWidth="3" strokeLinecap="round" />
    <path d="M84 30 L138 118 a8 8 0 0 1 -7 12 H37 a8 8 0 0 1 -7 -12 Z"
      fill="url(#uiTri)" stroke="#6366f1" strokeWidth="4" strokeLinejoin="round" />
    <path d="M84 62 v26" stroke="#ef4444" strokeWidth="6.5" strokeLinecap="round" />
    <circle cx="84" cy="104" r="4.5" fill="#ef4444" />
  </svg>
);

export const SessionArt = () => (
  <svg viewBox="0 0 168 148" width="176" height="155" aria-hidden="true">
    <ellipse cx="84" cy="134" rx="46" ry="7.5" fill="#e2e8f0" opacity="0.7" />
    <path d="M64 66 v-8 a20 20 0 0 1 39 -6" fill="none" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
    <rect x="52" y="64" width="64" height="52" rx="11" fill="#eef2ff" stroke="#4f46e5" strokeWidth="4" />
    <circle cx="84" cy="86" r="6" fill="#4f46e5" />
    <path d="M84 86 l0 14" stroke="#4f46e5" strokeWidth="5" strokeLinecap="round" />
    <circle cx="122" cy="52" r="15" fill="#fff" stroke="#f59e0b" strokeWidth="3.5" />
    <path d="M122 52 v-8 M122 52 l6 4" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const EmptyArt = ({ size = 96 }: { size?: number }) => (
  <svg viewBox="0 0 120 100" width={size} height={(size * 100) / 120} aria-hidden="true">
    <ellipse cx="60" cy="90" rx="34" ry="5.5" fill="#e2e8f0" opacity="0.7" />
    <path d="M24 46 h72 l-9 34 a6 6 0 0 1 -6 4 H39 a6 6 0 0 1 -6 -4 Z" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="3" strokeLinejoin="round" />
    <path d="M40 46 l6 -16 h28 l6 16" fill="#eef2ff" stroke="#94a3b8" strokeWidth="3" strokeLinejoin="round" />
    <path d="M52 62 h16" stroke="#c7d2fe" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

/** Full-page centred state scaffold (offline/maintenance/crash/session). */
export function StateScreen({
  art, title, message, action,
}: { art: React.ReactNode; title: string; message?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-white px-6 text-center font-sans">
      <div className="flex flex-col items-center">
        {art}
        <h1 className="mt-7 text-[21px] font-semibold text-slate-900">{title}</h1>
        {message && (
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-slate-500 whitespace-pre-line">{message}</p>
        )}
        {action && <div className="mt-7">{action}</div>}
      </div>
    </div>
  );
}

const primaryBtn =
  'rounded-xl bg-indigo-600 px-6 py-3 text-[14px] font-medium text-white hover:bg-indigo-700 transition-colors';

/** Session expired — token could not be refreshed. */
export const SessionExpiredScreen = ({ onSignIn }: { onSignIn: () => void }) => (
  <StateScreen
    art={<SessionArt />}
    title="Your session ended"
    message="You've been signed out for security. Please sign in again to pick up where you left off."
    action={<button type="button" onClick={onSignIn} className={primaryBtn}>Sign in again</button>}
  />
);

/** Reusable inline empty state for lists (no recordings / classes / messages). */
export const EmptyState = ({
  title, subtitle, className = '',
}: { title: string; subtitle?: string; className?: string }) => (
  <div className={`flex flex-col items-center justify-center py-14 text-center ${className}`}>
    <EmptyArt />
    <h3 className="mt-4 text-[15px] font-semibold text-slate-800">{title}</h3>
    {subtitle && <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-500">{subtitle}</p>}
  </div>
);

/* ------------------------------------------------------------------ *
 * Error boundary — catches render crashes and shows the crash state
 * instead of a blank white screen.
 * ------------------------------------------------------------------ */
interface EBProps { children: React.ReactNode }
interface EBState { hasError: boolean }

export class ErrorBoundary extends React.Component<EBProps, EBState> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('App crash caught by ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <StateScreen
          art={<CrashArt />}
          title="Something went wrong"
          message="The app hit an unexpected error. Reloading usually fixes it."
          action={
            <button type="button" onClick={() => window.location.reload()} className={primaryBtn}>
              Reload
            </button>
          }
        />
      );
    }
    return this.props.children;
  }
}
