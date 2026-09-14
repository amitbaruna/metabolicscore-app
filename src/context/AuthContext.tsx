import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, IS_DEMO_MODE, setOnSessionExpired } from '../config/supabase';

type AuthContextType = {
  user: any;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  // Returns the freshly-created user alongside any error — callers that need the id/email
  // immediately (e.g. OnboardingScreen, right after signUp, before other context providers
  // have re-rendered with the new session) shouldn't rely on this hook's own `user` value,
  // which can still reflect the pre-signup state for a render or two.
  signUp: (email: string, password: string, name: string) => Promise<{ error: any; user?: any }>;
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
    return { error, user };
  };
  const signOut = async () => { await auth.signOut(); setUser(null); };

  // If sbFetch ever fails to refresh an expired session (refresh token itself expired/invalid),
  // it calls this to tear down the session the same way a manual sign-out would — the existing
  // screen router in App.tsx falls back to login on its own once `user` goes null.
  useEffect(() => {
    setOnSessionExpired(() => { signOut(); });
    return () => setOnSessionExpired(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isDemoMode: IS_DEMO_MODE, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() { return useContext(AuthContext); }
