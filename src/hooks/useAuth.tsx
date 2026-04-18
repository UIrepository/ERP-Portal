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

  // Helper: timeout wrapper
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

  // Direct table-based role resolution as a backup if RPC fails
  const resolveRoleFromTables = async (userId: string): Promise<string | null> => {
    try {
      const [adminRes, managerRes, teacherRes] = await Promise.all([
        safeDbCall(supabase.from('admins').select('id').eq('user_id', userId).maybeSingle(), 6000),
        safeDbCall(supabase.from('managers').select('id').eq('user_id', userId).maybeSingle(), 6000),
        safeDbCall(supabase.from('teachers').select('id').eq('user_id', userId).maybeSingle(), 6000),
      ]);

      if (adminRes.data) return 'admin';
      if (managerRes.data) return 'manager';
      if (teacherRes.data) return 'teacher';
      return 'student';
    } catch {
      return null;
    }
  };

  // Resolve role via RPC with one retry, then fall back to direct table checks
  const resolveRoleAuthoritative = async (userId: string): Promise<string | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await safeDbCall(
          supabase.rpc('get_user_role_from_tables', { check_user_id: userId }),
          7000
        );
        if (!error && data) {
          return data as string;
        }
      } catch {
        // fall through to retry / fallback
      }
    }
    // RPC failed or returned NULL — directly check role tables
    return await resolveRoleFromTables(userId);
  };

  const fetchProfileAndRole = async (currentUser: User) => {
    try {
      // 1. Profile
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
        try {
          localStorage.setItem('ui_ssp_profile', JSON.stringify(profileData));
        } catch {
          // ignore
        }
      }

      // 2. Role — authoritative resolution (RPC + retry + table fallback)
      const role = await resolveRoleAuthoritative(currentUser.id);

      if (mounted.current && role) {
        setResolvedRole(role);
        try {
          localStorage.setItem('ui_ssp_role', role);
        } catch {
          // ignore
        }
      } else if (mounted.current) {
        // Could not confirm role; keep null so Index.tsx shows a spinner instead of wrong dashboard
        toast({
          title: 'Connection Issue',
          description: 'Unable to confirm your account role. Please refresh the page.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      try {
        // Hydrate cached profile (UI hint only — role is NOT trusted from cache)
        try {
          const cachedProfile = localStorage.getItem('ui_ssp_profile');
          if (cachedProfile) setProfile(JSON.parse(cachedProfile));
        } catch {
          // ignore
        }

        const { data: { session: initialSession } } = await safeDbCall(
          supabase.auth.getSession(),
          6000
        );

        if (mounted.current) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            await fetchProfileAndRole(initialSession.user);
          }
          setLoading(false);
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

      // On a fresh sign-in, invalidate cached role so a previously-miscached
      // role can't poison the new session.
      if (event === 'SIGNED_IN') {
        try {
          localStorage.removeItem('ui_ssp_role');
        } catch {
          // ignore
        }
        setResolvedRole(null);
      }

      if (newSession?.user && event !== 'INITIAL_SESSION') {
        // Defer DB calls to avoid deadlocks inside the auth callback
        setTimeout(() => {
          if (!mounted.current) return;
          fetchProfileAndRole(newSession.user!).finally(() => {
            if (mounted.current) setLoading(false);
          });
        }, 0);
      } else {
        setLoading(false);
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
    signOut,
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
