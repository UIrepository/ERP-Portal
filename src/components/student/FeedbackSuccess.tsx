/**
 * Blinkit-style "order placed" success beat, shown on feedback confirmation
 * (both the feedback popup and the mandatory gate). Springy badge + radiating
 * burst + drawing checkmark + text that rises in. Honors reduced-motion.
 */
export const FeedbackSuccess = ({
  title = 'Feedback submitted!',
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) => (
  <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
    <style>{`
      @keyframes fgPop {0%{transform:scale(0);opacity:0}55%{transform:scale(1.14)}100%{transform:scale(1);opacity:1}}
      @keyframes fgRing {0%{transform:scale(.55);opacity:.55}100%{transform:scale(2.1);opacity:0}}
      @keyframes fgRing2 {0%{transform:scale(.55);opacity:.35}100%{transform:scale(2.6);opacity:0}}
      @keyframes fgDraw {to{stroke-dashoffset:0}}
      @keyframes fgRise {0%{transform:translateY(10px);opacity:0}100%{transform:translateY(0);opacity:1}}
      .fg-badge{animation:fgPop .5s cubic-bezier(.2,.8,.3,1.25) both}
      .fg-ring{animation:fgRing .9s ease-out .08s both}
      .fg-ring2{animation:fgRing2 1s ease-out .16s both}
      .fg-check{stroke-dasharray:30;stroke-dashoffset:30;animation:fgDraw .4s ease-out .28s forwards}
      .fg-t1{animation:fgRise .42s ease-out .3s both}
      .fg-t2{animation:fgRise .42s ease-out .4s both}
      @media (prefers-reduced-motion: reduce){
        .fg-badge,.fg-ring,.fg-ring2,.fg-check,.fg-t1,.fg-t2{animation:none!important}
        .fg-check{stroke-dashoffset:0}
        .fg-ring,.fg-ring2{display:none}
      }
    `}</style>
    <div className="relative h-24 w-24 mb-5 flex items-center justify-center">
      <span className="fg-ring absolute inset-0 rounded-full bg-emerald-400/30" />
      <span className="fg-ring2 absolute inset-0 rounded-full bg-emerald-400/25" />
      <div className="fg-badge relative h-20 w-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
          <path className="fg-check" d="M5 12.5l4.2 4.2L19 7" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
    <h3 className="fg-t1 text-[22px] font-semibold text-gray-900 tracking-tight">{title}</h3>
    {subtitle && <p className="fg-t2 text-gray-500 mt-1.5 text-sm">{subtitle}</p>}
  </div>
);
