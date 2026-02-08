import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

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
  
  const mounted = useRef(true);

  // Helper: Wrapper to prevent DB hangs from freezing the app
  const safeDbCall = async <T,>(promise: PromiseLike<T>, timeoutMs = 10000): Promise<T> => {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('DB_TIMEOUT')), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  const fetchProfileAndRole = async (currentUser: User) => {
    let profileLoaded = false;
    let roleLoaded = false;

    try {
      // 1. Fetch Profile (with timeout)
      const { data: profileData, error: profileError } = await safeDbCall(
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle(),
        8000
      );

      if (profileError) console.error('Profile fetch error:', profileError);
      if (mounted.current && profileData) {
        setProfile(profileData);
        profileLoaded = true;
        try {
          localStorage.setItem('ui_ssp_profile', JSON.stringify(profileData));
        } catch {
          // ignore storage issues
        }
      }

      // 2. Fetch Role (with timeout)
      const { data: roleData, error: roleError } = await safeDbCall(
        supabase.rpc('get_user_role_from_tables', { check_user_id: currentUser.id }),
        8000
      );

      if (mounted.current) {
        if (!roleError && roleData) {
          setResolvedRole(roleData as string);
          roleLoaded = true;
          try {
            localStorage.setItem('ui_ssp_role', String(roleData));
          } catch {
            // ignore storage issues
          }
        } else if (profileData?.role) {
          setResolvedRole(profileData.role);
          roleLoaded = true;
          try {
            localStorage.setItem('ui_ssp_role', String(profileData.role));
          } catch {
            // ignore storage issues
          }
        }
      }
    } catch (error) {
      // Don't block UX on timeout; let the UI continue and role can hydrate later.
      if (error instanceof Error && error.message === 'DB_TIMEOUT') {
        console.warn('Profile/role fetch timed out; using cached values if available.');
        return;
      }

      console.error('Error fetching user details:', error);

      // Only show toast if we completely failed to load essential data (and it's not a timeout)
      if (!profileLoaded && !roleLoaded) {
        toast({
          title: 'Connection Issue',
          description: 'Please refresh the page to try again.',
          variant: 'destructive',
        });
      }
    }
  };

  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      try {
        // Hydrate cached values immediately to avoid long splash screen
        try {
          const cachedProfile = localStorage.getItem('ui_ssp_profile');
          if (cachedProfile) setProfile(JSON.parse(cachedProfile));
        } catch {
          // ignore
        }

        try {
          const cachedRole = localStorage.getItem('ui_ssp_role');
          if (cachedRole) setResolvedRole(cachedRole);
        } catch {
          // ignore
        }

        // Check for session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (mounted.current) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          // Don't block initial render on profile/role fetch
          setLoading(false);

          if (initialSession?.user) {
            void fetchProfileAndRole(initialSession.user);
          }
        }
      } catch (error) {
        console.error('Auth init error:', error);
        if (mounted.current) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setResolvedRole(null);
        try {
          localStorage.removeItem('ui_ssp_profile');
          localStorage.removeItem('ui_ssp_role');
        } catch {
          // ignore
        }
        setLoading(false);
        return;
      }

      // Don't block UI; refresh profile/role in background
      setLoading(false);
      if (newSession?.user && event !== 'INITIAL_SESSION') {
        setTimeout(() => {
          void fetchProfileAndRole(newSession.user!);
        }, 0);
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
