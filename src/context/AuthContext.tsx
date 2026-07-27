import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, IS_DEMO_MODE, setOnSessionExpired } from '../config/supabase';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Required once, at module load, for expo-auth-session's browser-based flow to properly
// close and hand control back to the app after Google redirects back.
WebBrowser.maybeCompleteAuthSession();

// iOS-only for now, matching where this app is actually being tested — the Android Client ID
// gets added here once Android testing is genuinely underway, not before.
const GOOGLE_IOS_CLIENT_ID = '492433051879-4mbma3a80t0tcrpi1r2domr716k185vc.apps.googleusercontent.com';

// Google's provider defaults to the Authorization Code flow on real installed apps (confirmed
// live — the first real-device test returned a `code`, not an `id_token`, exactly as this flow
// predicts). Forcing the older direct-token flow instead is explicitly unreliable in real
// builds even though it works in sandboxes, so the correct fix is completing this exchange
// properly rather than fighting the flow Google actually gave us.
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

type AuthContextType = {
  user: any;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any; cancelled?: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [request, , promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

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
    const result = await promptAsync();
    if (result.type !== 'success') {
      if (result.type === 'error') {
        return { error: result.error || { message: 'Google sign-in failed' } };
      }
      // 'cancel' / 'dismiss' / 'locked' — the user backed out of the consent screen. This is
      // neither a completed sign-in nor a real error, so it needs its own signal: returning
      // { error: null } here previously made the caller's `if (error) ... else routeAfterAuth()`
      // gate treat "backed out" identically to "signed in successfully" and navigate forward
      // with no session at all. `cancelled: true` lets the caller just stay put instead.
      return { error: null, cancelled: true };
    }
    const code = result.params?.code;
    if (!code || !request) {
      console.warn('[signInWithGoogle] Google returned success but no authorization code was found:', result);
      return { error: { message: 'Google sign-in did not return a valid code' } };
    }
    // Exchange the code for real tokens — request.codeVerifier is the PKCE proof that this
    // exchange is coming from the same app instance that started the sign-in, required since
    // this is a public mobile client with no client secret.
    let idToken: string | undefined;
    try {
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: GOOGLE_IOS_CLIENT_ID,
          code,
          redirectUri: request.redirectUri,
          extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
        },
        { tokenEndpoint: GOOGLE_TOKEN_ENDPOINT }
      );
      idToken = tokenResult.idToken;
    } catch (e: any) {
      console.warn('[signInWithGoogle] code exchange failed:', e);
      return { error: { message: e?.message || 'Could not complete Google sign-in' } };
    }
    if (!idToken) {
      console.warn('[signInWithGoogle] Token exchange succeeded but no id_token was in the response.');
      return { error: { message: 'Google sign-in did not return a valid token' } };
    }
    const { user, error } = await auth.signInWithGoogleToken(idToken);
    if (user) setUser(user);
    return { error };
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
    <AuthContext.Provider value={{ user, loading, isDemoMode: IS_DEMO_MODE, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() { return useContext(AuthContext); }
