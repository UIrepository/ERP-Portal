// src/components/LoadingSpinner.tsx
// Splash: logo, a quiet grey meter, and a row of small rounded cubes each
// holding a white education glyph (PDF, YouTube play, file, timer, books,
// pencil). The icon stays white; the cube colour changes grey -> colour and
// pops up in sequence.
import React from 'react';

const ICONS: { color: string; glyph: string }[] = [
  { color: '#ef4444', glyph: '<path d="M6.5 3.5h6L18 8.8v11.7H6.5z"/><path d="M12.5 3.5v5.3H18"/><text x="12.2" y="17.6" font-size="5.6" font-weight="800" fill="#fff" stroke="none" text-anchor="middle" font-family="Arial,Helvetica,sans-serif">PDF</text>' }, // PDF
  { color: '#ff0000', glyph: '<path d="M9.6 7.7a1 1 0 0 1 1.5-.87l5.8 3.6a1 1 0 0 1 0 1.72l-5.8 3.6A1 1 0 0 1 9.6 15z" fill="#fff" stroke="none"/>' },                                                             // YouTube play
  { color: '#0ea5e9', glyph: '<path d="M7 3.5h6L17.5 8v12.5H7z"/><path d="M13 3.5V8h4.5"/>' },                                                                                                                    // file (Windows)
  { color: '#f59e0b', glyph: '<circle cx="12" cy="13.7" r="6.4"/><path d="M12 13.7V9.8"/><path d="M9.6 3.6h4.8"/><path d="M12 3.6v3"/>' },                                                                         // timer
  { color: '#10b981', glyph: '<path d="M5 5.5h4.5v13H5zM11 6.2l6-.8 1.2 12.6-6 .8z"/>' },                                                                                                                         // books
  { color: '#8b5cf6', glyph: '<path d="M5 19l.9-3.8L15.4 5.7a1.8 1.8 0 0 1 2.5 0l.4.4a1.8 1.8 0 0 1 0 2.5L8.8 18.1 5 19z"/><path d="M13.8 7.3l2.9 2.9"/>' },                                                       // pencil
];

const STEP = 0.5;                    // seconds between each cube lift
const CYCLE = ICONS.length * STEP;   // full loop length
const GREY = '#94a3b8';              // idle cube colour

export const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <style>{`
        @keyframes uiSplashIn { 0% { opacity:0; transform:translateY(6px) } 100% { opacity:1; transform:none } }
        @keyframes uiMeter { 0% { transform:translateX(-110%) } 100% { transform:translateX(245%) } }
        @keyframes uiPop {
          0%   { transform:translateY(0) scale(1);        background:${GREY}; }
          8%   { transform:translateY(-11px) scale(1.14); background:var(--c); }
          18%  { transform:translateY(0) scale(1);        background:${GREY}; }
          100% { transform:translateY(0) scale(1);        background:${GREY}; }
        }
        .ui-splash-in { animation: uiSplashIn .5s ease-out both; }
        .ui-meter { position:relative; width:190px; height:6px; border-radius:4px; background:#e5e7eb; overflow:hidden; }
        .ui-meter i { position:absolute; top:0; left:0; height:100%; width:45%; border-radius:4px; background:#9ca3af; animation:uiMeter 1.6s ease-in-out infinite; }
        .ui-chip { width:32px; height:32px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center;
          background:${GREY}; will-change:transform; animation:uiPop ${CYCLE}s ease-in-out infinite; }
        .ui-chip svg { width:21px; height:21px; display:block; fill:none; stroke:#fff; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
      `}</style>

      <div className="ui-splash-in flex flex-col items-center">
        <img src="/logoofficial.png" alt="" className="h-16 w-16" />
        <div className="ui-meter mt-7"><i /></div>
        <div className="mt-9 flex items-center gap-[7px]">
          {ICONS.map(({ glyph, color }, i) => (
            <span
              key={i}
              className="ui-chip"
              style={{ animationDelay: `${i * STEP}s`, ['--c' as string]: color } as React.CSSProperties}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: glyph }} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
