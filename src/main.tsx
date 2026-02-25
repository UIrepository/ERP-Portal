import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.tsx'
import './index.css'

inject()

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId="30618354424-bvvml6gfui5fmtnn6fdh6nbf51fb3tcr.apps.googleusercontent.com">
    <App />
    <SpeedInsights />
  </GoogleOAuthProvider>
);
