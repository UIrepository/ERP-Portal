// uirepository/teachgrid-hub/teachgrid-hub-d9688224fef19a4774d713506784003cfd24ff67/src/components/AuthPage.tsx
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const AuthPage = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signIn, signUp } = useAuth(); // signIn and signUp are no longer directly used but kept for AuthContext compatibility

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
    
    setIsGoogleLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 p-4">
      <Card className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">
        <CardHeader className="text-center p-6 bg-gradient-to-r from-purple-600 to-indigo-700 text-white relative overflow-hidden">
          {/* Decorative circles for premium feel */}
          <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full animate-pulse-slow"></div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>

          <CardTitle className="flex justify-center z-10">
            <img src="/imagelogo.png" alt="Unknown IITians Logo" className="h-20 w-auto filter drop-shadow-md" />
          </CardTitle>
          <CardDescription className="text-purple-100 text-lg font-semibold mt-2 z-10">
            Welcome to Unknown IITians
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-center text-gray-700 text-md leading-relaxed mb-8">
            Sign in with the Google account you enrolled with to access your personalized learning dashboard.
          </p>
          <div className="space-y-4">
            <Button 
              type="button" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg shadow-lg transition-all transform hover:scale-105 active:scale-95" 
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
