import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';

export const AuthPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setIsLoading(true);
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }

      // Exchange the Google ID Token for a Supabase Session
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credentialResponse.credential,
      });

      if (error) throw error;

      if (data.session) {
        toast({
          title: 'Success',
          description: 'Signed in successfully',
        });
        navigate('/');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sign in',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast({
      title: 'Error',
      description: 'Google login was cancelled or failed',
      variant: 'destructive',
    });
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
              <div className="flex flex-col items-center justify-center w-full min-h-[60px]">
                {/* The GoogleLogin component replaces the custom button.
                  It provides the OIDC ID Token required by Supabase to create the user record.
                */}
                <div className="w-full flex justify-center transform scale-105 transition-transform">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="outline"
                    size="large"
                    shape="rectangular"
                    width="300"
                    text="signin_with"
                    useOneTap
                  />
                </div>
                {isLoading && <p className="text-xs text-muted-foreground mt-4 animate-pulse">Verifying credentials...</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
