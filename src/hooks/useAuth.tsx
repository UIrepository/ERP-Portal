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
  refreshProfile: () => Promise<void>;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [resolvedRole, setResolvedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // True when the user was signed in and then lost their session without
  // explicitly signing out (token refresh failed / revoked) — drives the
  // "Your session ended" screen instead of a silent bounce to sign-in.
  const [sessionExpired, setSessionExpired] = useState(false);
  const hadUserRef = useRef(false);
  const explicitSignOutRef = useRef(false);
  // user_id whose profile AND role are already resolved in this tab — lets the
  // hourly TOKEN_REFRESHED event skip the redundant profile + role refetch
  // (those refetches were a top per-user Supabase egress source).
  const resolvedForRef = useRef<string | null>(null);

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
          // Everything except bank_details (unused in the app and sensitive —
          // it was being pulled into every session AND cached in localStorage).
          .select('id, user_id, name, email, role, avatar_url, batch, subjects, exams, is_active, premium_access, created_at, updated_at')
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

        // Sync the Google account photo into the profile so it shows across the
        // community (a user's Google photo is only available in their own
        // session, so each user writes their own). Best-effort; only when changed.
        const googleAvatar =
          (currentUser.user_metadata?.avatar_url as string | undefined) ||
          (currentUser.user_metadata?.picture as string | undefined);
        if (googleAvatar && profileData.avatar_url !== googleAvatar) {
          supabase
            .from('profiles')
            .update({ avatar_url: googleAvatar })
            .eq('user_id', currentUser.id)
            .then(() => {}, () => {});
        }
      }

      // 2. Role — authoritative resolution (RPC + retry + table fallback)
      const role = await resolveRoleAuthoritative(currentUser.id);

      if (mounted.current && role) {
        setResolvedRole(role);
        resolvedForRef.current = currentUser.id;
        try {
          localStorage.setItem('ui_ssp_role', role);
          localStorage.setItem('ui_ssp_auth_verified', JSON.stringify({ uid: currentUser.id, at: Date.now() }));
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
            // Quota guard: within 6h of a verified fetch for THIS user, trust
            // the cached profile+role instead of re-fetching on every page
            // load (RLS still enforces the true role server-side; SIGNED_IN,
            // sign-out and refreshProfile() always do the real fetch).
            let usedCache = false;
            try {
              const stamp = JSON.parse(localStorage.getItem('ui_ssp_auth_verified') || 'null');
              const cachedProfile = JSON.parse(localStorage.getItem('ui_ssp_profile') || 'null');
              const cachedRole = localStorage.getItem('ui_ssp_role');
              if (
                stamp && cachedProfile && cachedRole &&
                stamp.uid === initialSession.user.id &&
                cachedProfile.user_id === initialSession.user.id &&
                Date.now() - stamp.at < 6 * 60 * 60 * 1000
              ) {
                setProfile(cachedProfile);
                setResolvedRole(cachedRole);
                resolvedForRef.current = initialSession.user.id;
                usedCache = true;
              }
            } catch {
              // ignore — fall through to the network fetch
            }
            if (!usedCache) {
              await fetchProfileAndRole(initialSession.user);
            }
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
      if (newSession?.user) hadUserRef.current = true;

      if (event === 'SIGNED_OUT') {
        // Lost the session without the user asking to sign out → it expired.
        if (hadUserRef.current && !explicitSignOutRef.current) setSessionExpired(true);
        hadUserRef.current = false;
        resolvedForRef.current = null;
        setProfile(null);
        setResolvedRole(null);
        try {
          localStorage.removeItem('ui_ssp_profile');
          localStorage.removeItem('ui_ssp_role');
          localStorage.removeItem('ui_ssp_auth_verified');
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
          localStorage.removeItem('ui_ssp_auth_verified');
        } catch {
          // ignore
        }
        setResolvedRole(null);
      }

      if (newSession?.user && event !== 'INITIAL_SESSION') {
        // Hourly token refreshes don't change who the user is — if this tab
        // already resolved this user's profile + role, skip the refetch.
        if (event === 'TOKEN_REFRESHED' && resolvedForRef.current === newSession.user.id) {
          setLoading(false);
          return;
        }
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
    explicitSignOutRef.current = true; // this sign-out is intentional
    await supabase.auth.signOut();
  };

  const clearSessionExpired = () => {
    setSessionExpired(false);
    explicitSignOutRef.current = false;
  };

  // Re-fetch the signed-in user's profile (e.g. after they change their name)
  // so the new value reflects everywhere without a full reload.
  const refreshProfile = async () => {
    if (user) await fetchProfileAndRole(user);
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
    refreshProfile,
    sessionExpired,
    clearSessionExpired,
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
