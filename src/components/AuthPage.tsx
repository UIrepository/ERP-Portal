import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const AuthPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userRole, setUserRole] = useState<'student' | 'teacher'>('student');

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (isLogin: boolean) => {
    setIsLoading(true);
    try {
      if (isLogin) {
        // --- LOGIN ---
        const { error } = await signIn(email, password);
        if (error) throw error;
        // Navigation is handled by auth state change listener in App/Layout
      } else {
        // --- SIGN UP ---
        
        // 1. Create Auth User
        // CRITICAL FIX: Always send 'student' as metadata role to match DB Enum constraints.
        // We will handle the 'teacher' entry in the separate table.
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: fullName,
              full_name: fullName,
              role: 'student', 
            }
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          // 2. If Teacher, try to add to teachers table
          // Note: This relies on RLS allowing inserts. If this fails, the user
          // is still created as a student and can be promoted by an admin later.
          if (userRole === 'teacher') {
            const { error: teacherError } = await supabase
              .from('teachers')
              .insert({
                email: email,
                name: fullName,
                user_id: authData.user.id,
                // assigned_batches: [], // Optional: init with empty
                // assigned_subjects: [] 
              });

            if (teacherError) {
              console.error('Failed to create teacher entry:', teacherError);
              // We don't block the flow, but we warn the user
              toast({
                title: 'Account Created',
                description: 'Your account was created, but we could not automatically set you as a teacher. Please contact support.',
                variant: 'default',
              });
              setIsLoading(false);
              return;
            }
          }

          toast({
            title: 'Success',
            description: 'Please check your email to verify your account.',
          });
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-slate-500 max-w-md">Access your dashboard, classes, and community in one place.</p>
        </div>

        {/* Right Side: Auth Card */}
        <div className="mt-8 md:mt-0 w-full max-w-sm z-10 animate-fade-in-fixed">
          <Card className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border-slate-200/50 mx-auto">
            <CardHeader className="text-center pt-8 pb-2">
              <CardTitle className="text-xl font-bold text-slate-800">
                Welcome
              </CardTitle>
              <CardDescription>
                Sign in or create an account to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                {/* --- LOGIN TAB --- */}
                <TabsContent value="login" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="m@example.com" 
                        className="pl-9" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="password" 
                        type="password" 
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => handleEmailAuth(true)} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}
                  </Button>
                </TabsContent>

                {/* --- REGISTER TAB --- */}
                <TabsContent value="register" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="name" 
                        placeholder="John Doe" 
                        className="pl-9"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="reg-email" 
                        type="email" 
                        placeholder="m@example.com" 
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="reg-password" 
                        type="password" 
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label>I am a...</Label>
                    <RadioGroup 
                      defaultValue="student" 
                      value={userRole} 
                      onValueChange={(val: 'student' | 'teacher') => setUserRole(val)}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <RadioGroupItem value="student" id="student" className="peer sr-only" />
                        <Label
                          htmlFor="student"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-3 hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer text-center"
                        >
                          <span className="text-sm font-medium">Student</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="teacher" id="teacher" className="peer sr-only" />
                        <Label
                          htmlFor="teacher"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-3 hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer text-center"
                        >
                          <span className="text-sm font-medium">Teacher</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Button className="w-full" onClick={() => handleEmailAuth(false)} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Account'}
                  </Button>
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or continue with</span>
                </div>
              </div>

              <Button 
                variant="outline"
                className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-300" 
                onClick={handleGoogleAuth}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </>
                )}
              </Button>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-slate-100 p-4">
              <p className="text-xs text-center text-slate-500">
                By clicking continue, you agree to our Terms of Service and Privacy Policy.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};
