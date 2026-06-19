import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { DownloadCircle01Icon, Download01Icon, Share01Icon, AddSquareIcon, More01Icon } from '@hugeicons/core-free-icons';
import { useInstallApp } from '@/hooks/useInstallApp';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToPush } from '@/lib/push';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * Floating "Get the app" banner (cookie-style, slides up from the bottom).
 * Re-appears on every reload (no persisted dismissal) until the app is installed.
 * Handles native install (Chrome/Edge/Android) and manual steps (iOS Safari / others).
 */
export const InstallAppBanner = () => {
  const { standalone, ios, canPrompt, installOrShowHelp } = useInstallApp();
  const { user, profile } = useAuth();
  const userId = user?.id || profile?.user_id;
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Don't interrupt the full-screen whiteboard (it opens in its own tab) with
  // the install banner.
  const onWhiteboard =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/whiteboard');

  // Slide up shortly after load, every reload.
  useEffect(() => {
    if (standalone || onWhiteboard) return;
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, [standalone, onWhiteboard]);

  // Sidebar "Get App" button can ask us to show the manual steps.
  useEffect(() => {
    const handler = () => setShowHelp(true);
    window.addEventListener('pwa:show-help', handler);
    return () => window.removeEventListener('pwa:show-help', handler);
  }, []);

  if (standalone || onWhiteboard) return null;

  const handleInstall = async () => {
    // This is a user gesture — also a good moment to enable notifications.
    void subscribeToPush(userId);
    if (canPrompt) {
      await installOrShowHelp(); // prompts natively
      // If accepted, the appinstalled event hides everything; close the card regardless.
      setVisible(false);
      return;
    }
    // No native prompt available → show manual instructions.
    setShowHelp(true);
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-[120] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none font-sans"
          >
            <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-4 p-4">
                {/* App icon */}
                <div className="shrink-0 rounded-md border border-slate-200 overflow-hidden h-12 w-12 bg-white">
                  <img src="/icon-192.png" alt="App icon" className="h-full w-full object-cover" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-slate-900 leading-tight">Get the app</p>
                  <p className="text-[13px] text-slate-500 leading-snug mt-0.5">
                    Install for a faster, full-screen, app-like experience.
                  </p>
                </div>

                {/* Actions - stacked vertically beside the content */}
                <div className="shrink-0 flex flex-col gap-2 w-32">
                  <button
                    onClick={handleInstall}
                    className="inline-flex items-center justify-center gap-1.5 rounded-sm bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition-colors"
                  >
                    <HugeiconsIcon icon={Download01Icon} size={20} strokeWidth={2} />
                    Install
                  </button>
                  <button
                    onClick={() => setVisible(false)}
                    className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual install instructions (iOS Safari / unsupported browsers) */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <HugeiconsIcon icon={DownloadCircle01Icon} size={20} strokeWidth={2} className="text-indigo-600" />
              Install UI Portal
            </DialogTitle>
            <DialogDescription>
              {ios
                ? 'Add the portal to your Home Screen for an app-like experience.'
                : 'Install the portal from your browser menu for an app-like experience.'}
            </DialogDescription>
          </DialogHeader>

          <ol className="mt-1 space-y-3">
            {ios ? (
              <>
                <Step n={1} icon={Share01Icon}>
                  Tap the <span className="font-semibold text-slate-900">Share</span> button in Safari's toolbar.
                </Step>
                <Step n={2} icon={AddSquareIcon}>
                  Choose <span className="font-semibold text-slate-900">Add to Home Screen</span>.
                </Step>
                <Step n={3} icon={DownloadCircle01Icon}>
                  Tap <span className="font-semibold text-slate-900">Add</span> — the app appears on your Home Screen.
                </Step>
              </>
            ) : (
              <>
                <Step n={1} icon={More01Icon}>
                  Open your browser menu (<span className="font-semibold text-slate-900">⋮</span> top-right).
                </Step>
                <Step n={2} icon={DownloadCircle01Icon}>
                  Choose <span className="font-semibold text-slate-900">Install app</span> or{' '}
                  <span className="font-semibold text-slate-900">Add to Home screen</span>.
                </Step>
              </>
            )}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Step = ({ n, icon, children }: { n: number; icon: typeof DownloadCircle01Icon; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
      <HugeiconsIcon icon={icon} size={16} strokeWidth={2} />
    </span>
    <span className="text-sm text-slate-600 leading-relaxed">
      <span className="font-medium text-slate-400 mr-1">{n}.</span>
      {children}
    </span>
  </li>
);
