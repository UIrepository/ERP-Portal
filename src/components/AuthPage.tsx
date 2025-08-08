import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const AuthPage = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // signIn and signUp are not directly used but kept for AuthContext compatibility
  const { signIn, signUp } = useAuth(); 

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
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-40 -left-20 w-80 h-80 bg-slate-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob animation-delay-4000"></div>


      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
          {/* Left Side: Logo and Title */}
          <div className="flex flex-col items-center justify-center space-y-4 text-center animate-slide-in-from-left">
            <img src="/logoofficial.png" alt="Unknown IITians Logo" className="h-24 w-24" />
            <h2 className="text-2xl font-semibold text-slate-700">Student/Staff Services Portal</h2>
          </div>
          
          {/* Right Side: Sign In Card */}
          <div className="animate-slide-in-from-right">
            <Card className="w-full max-w-sm bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border-slate-200/50">
              <CardHeader className="text-center pt-8 pb-6">
                <CardTitle className="text-2xl font-bold text-slate-800">
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
                    disabled={isGoogleLoading}
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
    </div>
  );
};
