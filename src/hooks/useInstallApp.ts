import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Module-level store: the browser fires `beforeinstallprompt` once, often before
// any component mounts, so we capture it globally and let components subscribe.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

/**
 * Open an internal (same-origin) route. In the installed PWA (standalone),
 * `window.open(_, '_blank')` breaks out into the system browser and loses the
 * app — so navigate in-place instead. In a normal browser tab, keep the
 * existing new-tab behaviour.
 */
export function openInternalRoute(
  url: string,
  navigate?: (to: string) => void,
) {
  if (isStandalone()) {
    if (navigate) navigate(url);
    else window.location.assign(url);
  } else {
    window.open(url, '_blank');
  }
}

export const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac but is touch-capable
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

/** Fire the native install prompt. Returns 'unavailable' when the browser hasn't offered one. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome;
}

/** Prompt natively if possible; otherwise ask the UI to show manual install steps. */
export async function installOrShowHelp(): Promise<void> {
  const result = await promptInstall();
  if (result === 'unavailable' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pwa:show-help'));
  }
}

export function useInstallApp() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return {
    canPrompt: !!deferredPrompt,
    installed,
    standalone: isStandalone(),
    ios: isIOS(),
    promptInstall,
    installOrShowHelp,
  };
}
