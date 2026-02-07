import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.tsx'
import './index.css'

inject()

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId="561606523690-f4a0387bv89guvm5922v725gdtinch1n.apps.googleusercontent.com">
    <App />
    <SpeedInsights />
  </GoogleOAuthProvider>
);
