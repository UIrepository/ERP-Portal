import React from 'react';

/* ------------------------------------------------------------------ *
 * Shared, on-brand artwork + scaffolding for full-page app states.
 * Soft two-tone indigo/slate illustrations, Inter. No animation.
 * ------------------------------------------------------------------ */





export const RoadworkArt = ({ size = 240 }: { size?: number }) => (
  <img src="/art/state-maintenance.png" alt="" aria-hidden width={size} height={size} draggable={false} className="object-contain" />
);

export const CrashArt = ({ size = 240 }: { size?: number }) => (
  <img src="/art/state-error.png" alt="" aria-hidden width={size} height={size} draggable={false} className="object-contain" />
);

export const SessionArt = ({ size = 240 }: { size?: number }) => (
  <img src="/art/state-session.png" alt="" aria-hidden width={size} height={size} draggable={false} className="object-contain" />
);

export const EmptyArt = ({ size = 150 }: { size?: number }) => (
  <img src="/art/empty.png" alt="" aria-hidden width={size} height={size} draggable={false} className="object-contain" />
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
  title, subtitle, className = '', art,
}: { title: string; subtitle?: string; className?: string; art?: string }) => (
  <div className={`flex flex-col items-center justify-center py-14 text-center ${className}`}>
    {art ? <img src={art} alt="" aria-hidden width={200} height={200} draggable={false} className="object-contain" /> : <EmptyArt />}
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
