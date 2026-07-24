import React from 'react';

/* ------------------------------------------------------------------ *
 * Shared, on-brand artwork + scaffolding for full-page app states.
 * Soft two-tone indigo/slate illustrations, Inter. No animation.
 * ------------------------------------------------------------------ */

/**
 * Maintenance scene — a composed, softly-lit roadwork vignette: hi-vis worker
 * holding a diamond road-work sign, a striped barricade in perspective, a
 * gradient traffic cone, cement bags and a coiled cable. Static (no motion).
 */
export const RoadworkArt = () => (
  <svg viewBox="0 0 320 268" width="264" height="221" role="img" aria-label="Under maintenance">
    <defs>
      <radialGradient id="mBg" cx="50%" cy="42%" r="62%">
        <stop offset="0" stopColor="#f4f6ff" />
        <stop offset="1" stopColor="#dfe4fb" />
      </radialGradient>
      <linearGradient id="mVest" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fcd34d" />
        <stop offset="1" stopColor="#f59e0b" />
      </linearGradient>
      <linearGradient id="mHat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fde68a" />
        <stop offset="1" stopColor="#f59e0b" />
      </linearGradient>
      <linearGradient id="mCone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fdba74" />
        <stop offset="1" stopColor="#ea580c" />
      </linearGradient>
      <linearGradient id="mBar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fbbf24" />
        <stop offset="1" stopColor="#f59e0b" />
      </linearGradient>
      <pattern id="mStripe" width="22" height="22" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="22" height="22" fill="url(#mBar)" />
        <rect width="11" height="22" fill="#fffaf0" />
      </pattern>
    </defs>

    {/* backdrop */}
    <circle cx="160" cy="116" r="112" fill="url(#mBg)" />
    <circle cx="160" cy="116" r="112" fill="none" stroke="#c7d2fe" strokeWidth="2" strokeDasharray="1 13" strokeLinecap="round" opacity="0.55" />
    <ellipse cx="160" cy="232" rx="102" ry="12" fill="#c7d2fe" opacity="0.35" />

    {/* striped barricade (behind, left) with perspective + depth */}
    <g>
      <path d="M44 198 L70 150" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      <path d="M104 198 L82 150" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <path d="M26 138 L118 130 L118 148 L26 156 Z" fill="url(#mStripe)" stroke="#78716c" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 156 L118 148 L118 152 L26 160 Z" fill="#92400e" opacity="0.45" />
      <path d="M32 176 L112 170" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
    </g>

    {/* cement sacks (left, at the ground) */}
    <g>
      <path d="M50 226 q3 -18 22 -18 q19 0 22 18 q1 7 -7 7 H57 q-8 0 -7 -7 Z" fill="#e7e5e4" stroke="#a8a29e" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M64 209 q8 -4 16 0" stroke="#a8a29e" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="60" y="222" width="24" height="7" rx="2.5" fill="#c7d2fe" opacity="0.9" />
    </g>

    {/* ---- WORKER (built from connected, round-capped forms) ---- */}
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* legs */}
      <path d="M153 176 L149 236" stroke="#3730a3" strokeWidth="16" />
      <path d="M167 176 L171 236" stroke="#312e81" strokeWidth="16" />
      {/* boots */}
      <path d="M138 236 h18 q3 0 3 3 v5 q0 4 -4 4 h-24 q-3 0 -3 -3 q0 -6 10 -9 Z" fill="#334155" />
      <path d="M182 236 h-18 q-3 0 -3 3 v5 q0 4 4 4 h24 q3 0 3 -3 q0 -6 -10 -9 Z" fill="#1e293b" />

      {/* torso jacket */}
      <path d="M141 138 Q140 131 149 130 H171 Q180 131 179 138 L181 176 Q181 185 172 185 H148 Q139 185 139 176 Z"
        fill="url(#mVest)" stroke="#d97706" strokeWidth="2" />

      {/* left arm (resting) — connected round form, jacket-coloured */}
      <path d="M147 142 L139 166 L147 189" fill="none" stroke="#f59e0b" strokeWidth="14" />
      <path d="M142 180 l8 -1" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx="148" cy="192" r="7" fill="#f4c8a0" stroke="#e0aa80" strokeWidth="1.5" />

      {/* right arm (raised, gripping the pole) */}
      <path d="M173 142 L196 139 L205 113" fill="none" stroke="#f59e0b" strokeWidth="14" />
      <path d="M198 128 l8 -3" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx="206" cy="110" r="7.5" fill="#f4c8a0" stroke="#e0aa80" strokeWidth="1.5" />
      <path d="M203 106 q5 -3 8 1" stroke="#e0aa80" strokeWidth="2.5" fill="none" />

      {/* jacket reflective detail (over the torso) */}
      <path d="M160 131 L160 183" stroke="#fff7ed" strokeWidth="3" opacity="0.85" />
      <path d="M145 158 Q160 164 175 158" stroke="#e5e7eb" strokeWidth="5" fill="none" />
      <path d="M146 170 Q160 175 174 170" stroke="#cbd5e1" strokeWidth="4" fill="none" />
      <path d="M150 132 Q160 140 170 132" stroke="#b45309" strokeWidth="2" fill="none" opacity="0.5" />

      {/* neck + head */}
      <path d="M154 120 h12 v9 q-6 4 -12 0 Z" fill="#e8b48a" />
      <circle cx="160" cy="108" r="15.5" fill="#f4c8a0" />
      <path d="M145 110 a15.5 15.5 0 0 0 30 0" fill="#f4c8a0" />
      <ellipse cx="152" cy="114" rx="2.4" ry="1.6" fill="#f0a884" opacity="0.6" />
      <ellipse cx="168" cy="114" rx="2.4" ry="1.6" fill="#f0a884" opacity="0.6" />
      <circle cx="154.5" cy="108" r="1.7" fill="#3f3f46" />
      <circle cx="165.5" cy="108" r="1.7" fill="#3f3f46" />
      <path d="M156 115 q4 3.5 8 0" fill="none" stroke="#b9704a" strokeWidth="1.7" />

      {/* hard hat: rounded dome, ridges, and a subtly curved brim */}
      <path d="M144 101 Q144 79 160 79 Q176 79 176 101 Z" fill="url(#mHat)" stroke="#d97706" strokeWidth="2" />
      <path d="M160 80 V100" stroke="#d97706" strokeWidth="1.5" opacity="0.35" />
      <path d="M152 83 Q150 92 151 100 M168 83 Q170 92 169 100" stroke="#d97706" strokeWidth="1.4" fill="none" opacity="0.3" />
      <path d="M150 90 Q160 84 170 90" stroke="#fef3c7" strokeWidth="3" fill="none" opacity="0.85" />
      <path d="M141 100 h38 q2.5 0 2.5 2.9 q0 2.9 -2.5 3.7 q-19 3 -38 0 q-2.5 -0.8 -2.5 -3.7 q0 -2.9 2.5 -2.9 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
      <path d="M156 100 h8 q1.5 0 1.5 2.6 q0 2.6 -1.5 3 h-8 q-1.5 -0.4 -1.5 -3 q0 -2.6 1.5 -2.6 Z" fill="#f59e0b" opacity="0.5" />
    </g>

    {/* diamond road-work sign in the raised hand */}
    <g strokeLinejoin="round">
      <path d="M206 112 L234 44" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      <path d="M206 112 L234 44" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" />
      <g transform="rotate(45 236 42)">
        <rect x="217" y="23" width="38" height="38" rx="6" fill="url(#mHat)" stroke="#b45309" strokeWidth="3" />
        <rect x="221" y="27" width="30" height="30" rx="3" fill="none" stroke="#1f2937" strokeWidth="2" opacity="0.85" />
      </g>
      {/* worker-with-shovel glyph, upright */}
      <g transform="translate(236 42)" stroke="#1f2937" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="-7" cy="-10" r="3.1" fill="#1f2937" stroke="none" />
        <path d="M-7 -5 l1 8" />
        <path d="M-6 -1 l10 4" />
        <path d="M-6 3 l-3 8 M-6 3 l4 7" />
        <path d="M4 3 l10 9" />
        <path d="M13 11 l7 3 l-2 4 l-8 -4 Z" fill="#1f2937" stroke="none" />
      </g>
    </g>

    {/* traffic cone (front right) with gradient + reflective bands */}
    <g strokeLinejoin="round">
      <ellipse cx="240" cy="236" rx="34" ry="8" fill="#9a3412" opacity="0.22" />
      <path d="M240 152 a4 4 0 0 1 4 3 l21 76 a3 3 0 0 1 -3 4 h-44 a3 3 0 0 1 -3 -4 l21 -76 a4 4 0 0 1 4 -3 Z" fill="url(#mCone)" stroke="#c2410c" strokeWidth="2" />
      <path d="M232 188 h16 l1.4 6 h-18.4 Z" fill="#fff7ed" />
      <path d="M226 212 h28 l1.4 6 h-30.8 Z" fill="#fff7ed" />
      <path d="M238 154 q-3 28 -8 80" stroke="#ffedd5" strokeWidth="2.5" fill="none" opacity="0.7" strokeLinecap="round" />
      <rect x="208" y="230" width="64" height="10" rx="4" fill="url(#mCone)" stroke="#c2410c" strokeWidth="2" />
      <rect x="212" y="232" width="28" height="3" rx="1.5" fill="#fdba74" />
    </g>

    {/* neat coiled cable (front left) */}
    <g fill="none" strokeLinecap="round">
      <ellipse cx="112" cy="238" rx="20" ry="7" stroke="#4338ca" strokeWidth="5" />
      <ellipse cx="112" cy="234.5" rx="13" ry="4.5" stroke="#6366f1" strokeWidth="5" />
      <path d="M128 235 q9 -1 10 6" stroke="#4338ca" strokeWidth="5" />
      <rect x="135" y="239" width="7" height="5" rx="1.5" fill="#ef4444" stroke="none" />
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
