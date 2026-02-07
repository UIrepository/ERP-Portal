import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Declare google identity services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, options: {
            type?: string;
            theme?: string;
            size?: string;
            text?: string;
            shape?: string;
            width?: number;
          }) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = "561606523690-f4a0387bv89guvm5922v725gdtinch1n.apps.googleusercontent.com";

export const AuthPage = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  // signIn and signUp are not directly used but kept for AuthContext compatibility
  const { signIn, signUp } = useAuth(); 

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    setIsGoogleLoading(true);
    try {
      // The credential is an ID token (JWT) that Supabase can verify
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      });

      if (error) {
        console.error('Supabase auth error:', error);
        toast({
          title: 'Authentication Error',
          description: error.message || 'Failed to sign in with Google',
          variant: 'destructive',
        });
        return;
      }

      // Success - user is now authenticated
      toast({
        title: 'Welcome!',
        description: 'Successfully signed in',
      });
      
    } catch (error: any) {
      console.error('Google auth error:', error);
      toast({
        title: 'Authentication Error',
        description: error.message || 'Failed to sign in with Google',
        variant: 'destructive',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  }, []);

  // Load Google Identity Services script
  useEffect(() => {
    const loadGoogleScript = () => {
      if (document.getElementById('google-gsi-script')) {
        setIsGsiLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsGsiLoaded(true);
      };
      document.head.appendChild(script);
    };

    loadGoogleScript();
  }, []);

  // Initialize Google Sign-In when script is loaded
  useEffect(() => {
    if (!isGsiLoaded || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
    });
  }, [isGsiLoaded, handleCredentialResponse]);

  const handleGoogleAuth = () => {
    if (!window.google) {
      toast({
        title: 'Error',
        description: 'Google Sign-In is not loaded yet. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsGoogleLoading(true);
    // Trigger the One Tap prompt
    window.google.accounts.id.prompt();
    
    // Reset loading state after a timeout if prompt is dismissed
    setTimeout(() => {
      setIsGoogleLoading(false);
    }, 30000);
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-40 -left-20 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 md:grid md:grid-cols-2 md:gap-8">
        {/* Left Side: Logo and Title */}
        <div className="flex flex-col items-center justify-center space-y-4 text-center z-0 animate-slide-up-from-behind md:animate-slide-in-from-left-behind">
          <img src="/logoofficial.png" alt="Unknown IITians Logo" className="h-20 w-20 md:h-24 md:w-24" />
          <h2 className="text-xl md:text-2xl font-semibold text-slate-700">Student Services Portal</h2>
        </div>

        {/* Right Side: Sign In Card */}
        <div className="mt-8 md:mt-0 w-full max-w-sm z-10 animate-fade-in-fixed">
          <Card className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border-slate-200/50 mx-auto">
            <CardHeader className="text-center pt-8 pb-6">
              <CardTitle className="text-xl md:text-2xl font-bold text-slate-800">
                Sign in
              </CardTitle>
              <CardDescription className="text-sm text-slate-600 pt-2">
                Sign in with the Google account you used during batch enrollment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-4">
                <Button 
                  type="button" 
                  variant="outline"
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 text-base py-6 rounded-lg shadow-sm transition-all duration-300 flex items-center justify-center gap-2 border-gray-300" 
                  onClick={handleGoogleAuth}
                  disabled={isGoogleLoading || !isGsiLoaded}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
