import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

// Cinematic crossfading photos for the left frame
const FRAME_IMAGES = [
  'https://res.cloudinary.com/dkywjijpv/image/upload/v1784030138/a6b81627-f321-4d19-b95a-903880de06f2_szbblu.png',
  'https://res.cloudinary.com/dkywjijpv/image/upload/v1784030175/592458dc-fb26-4664-9e1f-ebc596dab4f8_qaav1s.png',
];

export const AuthPage = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // signIn and signUp are not directly used but kept for AuthContext compatibility
  const { signIn, signUp } = useAuth();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setIsGoogleLoading(true);
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }

      // Exchange the ID Token for a Supabase Session
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credentialResponse.credential,
      });

      if (error) throw error;

      if (data.session) {
        // Enrollment linking is handled centrally in useAuth on SIGNED_IN,
        // so it covers this GSI flow and the redirect fallback alike.
        toast({
          title: 'Success',
          description: 'Signed in successfully',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sign in',
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast({
      title: 'Error',
      description: 'Google login was cancelled or failed',
      variant: 'destructive',
    });
    setIsGoogleLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full bg-white font-sans md:grid md:grid-cols-[1.05fr_1fr]">
      {/* Cinematic crossfade keyframes for the left frame */}
      <style>{`
        @keyframes uiCrossfade { 0%,40% { opacity:0 } 50%,90% { opacity:1 } 100% { opacity:0 } }
        .ui-slide { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .ui-slide--top { animation: uiCrossfade 14s ease-in-out infinite; }
        @keyframes uiRise { 0% { opacity:0; transform:translateY(10px) } 100% { opacity:1; transform:translateY(0) } }
        @keyframes uiFlicker { 0%,100% { transform:rotate(-7deg) scale(1) } 50% { transform:rotate(7deg) scale(1.2) } }
        @keyframes uiMarquee { from { transform:translateX(0) } to { transform:translateX(-50%) } }
        .ui-tagline { animation: uiRise .7s cubic-bezier(.2,.7,.2,1) both; }
        .ui-emoji { display:inline-block; animation: uiFlicker 1.5s ease-in-out infinite; transform-origin: 60% 85%; }
        .ui-notice-track { display:flex; width:max-content; animation: uiMarquee 28s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ui-slide--top { animation: none; opacity:0; }
          .ui-tagline, .ui-emoji, .ui-notice-track { animation: none; }
        }
      `}</style>

      {/* Page-level technical update */}
      <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center px-6 text-center" role="status" aria-label="Service update">
        <div className="w-full max-w-none text-slate-800">
          <div className="text-[12px] font-bold uppercase tracking-[0.22em] text-red-600">
            Update
          </div>
          <div className="mt-2 w-full overflow-hidden whitespace-nowrap text-[12px] leading-relaxed">
            <div className="ui-notice-track">
              <span className="px-8">Some users may experience intermittent issues accessing the dashboard. Our engineering team is investigating the incident and working to restore full service. An update has been released, and monitoring is ongoing. We apologize for the inconvenience. Reported at: 4:35 AM IST, 6 August 2026.</span>
              <span className="px-8" aria-hidden="true">Some users may experience intermittent issues accessing the dashboard. Our engineering team is investigating the incident and working to restore full service. An update has been released, and monitoring is ongoing. We apologize for the inconvenience. Reported at: 4:35 AM IST, 6 August 2026.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Left: framed cinematic photo pair — full 3:2 image, centered (desktop only) */}
      <aside className="relative hidden md:flex items-center justify-center overflow-hidden bg-white p-6 lg:p-10">
        <div className="relative w-full max-w-[640px] aspect-[3/2] overflow-hidden rounded-[24px] bg-slate-900 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.5)] ring-1 ring-black/5">
          <img src={FRAME_IMAGES[0]} alt="" aria-hidden className="ui-slide" />
          <img src={FRAME_IMAGES[1]} alt="" aria-hidden className="ui-slide ui-slide--top" />
        </div>
      </aside>

      {/* Right: sign-in */}
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 pt-40 md:pt-44">
        <div className="w-full max-w-sm">
          {/* UI logo + brand name (Inter Regular) */}
          <div className="flex items-center justify-center gap-2.5">
            <img src="/logoofficial.png" alt="Unknown IITians" className="h-9 w-9" />
            <span className="text-[17px] font-normal tracking-tight text-slate-800">Unknown IITians</span>
          </div>

          {/* Heading + welcome */}
          <p className="ui-tagline mt-14 text-center text-[22px] font-semibold leading-relaxed tracking-tight text-slate-800">
            Your study choice is too good <span className="ui-emoji align-middle">&#128293;</span>
          </p>
          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-emerald-600">
            Make sure you sign in with the same Google account you used to register for your batch.
          </p>

          {/* Google sign-in (light grey) */}
          <div className="relative mt-11 w-full">
            {/* INVISIBLE OVERLAY — the real Google button sits on top of the styled one */}
            <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden opacity-0 [transform:scaleY(1.5)]">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                type="standard"
                theme="outline"
                size="large"
                shape="rectangular"
                width="1000"
              />
            </div>

            {/* Visual button — light greyish */}
            <Button
              type="button"
              variant="outline"
              disabled={isGoogleLoading}
              className="relative z-10 flex w-full items-center justify-center gap-3 rounded-md border border-slate-200 bg-slate-100 py-7 text-[15px] font-medium text-slate-700 shadow-sm transition-all duration-300 hover:border-slate-300 hover:bg-slate-200/80 hover:shadow focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </div>

          {/* Terms */}
          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-slate-400">
            By continuing, you agree to our Terms of Use &amp; Privacy Policy.
          </p>

        </div>
      </main>
    </div>
  );
};
