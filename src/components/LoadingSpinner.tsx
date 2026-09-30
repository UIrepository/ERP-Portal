// src/components/LoadingSpinner.tsx
// Splash: logo, one illustration and a quiet grey meter. Matches the
// first-paint splash in index.html so the hand-off is seamless.

export const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <style>{`
        @keyframes uiSplashIn { 0% { opacity:0; transform:translateY(6px) } 100% { opacity:1; transform:none } }
        @keyframes uiMeter { 0% { transform:translateX(-110%) } 100% { transform:translateX(245%) } }
        .ui-splash-in { animation: uiSplashIn .5s ease-out both; }
        .ui-meter { position:relative; width:190px; height:6px; border-radius:4px; background:#e5e7eb; overflow:hidden; }
        .ui-meter i { position:absolute; top:0; left:0; height:100%; width:45%; border-radius:4px; background:#9ca3af; animation:uiMeter 1.6s ease-in-out infinite; }
      `}</style>

      <div className="ui-splash-in flex flex-col items-center">
        <img src="/logoofficial.png" alt="" className="h-12 w-12" />
        <img src="/art/my-learning.png" alt="" width={210} height={210} className="mt-[18px] object-contain" />
        <div className="ui-meter mt-3.5"><i /></div>
      </div>
    </div>
  );
};
