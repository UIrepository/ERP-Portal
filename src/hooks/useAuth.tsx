import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: () => void; // Legacy stubs
  signUp: () => void; // Legacy stubs
  signOut: () => Promise<void>;
  setGoogleUser: (user: any) => void; // New method to handle manual Google login
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [googleUser, setGoogleUserState] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        // 2. If no Supabase session, check for manually stored Google user
        const storedGoogleUser = localStorage.getItem('google_user');
        if (storedGoogleUser) {
          setGoogleUserState(JSON.parse(storedGoogleUser));
        }
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // If Supabase session exists, clear manual Google user to avoid conflicts
        setGoogleUserState(null);
        localStorage.removeItem('google_user');
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setGoogleUser = (user: any) => {
    setGoogleUserState(user);
    if (user) {
      localStorage.setItem('google_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('google_user');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setGoogleUser(null);
    window.location.href = '/auth';
  };

  // Create a mock session object if we have a googleUser but no Supabase session
  const effectiveSession = session || (googleUser ? { 
    access_token: 'google-access-token', 
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: '',
    user: { 
      id: googleUser.sub, 
      email: googleUser.email,
      user_metadata: { ...googleUser } 
    } 
  } as unknown as Session : null);

  const effectiveUser = session?.user || (googleUser ? {
    id: googleUser.sub,
    email: googleUser.email,
    user_metadata: { ...googleUser },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as unknown as User : null);

  const value = {
    session: effectiveSession,
    user: effectiveUser,
    isLoading,
    signIn: () => {},
    signUp: () => {},
    signOut,
    setGoogleUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
