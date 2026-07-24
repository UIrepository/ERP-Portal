import React from 'react';

/* ------------------------------------------------------------------ *
 * Shared, on-brand artwork + scaffolding for full-page app states.
 * Soft two-tone indigo/slate illustrations, Inter, gentle motion.
 * ------------------------------------------------------------------ */

const KEYFRAMES = `
  @keyframes uiStateFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
  @keyframes uiStateIn { 0% { opacity:0; transform: translateY(8px) } 100% { opacity:1; transform: none } }
  @keyframes uiGearA { 0% { transform: rotate(0) } 100% { transform: rotate(360deg) } }
  @keyframes uiGearB { 0% { transform: rotate(0) } 100% { transform: rotate(-360deg) } }
  @keyframes uiTick { 0%,100% { transform: rotate(-18deg) } 50% { transform: rotate(18deg) } }
  .ui-state-in { animation: uiStateIn .4s ease-out both; }
  .ui-state-float { animation: uiStateFloat 3s ease-in-out infinite; }
  .ui-gear-a { animation: uiGearA 7s linear infinite; }
  .ui-gear-b { animation: uiGearB 5s linear infinite; }
  .ui-tick { transform-box: fill-box; transform-origin: 50% 92%; animation: uiTick 2.4s ease-in-out infinite; }
`;

/** A cog with radial teeth, hub and a rotation class. */
const Gear = ({ cx, cy, r, teeth = 9, color, spin }: { cx: number; cy: number; r: number; teeth?: number; color: string; spin: string }) => {
  const t = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * 360;
    const rad = (a * Math.PI) / 180;
    const x = cx + Math.cos(rad) * (r + 4.5);
    const y = cy + Math.sin(rad) * (r + 4.5);
    t.push(<rect key={i} x={x - 3.2} y={y - 3.2} width="6.4" height="6.4" rx="1.8" fill={color} transform={`rotate(${a} ${x} ${y})`} />);
  }
  return (
    <g className={spin} style={{ transformBox: 'fill-box', transformOrigin: `${cx}px ${cy}px` }}>
      {t}
      <circle cx={cx} cy={cy} r={r} fill="#eef2ff" stroke={color} strokeWidth="4" />
      <circle cx={cx} cy={cy} r={r * 0.36} fill="#fff" stroke={color} strokeWidth="3" />
    </g>
  );
};

export const GearsArt = () => (
  <svg viewBox="0 0 168 148" width="176" height="155" aria-hidden="true">
    <ellipse cx="84" cy="134" rx="50" ry="7.5" fill="#e2e8f0" opacity="0.7" />
    <Gear cx={66} cy={66} r={30} teeth={11} color="#4f46e5" spin="ui-gear-a" />
    <Gear cx={112} cy={94} r={20} teeth={9} color="#818cf8" spin="ui-gear-b" />
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
    {/* scattered bits */}
    <circle cx="34" cy="46" r="3" fill="#c7d2fe" />
    <circle cx="136" cy="40" r="4" fill="#c7d2fe" />
    <path d="M126 96 l7 -3 M32 92 l-7 -2" stroke="#c7d2fe" strokeWidth="3" strokeLinecap="round" />
    {/* rounded warning triangle */}
    <path d="M84 30 L138 118 a8 8 0 0 1 -7 12 H37 a8 8 0 0 1 -7 -12 Z"
      fill="url(#uiTri)" stroke="#6366f1" strokeWidth="4" strokeLinejoin="round" />
    {/* exclamation */}
    <path d="M84 62 v26" stroke="#ef4444" strokeWidth="6.5" strokeLinecap="round" />
    <circle cx="84" cy="104" r="4.5" fill="#ef4444" />
  </svg>
);

export const SessionArt = () => (
  <svg viewBox="0 0 168 148" width="176" height="155" aria-hidden="true">
    <ellipse cx="84" cy="134" rx="46" ry="7.5" fill="#e2e8f0" opacity="0.7" />
    {/* open shackle */}
    <path d="M64 66 v-8 a20 20 0 0 1 39 -6" fill="none" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
    {/* lock body */}
    <rect x="52" y="64" width="64" height="52" rx="11" fill="#eef2ff" stroke="#4f46e5" strokeWidth="4" />
    {/* keyhole */}
    <circle cx="84" cy="86" r="6" fill="#4f46e5" />
    <path d="M84 86 l0 14" stroke="#4f46e5" strokeWidth="5" strokeLinecap="round" />
    {/* little clock (timeout) */}
    <g className="ui-tick" style={{ transformOrigin: '122px 52px' }}>
      <circle cx="122" cy="52" r="15" fill="#fff" stroke="#f59e0b" strokeWidth="3.5" />
      <path d="M122 52 v-8 M122 52 l6 4" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
    </g>
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
      <style>{KEYFRAMES}</style>
      <div className="ui-state-in flex flex-col items-center">
        <div className="ui-state-float">{art}</div>
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
    <style>{KEYFRAMES}</style>
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
