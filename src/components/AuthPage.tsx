import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';


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
        // CALL EDGE FUNCTION TO LINK ENROLLMENTS
        // This ensures the user_id is stamped on any enrollments matching this email
        try {
          const { error: linkError } = await supabase.functions.invoke('link-user-enrollments', {
            body: { 
              email: data.session.user.email,
              user_id: data.session.user.id 
            },
          });

          if (linkError) {
            console.error('Error linking enrollments:', linkError);
          } else {
            console.log('Enrollments linked successfully');
          }
        } catch (linkErr) {
          console.error('Failed to invoke link-user-enrollments:', linkErr);
        }

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
    <div className="min-h-screen w-full md:grid md:grid-cols-[1.1fr_1fr] bg-white">
      {/* Left: brand panel — deep ink, subtle grid + a single soft brand glow.
          No blurred blobs. Editorial, calm, trustworthy. */}
      <aside className="relative hidden md:flex flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white">
        {/* fine grid texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 30% 20%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 30% 20%, black, transparent 75%)',
          }}
        />
        {/* one restrained brand glow (not a blob field) */}
        <div
          aria-hidden
          className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(243 75% 59% / 0.45), transparent 70%)' }}
        />

        <div className="relative flex items-center gap-3">
          <img src="/logoofficial.png" alt="Unknown IITians" className="h-10 w-10" />
          <span className="text-sm font-medium tracking-wide text-white/70">Unknown IITians</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight">
            Your classroom,
            <span className="block text-white/55">organised.</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            Live classes, recordings, notes, doubts and schedules — one portal for
            everything in your batch.
          </p>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-white/40">
          <span>Student Services Portal</span>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <span>ssp.unknowniitians.com</span>
        </div>
      </aside>

      {/* Right: sign-in */}
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* mobile-only logo */}
          <div className="mb-10 flex items-center gap-3 md:hidden">
            <img src="/logoofficial.png" alt="Unknown IITians" className="h-9 w-9" />
            <span className="text-sm font-medium text-slate-500">Unknown IITians</span>
          </div>

          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
            Sign in
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Use the Google account you registered with during batch enrollment.
          </p>

          <div className="relative mt-8 w-full">
            {/* INVISIBLE OVERLAY — real Google button sits on top of the
                styled one. Kept exactly as before for functionality. */}
            <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden opacity-0 transform scale-y-150">
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

            {/* Visual button */}
            <Button
              type="button"
              className="relative z-10 flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-6 text-[15px] font-medium text-slate-700 shadow-sm transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand/40"
              variant="outline"
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
            By signing in you agree to the portal's acceptable-use policy.
          </p>
        </div>
      </main>
    </div>
  );
};
