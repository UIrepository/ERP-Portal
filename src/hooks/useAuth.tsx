import * as React from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

// Helper function to fetch and normalize the profile
const fetchAndNormalizeProfile = async (user: User | null): Promise<Profile | null> => {
    if (!user) return null;
    
    // Fetch user profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profileData) {
      // Normalize array-or-null fields to an empty array to prevent 'not iterable' errors
      return {
        ...profileData,
        batch: profileData.batch || [],
        exams: profileData.exams || [],
        subjects: profileData.subjects || [],
      } as Profile; // Cast to Profile type
    }
    
    return null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // 1. Setup the Auth State Change listener for *future* changes (sign in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Profile update on sign-in/event
          const normalizedProfile = await fetchAndNormalizeProfile(session.user);
          setProfile(normalizedProfile);
        } else {
          setProfile(null);
        }
        
        // This is only set to false for events *after* the initial load
        if (event !== 'INITIAL_SESSION') {
            setLoading(false);
        }
      }
    );

    // 2. Handle the initial session check on mount (The Fix)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try { // Added try block to catch potential errors during profile fetch
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          // FIX: Fetch the profile here for the initial load
          const normalizedProfile = await fetchAndNormalizeProfile(currentUser);
          setProfile(normalizedProfile);
        }
      } catch (error) {
        // Log the error but proceed to stop loading
        console.error("Error during initial session and profile fetch:", error);
        setProfile(null);
        setUser(null);
      } finally {
        // FIX: Crucial: Set loading to false in finally block to ensure it always runs.
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
