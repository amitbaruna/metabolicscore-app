import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, IS_DEMO_MODE } from '../config/supabase';

type AuthContextType = {
  user: any;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setUser(await auth.getSession()); } catch (e) { console.warn('Session:', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { user, error } = await auth.signIn(email, password);
    if (user) setUser(user);
    return { error };
  };
  const signUp = async (email: string, password: string, name: string) => {
    const { user, error } = await auth.signUp(email, password, name);
    if (user) setUser(user);
    return { error };
  };
  const signInWithGoogle = async () => {
    // Demo Google sign-in: create a guest user
    const user = { id: 'demo-google', email: 'guest@gmail.com', user_metadata: { full_name: 'Google Guest' } };
    setUser(user);
    return { error: null };
  };
  const signOut = async () => { await auth.signOut(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, isDemoMode: IS_DEMO_MODE, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() { return useContext(AuthContext); }
