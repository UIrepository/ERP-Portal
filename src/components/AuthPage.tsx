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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Background Overlay for Premium Look */}
      {/* For a true "video playing" or complex animation, you'd integrate a video element or a more advanced animation library here. */}
      {/* This example uses subtle CSS animations available from tailwindcss-animate. */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-800 via-blue-900 to-purple-900 opacity-90">
        <div className="absolute inset-0 bg-pattern-dots opacity-10 animate-fade-in"></div>
        <div className="absolute w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob top-1/4 left-1/4"></div>
        <div className="absolute w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000 top-1/2 right-1/4"></div>
        <div className="absolute w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000 bottom-1/4 left-1/3"></div>
      </div>

      <Card className="relative z-10 w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-3xl overflow-hidden animate-fade-in-up">
        <CardHeader className="text-center p-8 bg-gradient-to-r from-purple-700 to-indigo-800 text-white relative overflow-hidden">
          {/* Decorative shapes within the header for depth */}
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/15 rounded-full animate-pulse-slow"></div>
          <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-white/15 rounded-full animate-pulse-slow animation-delay-500"></div>

          <CardTitle className="flex justify-center z-10">
            <img src="/imagelogo.png" alt="Unknown IITians Logo" className="h-24 w-auto filter drop-shadow-lg" />
          </CardTitle>
          <CardDescription className="text-purple-200 text-xl font-bold tracking-wide mt-4 z-10">
            Your Gateway to Academic Excellence
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <p className="text-center text-gray-800 text-lg leading-relaxed mb-10">
            Seamlessly access your personalized learning dashboard with a single tap.
          </p>
          <div className="space-y-4">
            <Button 
              type="button" 
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-extrabold py-3.5 rounded-full text-lg shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl active:scale-95 flex items-center justify-center gap-3" 
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading && <Loader2 className="mr-3 h-6 w-6 animate-spin text-blue-200" />}
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add custom keyframes to src/index.css for 'blob' and 'fade-in' animations */}
      {/* @layer keyframes {
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      }

      @layer utilities {
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .shadow-3xl {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08);
        }
        .bg-pattern-dots {
          background-image: radial-gradient(#ffffff 1px, transparent 1px);
          background-size: 20px 20px;
        }
      }
      */}
    </div>
  );
};
