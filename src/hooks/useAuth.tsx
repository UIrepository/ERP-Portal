import * as React from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

// Extended role type that includes all 4 roles
type ExtendedRole = 'student' | 'admin' | 'manager' | 'teacher';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  resolvedRole: ExtendedRole | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [resolvedRole, setResolvedRole] = React.useState<ExtendedRole | null>(null);

  // Function to resolve role from role-specific tables (checks both user_id and email)
  const resolveUserRole = React.useCallback(async (userId: string, userEmail: string): Promise<ExtendedRole> => {
    // Check admin table first (highest privilege) - by user_id OR email
    const { data: adminData } = await supabase
      .from('admins')
      .select('id')
      .or(`user_id.eq.${userId},email.eq.${userEmail}`)
      .maybeSingle();
    
    if (adminData) return 'admin';

    // Check manager table - by user_id OR email
    const { data: managerData } = await supabase
      .from('managers')
      .select('id')
      .or(`user_id.eq.${userId},email.eq.${userEmail}`)
      .maybeSingle();
    
    if (managerData) return 'manager';

    // Check teacher table - by user_id OR email
    const { data: teacherData } = await supabase
      .from('teachers')
      .select('id')
      .or(`user_id.eq.${userId},email.eq.${userEmail}`)
      .maybeSingle();
    
    if (teacherData) return 'teacher';

    // Default to student
    return 'student';
  }, []);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch user profile and resolve role
          setTimeout(async () => {
            // Call the role sync RPC to ensure user_id is linked and roles are synced
            try {
              await supabase.rpc('check_user_role_sync');
            } catch (err) {
              console.warn('Role sync check failed:', err);
            }

            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .single();
            setProfile(profileData);
            
            // Resolve the actual role from role tables (using both user_id and email)
            const role = await resolveUserRole(session.user.id, session.user.email || '');
            setResolvedRole(role);
            
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setResolvedRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [resolveUserRole]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        resolvedRole,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
