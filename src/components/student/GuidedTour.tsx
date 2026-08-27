import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface TourStep {
  /** CSS selector of the element to spotlight. Omit for a centered step. */
  selector?: string;
  title: string;
  body: string;
  /** Optional emoji shown in a chip beside the title. */
  icon?: string;
  /** Runs before the step is shown — e.g. navigate the app to the right screen.
   *  Must set ABSOLUTE state so stepping Back re-lands correctly. */
  beforeStep?: () => void | Promise<void>;
}

interface GuidedTourProps {
  steps: TourStep[];
  /** localStorage key — the tour auto-runs once per user, then remembers it's done. */
  storageKey: string;
  /** Parent gate: only auto-start once the target screen is actually rendered. */
  run: boolean;
  onClose?: () => void;
}

type Rect = { top: number; left: number; width: number; height: number };
type Tip = { top: number; left: number; arrow: number; place: 'top' | 'bottom' | 'center' };

const PAD = 4; // breathing room around the highlighted element (hug it tightly)

// A selector can match twice — the desktop sidebar rail AND the mobile bottom
// nav both carry data-tour="nav-*". Only one is on screen, so pick the first
// match that actually has size.
function firstVisible(sel: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return els[0] ?? null;
}

/**
 * Lightweight product tour: dims the whole screen, cuts a highlighted box around
 * the current element (via a big box-shadow), and shows an arrow tooltip that
 * explains what that element does. No external dependency.
 */
export function GuidedTour({ steps, storageKey, run, onClose }: GuidedTourProps) {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tip, setTip] = useState<Tip>({ top: 0, left: 0, arrow: -1, place: 'center' });
  const tipRef = useRef<HTMLDivElement>(null);

  // Auto-start once (unless the user has already seen it) — but only after the
  // first target is actually on screen AND not covered by another overlay (e.g.
  // the "confirm your name" gate or the feedback popup a new user sees first).
  useEffect(() => {
    if (!run || active) return;
    let done = false;
    try { done = localStorage.getItem(storageKey) === '1'; } catch { /* ignore */ }
    if (done) return;

    const firstSel = steps.find((s) => s.selector)?.selector;
    const ready = () => {
      if (!firstSel) return true;
      const el = firstVisible(firstSel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      // Is the target the top-most thing at its own position? If a modal covers
      // it, elementFromPoint returns the modal instead and we keep waiting.
      const cx = r.left + r.width / 2;
      const cy = r.top + Math.min(r.height / 2, 12);
      const topEl = document.elementFromPoint(cx, cy);
      return !!topEl && (topEl === el || el.contains(topEl) || topEl.contains(el));
    };

    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (ready()) { clearInterval(id); setActive(true); }
      else if (tries > 40) clearInterval(id); // give up after ~20s
    }, 500);
    return () => clearInterval(id);
  }, [run, active, storageKey, steps]);

  const finish = useCallback(() => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    setActive(false);
    setI(0);
    onClose?.();
  }, [storageKey, onClose]);

  // Measure the current target + place the tooltip.
  const measure = useCallback(() => {
    const step = steps[i];
    if (!step) return;
    const el = step.selector ? firstVisible(step.selector) : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tw = tipRef.current?.offsetWidth ?? 320;
    const th = tipRef.current?.offsetHeight ?? 170;

    if (!el) {
      setRect(null);
      setTip({ top: vh / 2 - th / 2, left: vw / 2 - tw / 2, arrow: -1, place: 'center' });
      return;
    }

    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });

    const cx = r.left + r.width / 2;
    const below = r.bottom + 16 + th < vh;
    const place: Tip['place'] = below ? 'bottom' : 'top';
    const wantedTop = below ? r.bottom + 14 : r.top - 14 - th;
    // Never let the card leave the viewport (large targets would push it off).
    const top = Math.max(12, Math.min(wantedTop, vh - th - 12));
    let left = cx - tw / 2;
    left = Math.max(12, Math.min(left, vw - tw - 12));
    // If the card had to be nudged to stay on screen, the arrow would no longer
    // line up with the target — hide it in that case.
    const arrow = Math.abs(top - wantedTop) > 2 ? -1 : Math.max(18, Math.min(cx - left, tw - 18));
    setTip({ top, left, arrow, place });
  }, [i, steps]);

  // On each step: run its navigation action, wait for the new screen's target to
  // appear, then scroll it into view and measure.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const step = steps[i];

    const settle = () => {
      const el = step?.selector ? firstVisible(step.selector) : null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      requestAnimationFrame(measure);
      timers.push(setTimeout(measure, 260));
      timers.push(setTimeout(measure, 520));
    };

    const waitForTarget = (tries: number) => {
      if (cancelled) return;
      const sel = step?.selector;
      if (!sel) { settle(); return; }
      const el = firstVisible(sel);
      const ready = el && el.getBoundingClientRect().width > 0;
      if (ready || tries > 30) settle();          // ~3.6s max wait for the screen
      else timers.push(setTimeout(() => waitForTarget(tries + 1), 120));
    };

    Promise.resolve(step?.beforeStep?.()).then(() => {
      if (!cancelled) timers.push(setTimeout(() => waitForTarget(0), 80));
    });

    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [active, i, measure, steps]);

  // Keep the spotlight glued to the element while scrolling / resizing.
  useEffect(() => {
    if (!active) return;
    const on = () => measure();
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
    };
  }, [active, measure]);

  // Esc closes.
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [active, finish]);

  if (!active || steps.length === 0) return null;
  const step = steps[i];
  const last = i === steps.length - 1;

  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    left: tip.arrow - 7,
    width: 14,
    height: 14,
    background: '#fff',
    transform: 'rotate(45deg)',
    ...(tip.place === 'bottom' ? { top: -7 } : { bottom: -7 }),
  };

  // Callback ref on the active dot: keeps it centered inside the fixed-width,
  // internally-scrolling dots strip (so only ~5 show even with many steps).
  const centerActiveDot = (el: HTMLSpanElement | null) => {
    const c = el?.parentElement;
    if (!el || !c) return;
    const cRect = c.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    c.scrollLeft += eRect.left - cRect.left - c.clientWidth / 2 + eRect.width / 2;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'auto', animation: 'gtFade .25s ease-out' }} aria-live="polite">
      <style>{`
        @keyframes gtFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gtPop {
          0% { opacity: 0; transform: translateY(8px) scale(.96) }
          100% { opacity: 1; transform: none }
        }
        @keyframes gtPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(255,255,255,.95), 0 0 0 5px rgba(255,255,255,.14), 0 0 16px 2px rgba(255,255,255,.28) }
          50% { box-shadow: 0 0 0 2px rgba(255,255,255,1), 0 0 0 8px rgba(255,255,255,.05), 0 0 26px 6px rgba(255,255,255,.42) }
        }
      `}</style>

      {/* Dark scrim (constant) + a separate pulsing highlight ring over the same box */}
      {rect ? (
        <>
          <div
            style={{
              position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height,
              borderRadius: 8, boxShadow: '0 0 0 9999px rgba(2,6,23,0.72)', pointerEvents: 'none',
              transition: 'top .34s cubic-bezier(.4,0,.2,1), left .34s cubic-bezier(.4,0,.2,1), width .34s cubic-bezier(.4,0,.2,1), height .34s cubic-bezier(.4,0,.2,1)',
            }}
          />
          <div
            style={{
              position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height,
              borderRadius: 8, pointerEvents: 'none', animation: 'gtPulse 1.9s ease-in-out infinite',
              transition: 'top .34s cubic-bezier(.4,0,.2,1), left .34s cubic-bezier(.4,0,.2,1), width .34s cubic-bezier(.4,0,.2,1), height .34s cubic-bezier(.4,0,.2,1)',
            }}
          />
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.74)', pointerEvents: 'none' }} />
      )}

      {/* Tooltip / arrow card — re-mounts each step (key) so it pops in */}
      <div
        key={i}
        ref={tipRef}
        style={{
          position: 'fixed', top: tip.top, left: tip.left,
          width: 'min(344px, calc(100vw - 24px))',
          transition: 'top .3s cubic-bezier(.4,0,.2,1), left .3s cubic-bezier(.4,0,.2,1)',
          animation: 'gtPop .34s cubic-bezier(.2,.8,.2,1)',
        }}
        className="rounded-lg bg-white p-4 shadow-2xl ring-1 ring-black/5 font-sans"
      >
        {tip.place !== 'center' && tip.arrow >= 0 && <div style={arrowStyle} />}

        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-bold leading-tight tracking-tight text-slate-900">{step.title}</h3>
          <button
            onClick={finish}
            aria-label="Close tour"
            className="-mr-1 -mt-0.5 shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{step.body}</p>

        <div className="mt-3.5 flex items-center justify-between">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto" style={{ maxWidth: 82 }}>
            {steps.map((_, k) => (
              <span
                key={k}
                ref={k === i ? centerActiveDot : undefined}
                className={`h-1.5 shrink-0 rounded-full transition-all duration-300 ${
                  k === i ? 'w-5 bg-violet-600' : 'w-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {i > 0 && (
              <button
                onClick={() => setI(i - 1)}
                className="px-2.5 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setI(i + 1))}
              className="rounded-md bg-violet-600 px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-violet-700 active:scale-95"
            >
              {last ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          {!last ? (
            <button onClick={finish} className="text-[11px] text-slate-400 transition-colors hover:text-slate-600">
              Skip tour
            </button>
          ) : (
            <span />
          )}
          <span className="text-[11px] font-medium text-slate-400">Step {i + 1} of {steps.length}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
