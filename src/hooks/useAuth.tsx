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
  const safeDbCall = async (promise: Promise<any>, timeoutMs = 5000) => {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('DB_TIMEOUT')), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  const fetchProfileAndRole = async (currentUser: User) => {
    try {
      console.log("Fetching profile and role...");
      
      // 1. Fetch Profile (with timeout)
      const { data: profileData, error: profileError } = await safeDbCall(
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle() 
      );

      if (profileError) console.error("Profile fetch error:", profileError);
      if (mounted.current && profileData) setProfile(profileData);

      // 2. Fetch Role (with timeout)
      const { data: roleData, error: roleError } = await safeDbCall(
        supabase.rpc('get_user_role_from_tables', { check_user_id: currentUser.id })
      );

      if (mounted.current) {
        if (!roleError && roleData) {
          console.log("Role fetched via RPC:", roleData);
          setResolvedRole(roleData as string);
        } else if (profileData?.role) {
          console.log("Role fetched via Profile fallback:", profileData.role);
          setResolvedRole(profileData.role);
        } else {
           console.warn("No role could be resolved.");
        }
      }
    } catch (error) {
      console.error('Error fetching user details (likely RLS recursion or timeout):', error);
      toast({
        title: "Connection Slow",
        description: "We couldn't load all your profile data. Some features may be limited.",
        variant: "destructive"
      });
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      try {
        // Check for session
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
        console.error("Auth init error:", error);
        if (mounted.current) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return;
      
      console.log("Auth change:", event);
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setResolvedRole(null);
        setLoading(false);
      } else if (newSession?.user && event !== 'INITIAL_SESSION') {
        // Only reload data if it's a new sign-in or distinct event
        // We set loading true to ensure we don't render dashboard with stale data
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
