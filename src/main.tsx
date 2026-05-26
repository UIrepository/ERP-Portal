import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.tsx'
import './index.css'

inject()

// Register the service worker so the app is installable (PWA).
if ('serviceWorker' in navigator) {
  // If a service worker already controls this page, a later controllerchange
  // means a new version activated — reload once so the running page can't use
  // a stale bundle against freshly-deployed assets (the white-screen cause).
  if (navigator.serviceWorker.controller) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for an updated worker on every load.
        reg.update().catch(() => {});
      })
      .catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId="30618354424-bvvml6gfui5fmtnn6fdh6nbf51fb3tcr.apps.googleusercontent.com">
    <App />
    <SpeedInsights />
  </GoogleOAuthProvider>
);
