// src/components/LoadingSpinner.tsx
// Splash: a few illustrations that cross-fade in turn, and a quiet grey meter.
// Matches the first-paint splash in index.html so the hand-off is seamless.

const ART = ['my-learning', 'lectures', 'notes', 'dpp', 'ui-ki-padhai'];
const STEP = 1.5; // seconds each illustration stays up

export const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <style>{`
        @keyframes uiSplashIn { 0% { opacity:0; transform:translateY(6px) } 100% { opacity:1; transform:none } }
        @keyframes uiMeter { 0% { transform:translateX(-110%) } 100% { transform:translateX(245%) } }
        @keyframes uiCycle { 0% { opacity:0; transform:scale(.96) } 4% { opacity:1; transform:none } 18% { opacity:1; transform:none } 22% { opacity:0; transform:scale(1.02) } 100% { opacity:0 } }
        .ui-splash-in { animation: uiSplashIn .5s ease-out both; }
        .ui-art { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; opacity:0; animation: uiCycle ${ART.length * STEP}s ease-in-out infinite; }
        .ui-meter { position:relative; width:190px; height:6px; border-radius:4px; background:#e5e7eb; overflow:hidden; }
        .ui-meter i { position:absolute; top:0; left:0; height:100%; width:45%; border-radius:4px; background:#9ca3af; animation:uiMeter 1.6s ease-in-out infinite; }
      `}</style>

      <div className="ui-splash-in flex flex-col items-center">
        <div className="relative h-[220px] w-[220px]" aria-label="Loading">
          {ART.map((name, i) => (
            <img key={name} src={`/art/${name}.png`} alt="" className="ui-art" style={{ animationDelay: `${i * STEP}s` }} />
          ))}
        </div>
        <div className="ui-meter mt-3.5"><i /></div>
      </div>
    </div>
  );
};
