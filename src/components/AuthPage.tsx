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
  // signIn and signUp are no longer directly used but kept for AuthContext compatibility
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white">
      {/* Animated Background Overlay for Premium Look - Soothing Light with subtle animations */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-50 via-gray-100 to-white opacity-90">
        {/* Subtle pattern for texture */}
        <div className="absolute inset-0 bg-repeat bg-pattern-dots-subtle opacity-30 animate-fade-in"></div>
        
        {/* Animated blobs with lighter, desaturated colors */}
        <div className="absolute w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-2xl opacity-15 animate-blob top-1/4 left-1/4"></div>
        <div className="absolute w-64 h-64 bg-teal-50 rounded-full mix-blend-multiply filter blur-2xl opacity-15 animate-blob animation-delay-2000 top-1/2 right-1/4"></div>
        <div className="absolute w-72 h-72 bg-gray-100 rounded-full mix-blend-multiply filter blur-2xl opacity-15 animate-blob animation-delay-4000 bottom-1/4 left-1/3"></div>

        {/* Placeholder for upskilling icons - Requires custom CSS/SVG integration */}
        {/* To add moving upskilling icons, you would typically use SVG sprites and
            CSS animations or a library like react-spring/framer-motion.
            Example:
            <div className="absolute top-10 left-10 text-blue-200 opacity-20 text-4xl animate-float">📚</div>
            <div className="absolute bottom-20 right-20 text-green-200 opacity-20 text-4xl animate-float animation-delay-1500">💡</div>
            (You'd define @keyframes float in your index.css)
        */}
      </div>

      <Card className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
        <CardHeader className="text-center pt-8 px-6 pb-4 bg-white text-gray-800 relative">
          <div className="mt-6 flex justify-center mb-4">
            <img src="/logoofficial.png" alt="Unknown IITians Logo" className="h-20 w-20" />
          </div>
          <CardTitle className="text-xl font-bold text-center mb-2">
            Welcome to Unknown IITians
          </CardTitle>
          <CardDescription className="text-sm font-normal leading-relaxed px-4 text-center text-gray-700">
            Sign in with the Google account you used during course registration to access your personalized learning dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Button 
              type="button" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-2.5 rounded-lg shadow-md mt-4 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg active:scale-95 flex items-center justify-center gap-2" 
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <svg className="h-4 w-4" viewBox="0 0 24 24">
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

      {/* Add custom keyframes to src/index.css for 'blob', 'fade-in', and 'float' animations if not already present */}
      {/*
      // In src/index.css, under @layer utilities add:
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
      .bg-pattern-dots-subtle {
        background-image: radial-gradient(#d1d5db 0.5px, transparent 0.5px); /* Light grey dots */
        background-size: 20px 20px;
      }
      .animate-float {
        animation: float 3s ease-in-out infinite;
      }

      // And under @layer keyframes add:
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
      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }
      */}
    </div>
  );
};
