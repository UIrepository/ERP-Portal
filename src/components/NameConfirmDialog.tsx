import { useState } from 'react';

/**
 * Presentational monthly "confirm your name" popup: 75% of the screen, white
 * card with 4px corners, on a blurred backdrop, Inter. The thinking face is an
 * inline SVG so it renders identically everywhere (never the OS/Android glyph).
 */
interface NameConfirmDialogProps {
  currentName: string;
  onConfirm: (name: string) => void;
  onKeepSame: () => void;
  busy?: boolean;
}

const ThinkingFace = () => (
  <svg className="w-20 h-20 mb-6" viewBox="0 0 128 128" role="img" aria-label="Thinking face">
    <defs>
      <radialGradient id="ncFace" cx="0.4" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#FFE88F" />
        <stop offset="0.55" stopColor="#FFD24C" />
        <stop offset="1" stopColor="#EFA02A" />
      </radialGradient>
      <radialGradient id="ncGloss" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ncRim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#B5722A" stopOpacity="0" />
        <stop offset="1" stopColor="#B0691F" stopOpacity="0.38" />
      </linearGradient>
    </defs>
    {/* face base with soft shading */}
    <circle cx="64" cy="64" r="48" fill="url(#ncFace)" />
    {/* bottom rim shadow → volume */}
    <ellipse cx="64" cy="88" rx="45" ry="30" fill="url(#ncRim)" />
    {/* top gloss highlight */}
    <ellipse cx="50" cy="42" rx="30" ry="19" fill="url(#ncGloss)" />
    {/* eyes (looking up, thinking) with catchlights */}
    <ellipse cx="50" cy="60" rx="5.2" ry="6.8" fill="#4a3a22" />
    <ellipse cx="81" cy="57" rx="5.2" ry="6.8" fill="#4a3a22" />
    <circle cx="48.2" cy="57.4" r="1.7" fill="#fff" opacity="0.92" />
    <circle cx="79.2" cy="54.4" r="1.7" fill="#fff" opacity="0.92" />
    {/* eyebrows — right raised (the thinking cue) */}
    <path d="M40 49 q9 -6 18 -1.5" fill="none" stroke="#5a4326" strokeWidth="4.4" strokeLinecap="round" />
    <path d="M70 40 q10 -6.5 19 -1.5" fill="none" stroke="#5a4326" strokeWidth="4.4" strokeLinecap="round" />
    {/* pursed, slightly skeptical mouth pushed to one side */}
    <path d="M50 86 q10 -3.5 21 -6.5" fill="none" stroke="#7a4a26" strokeWidth="4.2" strokeLinecap="round" />
  </svg>
);

export const NameConfirmDialog = ({ currentName, onConfirm, onKeepSame, busy }: NameConfirmDialogProps) => {
  const [name, setName] = useState(currentName);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />

      <div className="relative flex flex-col items-center justify-center bg-white rounded-[4px] shadow-2xl p-8 w-[75vw] h-[75vh] max-[640px]:w-[92vw] max-[640px]:h-[84vh] max-[640px]:p-6">
        <div className="w-full max-w-[440px] flex flex-col items-center text-center">
          <ThinkingFace />

          <h1 className="text-[23px] leading-tight font-medium tracking-tight text-slate-900 text-balance max-[640px]:text-[20px]">
            Please confirm your name
          </h1>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            spellCheck={false}
            aria-label="Your name"
            className="mt-6 w-full h-12 px-3.5 text-base text-slate-900 bg-slate-50 border border-slate-300 rounded-[4px] outline-none transition focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-600/20"
          />

          <div className="w-full mt-6 flex items-center justify-between gap-4 max-[640px]:flex-col-reverse max-[640px]:items-stretch">
            <button
              type="button"
              onClick={onKeepSame}
              disabled={busy}
              className="py-1.5 text-sm text-slate-500 underline underline-offset-[3px] transition hover:text-slate-900 disabled:opacity-60 max-[640px]:text-center"
            >
              Keep the name same as current
            </button>
            <button
              type="button"
              onClick={() => onConfirm(name.trim())}
              disabled={busy || !name.trim()}
              className="h-12 px-6 text-[15px] font-medium text-white bg-indigo-600 rounded-[4px] transition hover:bg-indigo-700 active:translate-y-px disabled:opacity-60 max-[640px]:w-full"
            >
              {busy ? 'Saving…' : 'Confirm name'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
