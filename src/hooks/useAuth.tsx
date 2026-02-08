import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  resolvedRole: string | null;
  loading: boolean;
  signIn: () => void;
  signUp: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [resolvedRole, setResolvedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Use a ref to track mounting to prevent state updates on unmounted component
  const mounted = useRef(true);

  const fetchProfileAndRole = async (currentUser: User) => {
    try {
      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (mounted.current) setProfile(profileData);

      // 2. Fetch Resolved Role
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role_from_tables', { check_user_id: currentUser.id });

      if (mounted.current) {
        if (!roleError) {
          setResolvedRole(roleData as string);
        } else if (profileData?.role) {
          // Fallback to profile role
          setResolvedRole(profileData.role);
        }
      }
    } catch (error) {
      console.error('Error in fetchProfileAndRole:', error);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted.current) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            await fetchProfileAndRole(initialSession.user);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (mounted.current) setLoading(false);
      }
    };

    initAuth();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return;

      // Avoid double-fetching if the session is the same as what we just initialized
      // But ensure we handle SIGN_OUT correctly
      
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setResolvedRole(null);
        setLoading(false);
      } else if (newSession?.user && event !== 'INITIAL_SESSION') {
        // Only trigger loading/fetch if it's a new login or distinct update
        setLoading(true);
        await fetchProfileAndRole(newSession.user);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    profile,
    resolvedRole,
    loading,
    signIn: () => {},
    signUp: () => {},
    signOut
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
