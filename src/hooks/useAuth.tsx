import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

// Define the shape of the context data
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

  // Helper to fetch profile and role data
  const fetchProfileAndRole = async (currentUser: User) => {
    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        setProfile(profileData);
      }

      // 2. Fetch Resolved Role (using your DB function)
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role_from_tables', { check_user_id: currentUser.id });

      if (roleError) {
        console.error('Error fetching role:', roleError);
        // Fallback: try to use the role from the profile if RPC fails
        if (profileData?.role) {
          setResolvedRole(profileData.role);
        }
      } else {
        setResolvedRole(roleData as string);
      }

    } catch (error) {
      console.error('Unexpected auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRole(session.user);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Reset loading to true while we fetch new user data
        setLoading(true);
        await fetchProfileAndRole(session.user);
      } else {
        // Clear state on sign out
        setProfile(null);
        setResolvedRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  const value = {
    session,
    user,
    profile,
    resolvedRole,
    loading, // Index.tsx expects 'loading', not 'isLoading'
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
