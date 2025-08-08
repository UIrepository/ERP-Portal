import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const AuthPage = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
       <div className="absolute -bottom-40 -left-20 w-80 h-80 bg-slate-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-pulse animation-delay-4000"></div>


      <div className="relative min-h-screen grid md:grid-cols-2">
        {/* Left Side: Logo and Title */}
        <div className="hidden md:flex flex-col items-center justify-center space-y-4">
          <img src="/logoofficial.png" alt="Unknown IITians Logo" className="h-28 w-28" />
          <h2 className="text-2xl font-semibold text-slate-700">Student/Admin ERP Portal</h2>
        </div>
        
        {/* Right Side: Sign In Card */}
        <div className="flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border-slate-200/50">
            <CardHeader className="text-center pt-8 pb-6">
              <CardTitle className="text-2xl font-bold text-slate-800">
                Sign in
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Button 
                  type="button" 
                  className="w-full bg-[#394c6f] hover:bg-[#31415f] text-white text-base py-6 rounded-lg shadow-md transition-all duration-300" 
                  onClick={handleGoogleAuth}
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Student Login'
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
