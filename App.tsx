// ============================================================
// METABOLIC SCORE™ — React Native (Expo SDK 54) Mobile App
// by Amit Baruna
// Single-file App with all 17 screens as components.
// ============================================================

import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, type ReactNode } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, TextInput,
  Switch, Animated, Easing, StyleSheet, Dimensions, Linking, Platform,
  FlatList, Image, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Keyboard, Share, PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Asset } from 'expo-asset';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop as SvgStop } from 'react-native-svg';
import { booking, membership, referral, account, pushNotifications, auth, profiles } from './src/config/supabase';
// Guarded — expo-notifications behaves inconsistently in Expo Go, especially for remote push
// token registration on iOS, which really needs a real build. Same safe-load pattern as the
// other native-adjacent modules this session.
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('[App] expo-notifications not available in this environment.');
}
// react-native-razorpay intentionally removed — all payment now happens entirely outside the
// app (WhatsApp/email → Razorpay link → confirmed by the deployed Worker's webhook). This
// removes the last native-dependency risk from the payment flow, and means the app no longer
// needs the EAS build just to test booking end-to-end.

// Infrastructure
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppDataProvider, useAppData, type ScoreHistoryEntry } from './src/context/AppDataContext';
import { THEMES, type Theme, type ThemeColors } from './src/config/theme';

// Data
import {
  BRAND, ABOUT_STATS, LAYERS, QUESTIONS, ADAPTIVE_BANK, CONDITIONS_FEMALE, CONDITIONS_MALE,
  CYCLES_BY_AGE, CASE_STUDIES, CASE_LAYER_MAP,
  DAILY_ACTIONS, STREAK, NEXT_ASSESSMENT_DAYS, INSIGHTS, TRANSFORMATIONS, VIDEOS, type Insight,
  CRAVING_TYPES, CRAVING_TIMING, CRAVING_CONTEXTS, CRAVING_MAPPINGS, computeCravingMapping,
  SYMPTOMS, SYMPTOM_SEVERITY, SYMPTOM_TIMELINES, GOAL_PRESETS, FAT_DEPOSITION_OPTIONS,
  TRIAGE_EXCLUDED_SYMPTOMS, computeSymptomMapping, SYMPTOM_MAPPINGS, MENTAL_HEALTH_SYMPTOMS,
  HOME_SECTIONS, DEFAULT_HOME_SECTIONS, LAYER_CONTENT, DISCLAIMER,
  USER_SYMPTOMS, USER_GOAL, USER_FAT_DEPOSITION, ASSESSMENT_COUNT,
  DEMO_SCORES, type DemoScore,
  MINI_QUIZ, getPersonalizedSigns, getPersonalizedPractices,
} from './src/data/appData';

import {
  generateLocalN1, generateLocalN2, generateLocalN3,
  generateWeeklyBrief, shouldUseClaudeFallback,
  generateDominoEffect, rankCascadeStrings, LAYER_PLAIN, LAYER_PLAIN_SHORT,
} from './src/data/localNarratives';

import {
  ANS_SCORES, ANSWER_BADGES, LMAP, getBand, convertScore, stressSliderConvert,
  computeHiddenLayer, calcRCS, getRCSInfo, computePatternEngine, pickDominantLayer,
  buildCascadeRisk, computeAdaptiveConfidence, calcAdaptiveQCount, calculateScore,
  fetchNarrative, buildReadinessBriefPayload, buildMainNarrativePayload, buildWhereToBeginPayload,
  type HistoryEntry, type ScoreResult,
} from './src/data/metabolicEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// TYPES
// ============================================================

type ScreenId =
  | 'splash' | 'login' | 'compliance' | 'onboarding'
  | 'home' | 'score' | 'results' | 'layers' | 'layer-detail'
  | 'library' | 'cases' | 'transformations' | 'cravings' | 'weekly-cravings'
  | 'article-reader' | 'about' | 'specialisation'
  | 'symptom-tracker'
  | 'profile' | 'customize' | 'booking' | 'report' | 'health-connect' | 'score-history';

type UserData = {
  gender: string;
  age: string;
  conditions: string[];
  sleepScore: number;
  stressScore: number;
  gutScore: number;
  timeSpentSeconds?: number;
};

// ============================================================
// THEME CONTEXT
// ============================================================

type ThemeCtx = { theme: Theme; colors: ThemeColors; toggleTheme: () => void };
const ThemeContext = createContext<ThemeCtx>({} as ThemeCtx);
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    AsyncStorage.getItem('ms_theme').then(saved => {
      if (saved === 'dark' || saved === 'light' || saved === 'midnight') setTheme(saved);
    }).catch(() => {});
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'midnight' : 'dark';
    setTheme(next);
    AsyncStorage.setItem('ms_theme', next).catch(() => {});
  };

  const colors = THEMES[theme];
  return <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>{children}</ThemeContext.Provider>;
}
function useTheme() { return useContext(ThemeContext); }

// ============================================================
// CLINICAL DEPTH CONTEXT
// ============================================================
// Off by default for everyone. When off, results/scores/layers show plain-language framing
// with numbers a tap away, not upfront — built after direct feedback that the app felt heavy
// even to a doctor. When on, every one of the six affected surfaces shows official layer names
// and exact scores by default instead. One switch, applies everywhere, remembered.

type ClinicalDepthCtx = { clinicalDepth: boolean; toggleClinicalDepth: () => void };
const ClinicalDepthContext = createContext<ClinicalDepthCtx>({} as ClinicalDepthCtx);
function ClinicalDepthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';
  const [clinicalDepth, setClinicalDepth] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`ms_clinical_depth_${userId}`).then(saved => {
      setClinicalDepth(saved === 'true');
    }).catch(() => {});
  }, [userId]);

  const toggleClinicalDepth = () => {
    const next = !clinicalDepth;
    setClinicalDepth(next);
    AsyncStorage.setItem(`ms_clinical_depth_${userId}`, next ? 'true' : 'false').catch(() => {});
  };

  return <ClinicalDepthContext.Provider value={{ clinicalDepth, toggleClinicalDepth }}>{children}</ClinicalDepthContext.Provider>;
}
function useClinicalDepth() { return useContext(ClinicalDepthContext); }

// ============================================================
// ICON HELPERS
// ============================================================

// Map LAYERS[].icon strings to Ionicons names
const LAYER_ICON_NAME: Record<string, keyof typeof Ionicons.glyphMap> = {
  moon: 'moon',
  zap: 'flash',
  link: 'link',
  user: 'person',
};

function getEngagementGrade(seconds: number): 'A' | 'B' | 'C' | 'D' {
  if (seconds < 60) return 'D';
  if (seconds < 120) return 'C';
  if (seconds < 180) return 'B';
  return 'A';
}

// Consecutive daily-action completions ending at today (or yesterday, if today's not done yet —
// the streak stays "alive" for one day before resetting, standard habit-tracker behavior).
function computeStreak(doneDates: string[]): number {
  if (doneDates.length === 0) return 0;
  const doneSet = new Set(doneDates);
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let cursor: Date | null = doneSet.has(todayStr) ? new Date() : doneSet.has(yesterdayStr) ? new Date(Date.now() - 86400000) : null;
  if (!cursor) return 0;
  let count = 0;
  while (doneSet.has(cursor.toISOString().slice(0, 10))) {
    count++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return count;
}

function fmtSlotTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function LayerIcon({ name, size, color }: { name: string; size: number; color: string }) {
  if (name === 'brain') return <FontAwesome5 name="brain" size={size} color={color} solid />;
  if (name === 'gutbrain') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialCommunityIcons name="stomach" size={size * 0.72} color={color} />
        <FontAwesome5 name="brain" size={size * 0.62} color={color} solid style={{ marginLeft: -size * 0.14 }} />
      </View>
    );
  }
  const ionName = LAYER_ICON_NAME[name] || 'flash';
  return <Ionicons name={ionName} size={size} color={color} />;
}

function ToggleSwitch({ isOn, onToggle, colors }: { isOn: boolean; onToggle: () => void; colors: any }) {
  const anim = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: isOn ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [isOn]);
  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [`${colors.textTertiary}40`, colors.red] });
  const knobTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={{ width: 44, height: 24 }}>
      <Animated.View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: trackColor, justifyContent: 'center' }}>
        <Animated.View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', transform: [{ translateX: knobTranslate }] }} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function getResistanceColor(compPct: number): string {
  if (compPct <= 20) return '#22C55E';
  if (compPct <= 40) return '#F59E0B';
  if (compPct <= 60) return '#FF6B6B';
  return '#EF4444';
}

function getResistanceTier(compPct: number): string {
  if (compPct <= 20) return 'low';
  if (compPct <= 40) return 'mild';
  if (compPct <= 60) return 'moderate';
  return 'high';
}

// ============================================================
// SHARED UI
// ============================================================

function ScreenShell({ children, bg }: { children: ReactNode; bg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

function ScrollScreen({ children, bg, bottomPad = 100 }: { children: ReactNode; bg: string; bottomPad?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Colored "G" Google icon as a fallback (real SVG needs react-native-svg).
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.6, fontWeight: '900', color: '#4285F4' }}>G</Text>
    </View>
  );
}

// ============================================================
// SPLASH SCREEN
// ============================================================

function SplashScreen() {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ScreenShell bg={colors.bg}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
          <View style={{
            width: 96, height: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(212, 43, 43, 0.12)',
            shadowColor: '#D42B2B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 30, elevation: 8,
          }}>
            <Ionicons name="flash" size={42} color="#D42B2B" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginTop: 32, letterSpacing: -0.5 }}>METABOLIC SCORE</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>{BRAND.tagline}</Text>
        </Animated.View>
      </View>
      <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>{BRAND.fullName}</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{BRAND.title}</Text>
      </View>
    </ScreenShell>
  );
}

// ============================================================
// LOGIN SCREEN
// ============================================================

function LoginScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const { signIn, signInWithGoogle, isDemoMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Shared by both sign-in paths — previously both routed to 'onboarding' unconditionally,
  // meaning a returning user who lost their session (logged out, expired token) would be
  // re-asked their name, age, gender, and medical conditions on every single login, not just
  // the first one. Checks the actual onboarded flag instead of assuming.
  const routeAfterAuth = async () => {
    try {
      const session = await auth.getSession();
      const rows = session?.id ? await profiles.get(session.id) : null;
      const alreadyOnboarded = Array.isArray(rows) && rows[0]?.onboarded === true;
      onNavigate(alreadyOnboarded ? 'home' : 'onboarding');
    } catch (e) {
      console.warn('[LoginScreen] onboarded-status check failed, defaulting to onboarding:', e);
      onNavigate('onboarding'); // safe fallback — worst case, someone re-confirms details once
    }
  };

  const handleSignIn = async () => {
    setLoading(true); setError('');
    const { error } = await signIn(email || 'guest@example.com', password || 'password');
    setLoading(false);
    if (error) setError(error.message || 'Sign in failed');
    else await routeAfterAuth();
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    const { error, cancelled } = await signInWithGoogle();
    setLoading(false);
    if (cancelled) return; // user backed out of the consent screen — stay on login, no error to show
    if (error) setError(error.message || 'Google sign in failed');
    else await routeAfterAuth();
  };

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 24, paddingTop: 60 }}>
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#D42B2B', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flash" size={24} color="#fff" />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 24 }}>Welcome back</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>Sign in to continue your journey</Text>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 40 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1 }}>EMAIL</Text>
        <View style={{ marginTop: 8, position: 'relative' }}>
          <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name="mail" size={16} color={colors.textSecondary} />
          </View>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingLeft: 44, paddingRight: 16, paddingVertical: 14, color: colors.text, fontSize: 14 }}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1 }}>PASSWORD</Text>
        <View style={{ marginTop: 8, position: 'relative' }}>
          <View style={{ position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
          </View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={!showPassword}
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingLeft: 44, paddingRight: 48, paddingVertical: 14, color: colors.text, fontSize: 14 }}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <Text style={{ paddingHorizontal: 24, marginTop: 12, fontSize: 12, color: colors.red }}>{error}</Text>
      ) : null}

      <View style={{ paddingHorizontal: 24, marginTop: 12, alignItems: 'flex-end' }}>
        <TouchableOpacity><Text style={{ fontSize: 12, color: colors.red }}>Forgot password?</Text></TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <TouchableOpacity onPress={handleSignIn} disabled={loading} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center', opacity: loading ? 0.6 : 1 }}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Sign In</Text>}
        </TouchableOpacity>
      </View>

      {/* Google sign-in — real OAuth now exists (expo-auth-session, wired to handleGoogle
          above), so the button that was deliberately removed while it was still a fake stub
          goes back in here. */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
        <TouchableOpacity onPress={handleGoogle} disabled={loading} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 13, borderRadius: 12, opacity: loading ? 0.6 : 1 }}>
          <Ionicons name="logo-google" size={16} color={colors.text} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Continue with Google</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <View style={{ backgroundColor: colors.cardAlt, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Ionicons name="information-circle" size={16} color={colors.amber} />
          <Text style={{ flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            {isDemoMode ? 'Demo mode active. Use any email/password to sign in.' : 'Enter your credentials. New here? Just tap Sign In to continue.'}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 24, alignItems: 'center' }}>
        <TouchableOpacity onPress={() => onNavigate('onboarding')}>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>Don't have an account? <Text style={{ color: colors.red, fontWeight: '700' }}>Sign up</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollScreen>
  );
}

// ============================================================
// COMPLIANCE SCREEN (DPDP 2023 consent)
// ============================================================

function ComplianceScreen({ onNavigate, fromProfile }: { onNavigate: (s: ScreenId) => void; fromProfile?: boolean }) {
  const { colors } = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [showPolicy, setShowPolicy] = useState<'privacy' | 'terms' | null>(null);
  const [deleteStep, setDeleteStep] = useState<'closed' | 'confirm' | 'deleting' | 'done' | 'error'>('closed');
  const [deleteErrors, setDeleteErrors] = useState<string[]>([]);

  const handleDeleteAccount = async () => {
    setDeleteStep('deleting');
    try {
      const result = await account.deleteMyData();
      if (result.ok) {
        setDeleteStep('done');
      } else {
        setDeleteErrors(result.errors);
        setDeleteStep('error');
      }
    } catch (e) {
      setDeleteErrors([String(e)]);
      setDeleteStep('error');
    }
  };

  const handleContinue = async () => {
    if (fromProfile) { onNavigate('profile'); return; }
    if (!agreed) return;
    try {
      await AsyncStorage.setItem('ms_dpdp_accepted', new Date().toISOString());
      await AsyncStorage.setItem('ms_dpdp_version', '2023.1');
    } catch (e) { /* ignore */ }
    onNavigate('login');
  };

  if (fromProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => onNavigate('profile')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-back" size={20} color={colors.textSecondary} /></TouchableOpacity>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Privacy & Consent</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(34,197,94,0.40)' }}><Ionicons name="shield-checkmark" size={32} color="#22C55E" /></View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 20, textAlign: 'center' }}>Your Data Is Secure</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 }}>You've already consented to our data practices. Here's how we keep your health information protected every time you use the app.</Text>
            </View>
            <View style={{ paddingHorizontal: 24, marginTop: 32, gap: 12 }}>
              {[
                { icon: 'lock-closed', title: 'Encrypted Storage', desc: 'AES-256 at rest, TLS 1.3 in transit. Supabase Row-Level Security.' },
                { icon: 'ban', title: 'No Third-Party Sharing', desc: 'We never sell, rent, or share your personal data.' },
              ].map((item, i) => (
                <View key={i} style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.card }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.10)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={item.icon as any} size={20} color="#22C55E" /></View>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.title}</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 }}>{item.desc}</Text></View>
                </View>
              ))}
              <TouchableOpacity onPress={() => setDeleteStep('confirm')} style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.card }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.14)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="trash" size={20} color={colors.red} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Right to Deletion</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 }}>Delete all your logged data immediately — scores, cravings, symptoms, bookings, everything. Tap to start.</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginTop: 12 }} />
              </TouchableOpacity>
              <View style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.card }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.10)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="document-text" size={20} color="#22C55E" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Read the Full Policies</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => setShowPolicy('privacy')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.bg }}><Text style={{ fontSize: 11, fontWeight: '700', color: colors.red }}>Privacy Policy →</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowPolicy('terms')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.bg }}><Text style={{ fontSize: 11, fontWeight: '700', color: colors.red }}>Terms of Service →</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
            <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
              <TouchableOpacity onPress={() => onNavigate('profile')} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Back to Profile</Text></TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 24, marginTop: 20, alignItems: 'center' }}><Text style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center' }}>Compliant with the Digital Personal Data Protection Act, 2023 (India)</Text></View>
          </ScrollView>
          <Modal visible={showPolicy !== null} transparent animationType="slide">
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{showPolicy === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</Text>
                  <TouchableOpacity onPress={() => setShowPolicy(null)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={16} color={colors.textSecondary} /></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}><Text style={{ fontSize: 12, lineHeight: 19, color: colors.textSecondary }}>{showPolicy === 'privacy' ? 'This Privacy Policy describes how Metabolic Score™ collects, uses, stores, and protects your personal and health data. Data is stored on Supabase with RLS, encrypted in transit (TLS 1.3) and at rest (AES-256). We do NOT sell or share your data. Under DPDP 2023, you have the right to access, correct, delete, or withdraw consent.' : 'These Terms govern your use of the Metabolic Score™ app. The app is a clinical symptom pattern tool — NOT a medical diagnostic. Amit Baruna is a Metabolic Health Coach, not a licensed physician. All content is the intellectual property of Amit Baruna.'}</Text></ScrollView>
                <TouchableOpacity onPress={() => setShowPolicy(null)} style={{ marginTop: 16, backgroundColor: colors.red, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Close</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>
          <Modal visible={deleteStep !== 'closed'} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <View style={{ backgroundColor: colors.bg, borderRadius: 20, padding: 24, width: '100%' }}>
                {deleteStep === 'confirm' && (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Delete all your data?</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 20 }}>
                      This immediately and permanently deletes your scores, cravings, symptoms, bookings, membership, and profile. This cannot be undone.{'\n\n'}
                      Your login itself will be fully removed by our team shortly after — this final step isn't yet automated, but everything else happens now, not in 30 days.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity onPress={() => setDeleteStep('closed')} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity onPress={handleDeleteAccount} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Delete Everything</Text></TouchableOpacity>
                    </View>
                  </>
                )}
                {deleteStep === 'deleting' && (
                  <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                    <ActivityIndicator color={colors.red} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 12 }}>Deleting your data…</Text>
                  </View>
                )}
                {deleteStep === 'done' && (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Your data has been deleted</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 20 }}>You're being signed out now. If you'd like your login credentials removed too, email Help@amitbaruna.com and reference this deletion.</Text>
                    <TouchableOpacity onPress={() => onNavigate('login')} style={{ paddingVertical: 12, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Done</Text></TouchableOpacity>
                  </>
                )}
                {deleteStep === 'error' && (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Something didn't complete</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 8 }}>Most of your data may have been deleted, but not all of it. Email Help@amitbaruna.com so we can finish this manually.</Text>
                    {deleteErrors.slice(0, 3).map((e, i) => (<Text key={i} style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 4 }}>{e}</Text>))}
                    <TouchableOpacity onPress={() => setDeleteStep('closed')} style={{ marginTop: 12, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center' }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Close</Text></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: `${colors.red}40` }}><Ionicons name="shield-checkmark" size={32} color={colors.red} /></View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 20, textAlign: 'center' }}>Your Data, Your Control</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 }}>We collect health data to provide personalized metabolic insights. Your data is stored securely and never shared without your consent.</Text>
          </View>
          <View style={{ paddingHorizontal: 24, marginTop: 32, gap: 12 }}>
            {[
              { icon: 'lock-closed', title: 'Encrypted Storage', desc: 'Your health data is encrypted at rest and in transit.' },
              { icon: 'ban', title: 'No Third-Party Sharing', desc: 'We never sell or share your data with third parties.' },
              { icon: 'trash', title: 'Right to Deletion', desc: 'Delete all your data anytime from Profile → Privacy & Consent — takes effect immediately.' },
            ].map((item, i) => (
              <View key={i} style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.card }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={item.icon as any} size={20} color={colors.red} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.title}</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 }}>{item.desc}</Text></View>
              </View>
            ))}
          </View>
          <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
            <TouchableOpacity onPress={() => setAgreed(!agreed)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: agreed ? colors.red : colors.borderStrong, backgroundColor: agreed ? colors.red : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{agreed && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>I have read and agree to the <Text onPress={() => setShowPolicy('privacy')} style={{ color: colors.red, fontWeight: '700' }}>Privacy Policy</Text> and <Text onPress={() => setShowPolicy('terms')} style={{ color: colors.red, fontWeight: '700' }}>Terms of Service</Text>.</Text></View>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
            <TouchableOpacity onPress={handleContinue} disabled={!agreed} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center', opacity: agreed ? 1 : 0.4 }}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Continue</Text></TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 24, marginTop: 20, alignItems: 'center' }}><Text style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center' }}>Compliant with the Digital Personal Data Protection Act, 2023 (India)</Text></View>
        </ScrollView>
        <Modal visible={showPolicy !== null} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{showPolicy === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</Text>
                <TouchableOpacity onPress={() => setShowPolicy(null)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={16} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}><Text style={{ fontSize: 12, lineHeight: 19, color: colors.textSecondary }}>{showPolicy === 'privacy' ? 'This Privacy Policy describes how Metabolic Score™ collects, uses, stores, and protects your personal and health data. Data is stored on Supabase with RLS, encrypted in transit (TLS 1.3) and at rest (AES-256). We do NOT sell or share your data. Under DPDP 2023, you have the right to access, correct, delete, or withdraw consent.' : 'These Terms govern your use of the Metabolic Score™ app. The app is a clinical symptom pattern tool — NOT a medical diagnostic. Amit Baruna is a Metabolic Health Coach, not a licensed physician. All content is the intellectual property of Amit Baruna.'}</Text></ScrollView>
              <TouchableOpacity onPress={() => setShowPolicy(null)} style={{ marginTop: 16, backgroundColor: colors.red, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// ONBOARDING SCREEN
// ============================================================

function OnboardingScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const { saveProfile: saveProfileCtx, baseline: ctxBaseline, setBaseline: ctxSetBaseline, setConditions: ctxSetConditions } = useAppData();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');

  const conditionList = gender === 'Male' ? CONDITIONS_MALE : CONDITIONS_FEMALE;

  const toggleCondition = (c: string) => {
    if (c === 'No known condition' || c === 'Prefer not to say') { setConditions([c]); return; }
    const filtered = conditions.filter(x => x !== 'No known condition' && x !== 'Prefer not to say');
    setConditions(filtered.includes(c) ? filtered.filter(x => x !== c) : [...filtered, c]);
  };

  const handleComplete = async () => {
    console.log('[Onboarding] handleComplete starting, saving profile:', { full_name: name || 'Friend', gender, conditions, onboarded: true });
    try {
      await saveProfileCtx({ full_name: name || 'Friend', gender, conditions, onboarded: true });
      console.log('[Onboarding] saveProfileCtx call completed without throwing');
      if (age) await ctxSetBaseline({ ...ctxBaseline, age });
      if (conditions.length) await ctxSetConditions(conditions);
      if (referralCodeInput.trim()) await referral.recordSignup(referralCodeInput.trim());
      console.log('[Onboarding] handleComplete finished all steps successfully');
    } catch (e) { console.warn('[Onboarding] handleComplete FAILED:', e); }
    onNavigate('home');
  };

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 24, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Step {step + 1} of 4</Text>
        {step > 0 ? (
          <TouchableOpacity onPress={() => setStep(step - 1)}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.red }}>Back</Text></TouchableOpacity>
        ) : <View />}
      </View>
      <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
        <View style={{ height: 4, backgroundColor: colors.card, borderRadius: 2, overflow: 'hidden' }}>
          <Animated.View style={{ height: 4, backgroundColor: colors.red, width: `${((step + 1) / 4) * 100}%` }} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 40 }}>
        {step === 0 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>What should I call you?</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>Let's personalize your experience.</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              style={{ marginTop: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, color: colors.text, fontSize: 16 }}
            />
          </>
        )}
        {step === 1 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>What's your age?</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>Age affects metabolic baseline and recovery.</Text>
            <View style={{ marginTop: 24, backgroundColor: colors.card, borderRadius: 20, paddingVertical: 40, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <TextInput
                value={age}
                onChangeText={setAge}
                placeholder="32"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={3}
                style={{ fontSize: 48, fontWeight: '900', color: colors.text, textAlign: 'center', minWidth: 120, padding: 0 }}
              />
              <Text style={{ fontSize: 18, color: colors.textSecondary, marginLeft: 8 }}>years</Text>
            </View>
          </>
        )}
        {step === 2 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>What's your gender?</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>Hormonal differences influence how your metabolism responds.</Text>
            <View style={{ marginTop: 24, gap: 8 }}>
              {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(g => (
                <TouchableOpacity key={g} onPress={() => setGender(g)} style={{
                  paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
                  backgroundColor: gender === g ? colors.redLight : colors.card,
                  borderWidth: 1.5, borderColor: gender === g ? colors.red : colors.border,
                }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: gender === g ? colors.red : colors.textSecondary }}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {step === 3 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Any medical conditions?</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>Optional — helps with more precise diagnostics. You can update later.</Text>
            <View style={{ marginTop: 24, gap: 8 }}>
              {conditionList.map(c => {
                const sel = conditions.includes(c);
                return (
                  <TouchableOpacity key={c} onPress={() => toggleCondition(c)} style={{
                    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12,
                    backgroundColor: sel ? colors.redLight : colors.card,
                    borderWidth: 1.5, borderColor: sel ? colors.red : colors.border,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}>
                    {sel && <Ionicons name="checkmark" size={14} color={colors.red} />}
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: sel ? colors.red : colors.textSecondary }}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Not listed?</Text>
                <TextInput
                  value={customCondition}
                  onChangeText={setCustomCondition}
                  placeholder="Type your condition"
                  placeholderTextColor={colors.textTertiary}
                  onSubmitEditing={() => {
                    const trimmed = customCondition.trim();
                    if (trimmed && !conditions.includes(trimmed)) {
                      const filtered = conditions.filter(x => x !== 'No known condition' && x !== 'Prefer not to say');
                      setConditions([...filtered, trimmed]);
                      setCustomCondition('');
                    }
                  }}
                  style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, color: colors.text, fontSize: 13 }}
                />
                {conditions.filter(c => !conditionList.includes(c)).map(c => (
                  <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.redLight, borderWidth: 1.5, borderColor: colors.red }}>
                    <Ionicons name="checkmark" size={14} color={colors.red} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.red }}>{c}</Text>
                    <TouchableOpacity onPress={() => setConditions(conditions.filter(x => x !== c))}><Ionicons name="close" size={16} color={colors.red} /></TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Got a referral code? (optional)</Text>
              <TextInput
                value={referralCodeInput}
                onChangeText={setReferralCodeInput}
                placeholder="Enter code"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, color: colors.text, fontSize: 14 }}
              />
            </View>
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 40 }}>
        <TouchableOpacity onPress={() => {
          if (step === 0 && !name.trim()) { Alert.alert('Almost there', 'Please enter your name to continue.'); return; }
          if (step === 1 && !age.trim()) { Alert.alert('Almost there', 'Please enter your age to continue.'); return; }
          if (step === 2 && !gender) { Alert.alert('Almost there', 'Please select an option to continue.'); return; }
          if (step === 3 && conditions.length === 0) { Alert.alert('Almost there', 'Please make a selection — choose "No known condition" if none apply.'); return; }
          step < 3 ? setStep(step + 1) : handleComplete();
        }} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>{step === 3 ? 'Complete' : 'Continue'}</Text>
        </TouchableOpacity>
        {step === 3 && (
          <TouchableOpacity onPress={() => onNavigate('home')} style={{ marginTop: 12, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollScreen>
  );
}

// ============================================================
// CASCADE VISUALIZATION — "The Metabolic Story"
// ============================================================

const CASCADE_ACTIONS: Record<number, { action: string; outcome: string }> = {
  1: { action: 'Get 10 minutes of direct sunlight within 30 minutes of waking', outcome: 'may reset your cortisol curve and start stabilizing every downstream layer that depends on your circadian rhythm' },
  2: { action: 'Do 5 minutes of box breathing daily (inhale 4, hold 4, exhale 4, hold 4)', outcome: 'may lower cortisol and shift your nervous system out of fight-or-flight, which could reduce strain on multiple downstream systems' },
  3: { action: 'Take a 20-minute walk after your largest meal', outcome: 'may lower your post-meal glucose spike and reduce the insulin resistance that could be driving the cascade' },
  4: { action: 'Eat one meal today without screens — chew slowly and pay attention to each bite', outcome: 'may reduce gut inflammation and improve the vagus nerve signaling that connects your gut to your brain' },
  5: { action: 'Write and read aloud a daily identity statement that affirms your capacity to change', outcome: 'may begin rewiring the self-image patterns that could be reinforcing physiological stress' },
};

// Real-signal-only quote for a layer — mirrors getLayerSignal's proven pattern (same history
// lookup, same QUESTIONS mapping), but only considers answers where ansIdx >= 2 (option 3+,
// the "real signal" tier — never a green/thriving answer). Returns null if the layer has no
// real-signal answer, which is a legitimate, expected outcome, not an error.
function getCascadeSignalQuote(scoreResult: any, layerId: number): string | null {
  if (!scoreResult?.history) return null;
  const realSignalEntries = scoreResult.history.filter((h: any) => h.layer === layerId && h.ansIdx >= 2);
  if (realSignalEntries.length === 0) return null;
  const strongest = realSignalEntries.sort((a: any, b: any) => b.ansIdx - a.ansIdx)[0]; // highest ansIdx = strongest signal
  if (!strongest?.selected?.length) return null;
  const q = QUESTIONS.find(qx => qx.layer === layerId && qx.id === strongest.q);
  return q?.o[strongest.selected[0]]?.replace(/[,.]$/, '') || null;
}

// Rebuilds a CascadeVisualization-compatible object from a persisted scoreHistory entry, for
// accounts signed in without a fresh in-session scoreResult. Returns null when the entry
// predates the cascade_risk/dominant_layer persistence fix (2026-07-30) — those rows have
// neither field, so there's nothing to reconstruct; callers should fall back to the
// lightweight summary card instead.
function reconstructScoreResultFromHistory(entry: ScoreHistoryEntry): Partial<ScoreResult> | null {
  if (entry.cascade_risk == null || entry.dominant_layer == null) return null;
  return {
    totalScore: entry.total_score,
    band: getBand(entry.total_score),
    cascadeRisk: entry.cascade_risk,
    dominantLayer: entry.dominant_layer,
    sc: { 1: entry.layer1, 2: entry.layer2, 3: entry.layer3, 4: entry.layer4, 5: entry.layer5 },
    rcsInfo: getRCSInfo(entry.rcs ?? 0),
    history: entry.answers || [],
    patternEngine: { dominant_pattern: entry.dominant_pattern || '' } as ScoreResult['patternEngine'],
  };
}

type ParsedCascade = { raw: string; layers: number[] };
type CascadeVisualItem = ParsedCascade & {
  narrative: string;
  action: string;
  actionOutcome: string;
  rootLayer: number;
};

function parseCascadeLayers(raw: string): number[] {
  const matches = raw.match(/L(\d)/g) || [];
  return [...new Set(matches.map(m => parseInt(m.slice(1))))].sort((a, b) => a - b);
}

function parseAllCascades(cascadeRisk: string): ParsedCascade[] {
  if (!cascadeRisk || cascadeRisk.includes('No immediate cascade')) return [];
  return cascadeRisk.split('|').map(s => s.trim()).filter(Boolean).map(raw => ({ raw, layers: parseCascadeLayers(raw) }));
}

const NODE_LAYOUT: Record<number, { fx: number; fy: number }> = {
  1: { fx: 0.50, fy: 0.10 },
  2: { fx: 0.82, fy: 0.38 },
  3: { fx: 0.65, fy: 0.86 },
  4: { fx: 0.25, fy: 0.78 },
  5: { fx: 0.12, fy: 0.32 },
};

const CASCADE_H = 320;
const NODE_R = 28;
const LINE_DASH = 1000;
const AnimatedSvgPath = Animated.createAnimatedComponent(Path);

function CascadeVisualization({
  scoreResult,
  defaultCascadeIdx = 0,
  colors,
  onNavigate,
  onWorkOnThis,
  alwaysShowIcon = false,
}: {
  scoreResult: any;
  defaultCascadeIdx?: number;
  colors: ThemeColors;
  onNavigate?: (s: ScreenId) => void;
  onWorkOnThis?: () => void;
  alwaysShowIcon?: boolean;
}) {
  const containerW = SCREEN_WIDTH - 48;
  const { clinicalDepth } = useClinicalDepth();

  const allCascades: CascadeVisualItem[] = useMemo(() => {
    const dominantLayer = scoreResult?.dominantLayer || 1;
    // Same ranking generateDominoEffect uses internally — computing it here too, once, means
    // idx below always refers to the same cascade in both places. Previously this used raw
    // parse order while generateDominoEffect silently re-ranked internally, which could attach
    // the wrong narrative to the wrong cascade.
    const rankedRaw = rankCascadeStrings(scoreResult?.cascadeRisk || '', dominantLayer);
    if (rankedRaw.length === 0) return [];
    return rankedRaw.map((raw, idx) => {
      const layers = parseCascadeLayers(raw);
      const domino = generateDominoEffect(scoreResult, idx);
      const rootLayer = layers[0] || 1;
      // Reuse the action text generateDominoEffect already computed on this same line — do NOT
      // maintain a second copy (CASCADE_ACTIONS, below) as the source of truth. That list is kept
      // only as a fallback for the rare case generateDominoEffect returns nothing for this cascade.
      const fallback = CASCADE_ACTIONS[rootLayer] || CASCADE_ACTIONS[2];
      let narrative = domino?.userLanguage || '';
      // Weave in the root layer's real-signal quote (option 3+ only, never a green answer) partway
      // through the explanation, right after the opening sentence. If this layer has no real-signal
      // answer, narrative is left exactly as generateDominoEffect produced it — no quote is forced in.
      const signalQuote = getCascadeSignalQuote(scoreResult, rootLayer);
      if (signalQuote && narrative) {
        const firstBreak = narrative.indexOf('. ');
        const quoteSentence = `You mentioned: "${signalQuote}." `;
        narrative = firstBreak !== -1
          ? narrative.slice(0, firstBreak + 2) + quoteSentence + narrative.slice(firstBreak + 2)
          : quoteSentence + narrative;
      }
      return { raw, layers, narrative, action: domino?.action || fallback.action, actionOutcome: domino?.actionOutcome || fallback.outcome, rootLayer };
    });
  }, [scoreResult?.cascadeRisk, scoreResult?.dominantLayer]);

  const [activeIdx, setActiveIdx] = useState(defaultCascadeIdx);
  const [replayKey, setReplayKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showCascadeList, setShowCascadeList] = useState(false);
  // First-time "how they connect" intro sequence — cumulative reveal of each active cascade's
  // connector, all staying visible together, ending in a caption about the interconnection.
  // Only makes sense with more than one cascade (a single cascade needs no "how they connect"
  // framing) and only ever plays once per device — after that, straight to normal explore mode.
  const [introMode, setIntroMode] = useState(false);
  const [introStep, setIntroStep] = useState(0); // how many cascades revealed so far
  const [introComplete, setIntroComplete] = useState(false); // full pass finished, caption showing
  // No cap — show every detected cascade, not an arbitrary subset. With only 5 layers total,
  // the real maximum is naturally bounded anyway.
  const introCascades = allCascades;
  const introLineAnims = useRef<Animated.Value[]>([]).current;
  while (introLineAnims.length < introCascades.length) introLineAnims.push(new Animated.Value(LINE_DASH));
  const introTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Sequence token — every call to playIntroSequence gets a fresh number. Each scheduled timer
  // checks its own token against the current one before doing anything; if a newer sequence has
  // started since this timer was scheduled, it's stale and does nothing instead of visibly
  // resetting the display. This is what makes the sequence robust regardless of what triggers a
  // re-render mid-sequence — previously, any unexpected restart mid-way would clear the pending
  // timers for cascades 2+ and silently loop back to only ever showing cascade 1.
  const introSeqToken = useRef(0);
  // Guards against the trigger effect starting the sequence more than once per genuine
  // "card just opened" event, even if the effect itself re-runs for unrelated reasons while
  // still expanded — not a "seen it once, never again" flag. Resets the moment it's collapsed,
  // so the very next open plays the full sequence again, every time, by design.
  const introTriggeredThisExpand = useRef(false);

  useEffect(() => {
    if (!expanded) { introTriggeredThisExpand.current = false; return; }
    if (allCascades.length <= 1) return;
    if (introTriggeredThisExpand.current) return;
    introTriggeredThisExpand.current = true;
    setIntroMode(true);
    playIntroSequence();
  }, [expanded, allCascades.length]);

  const exitIntroMode = () => {
    introSeqToken.current++; // invalidate any pending timers immediately
    introTimers.current.forEach(clearTimeout);
    introTimers.current = [];
    setIntroMode(false);
    // No longer persisted — this only affects the CURRENT viewing session. Collapse and reopen,
    // and the full sequence plays again from scratch, every time, on purpose.
  };

  const playIntroSequence = (isReplay = false) => {
    const myToken = ++introSeqToken.current;
    introTimers.current.forEach(clearTimeout);
    introTimers.current = [];
    introLineAnims.forEach(v => v.setValue(LINE_DASH));
    setIntroStep(0);
    // Only hide the caption before the very first pass. Once it's been shown, it stays visible
    // and static — the message doesn't re-hide/reappear on each auto-loop, only the graph lines
    // underneath reset and redraw. A caption that vanishes and retypes every 5 seconds is
    // exactly what made it hard to read.
    if (!isReplay) setIntroComplete(false);
    introCascades.forEach((_, i) => {
      introTimers.current.push(setTimeout(() => {
        if (introSeqToken.current !== myToken) return; // superseded — do nothing
        Animated.timing(introLineAnims[i], { toValue: 0, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
        setIntroStep(i + 1);
      }, i * 900 + 300));
    });
    introTimers.current.push(setTimeout(() => {
      if (introSeqToken.current !== myToken) return;
      setIntroComplete(true);
      // Idle for ~5s after the full sequence finishes — if nobody's tapped anything by then,
      // the graph replays from the top rather than sitting frozen. The caption is untouched by
      // this replay (isReplay=true). Any real interaction (exitIntroMode) cancels this.
      introTimers.current.push(setTimeout(() => {
        if (introSeqToken.current !== myToken) return;
        playIntroSequence(true);
      }, 5000));
    }, introCascades.length * 900 + 1200));
  };

  useEffect(() => { setActiveIdx(defaultCascadeIdx); }, [defaultCascadeIdx]);
  // Same principle as the intro sequence — reopening the card should always start fresh, not
  // silently resume wherever browsing was left off before it was collapsed.
  useEffect(() => { if (expanded) setActiveIdx(defaultCascadeIdx); }, [expanded]);

  const current = allCascades[activeIdx] || null;
  const activeLayers = current?.layers || [];

  const nodePos = useMemo(() => {
    const p: Record<number, { x: number; y: number }> = {};
    for (let i = 1; i <= 5; i++) p[i] = { x: NODE_LAYOUT[i].fx * containerW, y: NODE_LAYOUT[i].fy * CASCADE_H };
    return p;
  }, [containerW]);

  // --- Animations ---
  const breathAnim = useRef(new Animated.Value(0)).current;
  const nodeAnims = useRef({
    scales: [1, 2, 3, 4, 5].map(() => new Animated.Value(1)),
    glows: [1, 2, 3, 4, 5].map(() => new Animated.Value(0)),
  }).current;
  const lineAnims = useRef(Array.from({ length: 4 }, () => new Animated.Value(LINE_DASH))).current;
  const storyAnim = useRef(new Animated.Value(0)).current;
  const rootPulseAnim = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const breathScale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.07] });

  // Breathing loop — always running (powers collapsed nodes + decorative life)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Root node continuous pulse when expanded
  useEffect(() => {
    if (!expanded || activeLayers.length === 0) { rootPulseAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rootPulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rootPulseAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const delay = activeLayers.length * 800 + 1500;
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  }, [expanded, activeIdx, replayKey]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Cascade animation — ONLY when expanded
  useEffect(() => {
    if (!expanded || allCascades.length === 0) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    nodeAnims.scales.forEach(s => s.setValue(1));
    nodeAnims.glows.forEach(g => g.setValue(0));
    lineAnims.forEach(l => l.setValue(LINE_DASH));
    storyAnim.setValue(0);

    activeLayers.forEach((layerIdx, step) => {
      const ni = layerIdx - 1;
      timers.current.push(setTimeout(() => {
        Animated.parallel([
          Animated.sequence([
            Animated.timing(nodeAnims.scales[ni], { toValue: 1.28, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(nodeAnims.scales[ni], { toValue: 1.0, duration: 280, useNativeDriver: true }),
          ]),
          Animated.timing(nodeAnims.glows[ni], { toValue: 1, duration: 450, useNativeDriver: true }),
        ]).start();
      }, step * 800 + 200));

      if (step < activeLayers.length - 1) {
        timers.current.push(setTimeout(() => {
          Animated.timing(lineAnims[step], { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
        }, step * 800 + 600));
      }
    });

    timers.current.push(setTimeout(() => {
      Animated.timing(storyAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, activeLayers.length * 800 + 1000));
  }, [expanded, activeIdx, replayKey, allCascades.length]);

  const curvePath = (fromL: number, toL: number) => {
    const f = nodePos[fromL], t = nodePos[toL];
    const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
    const dx = t.x - f.x, dy = t.y - f.y;
    return `M ${f.x} ${f.y} Q ${mx - dy * 0.15} ${my + dx * 0.15} ${t.x} ${t.y}`;
  };

  if (allCascades.length === 0) return null;

  // Shared list overlay — same content, same tap-to-jump behavior, whether opened from the
  // collapsed home-screen preview or the fully expanded detail view. allCascades is already in
  // priority order (rankCascadeStrings), so row position === rank, no separate sort needed here.
  const cascadeListModal = (
    <Modal visible={showCascadeList} transparent animationType="fade" onRequestClose={() => setShowCascadeList(false)}>
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCascadeList(false)} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingTop: 12, paddingBottom: 24 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 }} />
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>All Cascades</Text>
          <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>Ranked by what matters most right now — tap any one to jump straight to it</Text>
        </View>
        <ScrollView style={{ maxHeight: 420 }}>
          {allCascades.map((c, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { setActiveIdx(i); setReplayKey(k => k + 1); setShowCascadeList(false); setExpanded(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, backgroundColor: i === activeIdx ? `${LAYERS[c.rootLayer - 1].color}10` : 'transparent' }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: LAYERS[c.rootLayer - 1].color, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  {c.layers.map((l, li) => (
                    <React.Fragment key={l}>
                      {li > 0 && <Ionicons name="arrow-forward" size={9} color={colors.textTertiary} />}
                      <Text style={{ fontSize: 11, fontWeight: '700', color: LAYERS[l - 1].color }}>{LAYERS[l - 1].shortName.split(' \u2014 ')[1] || LAYERS[l - 1].key}</Text>
                    </React.Fragment>
                  ))}
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 15 }} numberOfLines={2}>{c.narrative}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
    </Modal>
  );

  // =================== COLLAPSED STATE ===================
  if (!expanded) {
    return (
      <>
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <TouchableOpacity activeOpacity={0.92} onPress={() => setExpanded(true)}>
          <View style={{ borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#7C5CFF15', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="link-variant" size={17} color="#7C5CFF" />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.3 }}>Metabolic Story</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>How your systems connect today</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowCascadeList(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: `${LAYERS[(current?.rootLayer || 1) - 1].color}18` }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: LAYERS[(current?.rootLayer || 1) - 1].color }} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: LAYERS[(current?.rootLayer || 1) - 1].color }}>{allCascades.length} cascade{allCascades.length > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            </View>

            {/* 5 Node Row — all breathing, active ones glowing */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12 }}>
              {LAYERS.map((layer) => {
                const isActive = activeLayers.includes(layer.id);
                const score = scoreResult?.sc?.[layer.id] ?? 0;
                return (
                  <Animated.View key={layer.id} style={{ alignItems: 'center', gap: 5, transform: [{ scale: breathScale }] }}>
                    <View style={{
                      width: 46, height: 46, borderRadius: 23,
                      backgroundColor: `${layer.color}18`,
                      borderWidth: isActive ? 2.5 : 1.5,
                      borderColor: layer.color,
                      alignItems: 'center', justifyContent: 'center',
                      shadowColor: layer.color,
                      shadowOpacity: isActive ? 0.4 : 0.08,
                      shadowRadius: isActive ? 18 : 4,
                      shadowOffset: { width: 0, height: 0 },
                    }}>
                      {clinicalDepth && !alwaysShowIcon ? <Text style={{ fontSize: 16, fontWeight: '800', color: layer.color, lineHeight: 20 }}>{score}</Text> : <LayerIcon name={layer.icon} size={16} color={layer.color} />}
                    </View>
                    <Text style={{ fontSize: 8, fontWeight: '600', color: isActive ? layer.color : colors.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                      {clinicalDepth ? (layer.shortName.split(' \u2014 ')[1] || layer.key) : LAYER_PLAIN_SHORT[layer.id - 1]}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>

            {/* Cascade path teaser */}
            {current && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 6 }}>
                {current.layers.map((l, i) => (
                  <React.Fragment key={l}>
                    {i > 0 && <Ionicons name="arrow-forward" size={10} color={colors.textTertiary} />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LAYERS[l - 1].color }} />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: LAYERS[l - 1].color }}>
                        {LAYERS[l - 1].shortName.split(' \u2014 ')[1] || LAYERS[l - 1].key}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Tap CTA */}
            <View style={{ paddingTop: 8, paddingBottom: 14, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Tap to explore your cascade</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      {cascadeListModal}
      </>
    );
  }

  // =================== EXPANDED STATE ===================
  return (
    <>
    <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <TouchableOpacity onPress={() => setExpanded(false)} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>Collapse</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowCascadeList(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: `${LAYERS[(current?.rootLayer || 1) - 1].color}18` }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: LAYERS[(current?.rootLayer || 1) - 1].color }} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: LAYERS[(current?.rootLayer || 1) - 1].color }}>{allCascades.length} cascade{allCascades.length > 1 ? 's' : ''} detected</Text>
          <Ionicons name="chevron-down" size={10} color={LAYERS[(current?.rootLayer || 1) - 1].color} />
        </TouchableOpacity>
      </View>

      {introMode ? (
      <>
      {/* First-time intro — reveals each active cascade's connector cumulatively, all staying
          visible together, so it reads as "these are all feeding each other," not four
          separate, confusing facts. */}
      <View style={{ borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', position: 'relative' }}>
        <Svg width={containerW} height={CASCADE_H} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
          <Defs>
            {introCascades.map((c, i) => {
              const from = c.layers[0], to = c.layers[c.layers.length - 1];
              return (
                <SvgLinearGradient key={`ig${i}`} id={`icg${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <SvgStop offset="0%" stopColor={LAYERS[from - 1].color} />
                  <SvgStop offset="100%" stopColor={LAYERS[to - 1].color} />
                </SvgLinearGradient>
              );
            })}
          </Defs>
          {introCascades.map((c, i) => {
            const from = c.layers[0], to = c.layers[c.layers.length - 1];
            return (
              <AnimatedSvgPath key={`il${i}`} d={curvePath(from, to)} stroke={`url(#icg${i})`} strokeWidth={2.5} fill="none" strokeDasharray={LINE_DASH} strokeDashoffset={introLineAnims[i]} strokeLinecap="round" />
            );
          })}
        </Svg>
        {LAYERS.map((layer) => {
          const li = layer.id;
          const pos = nodePos[li];
          const revealedLayers = introCascades.slice(0, introStep).flatMap(c => c.layers);
          const isActive = revealedLayers.includes(li);
          const score = scoreResult?.sc?.[li] ?? 0;
          return (
            <Animated.View key={li} style={{
              position: 'absolute', left: pos.x - NODE_R, top: pos.y - NODE_R,
              width: NODE_R * 2, height: NODE_R * 2, borderRadius: NODE_R,
              backgroundColor: `${layer.color}18`,
              borderWidth: isActive ? 2.5 : 1.5,
              borderColor: layer.color,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: breathScale }],
              zIndex: isActive ? 10 : 2,
              shadowColor: layer.color,
              shadowOpacity: isActive ? 0.35 : 0,
              shadowRadius: isActive ? 20 : 0,
              shadowOffset: { width: 0, height: 0 },
            }}>
              {clinicalDepth && !alwaysShowIcon ? <Text style={{ fontSize: 20, fontWeight: '800', color: layer.color, lineHeight: 24 }}>{score}</Text> : <LayerIcon name={layer.icon} size={20} color={layer.color} />}
              <Text style={{ fontSize: 7, fontWeight: '700', color: layer.color, opacity: isActive ? 1 : 0.55, letterSpacing: 0.5, marginTop: 1, textTransform: 'uppercase' }}>
                {clinicalDepth ? (layer.shortName.split(' \u2014 ')[1] || layer.key) : LAYER_PLAIN_SHORT[layer.id - 1]}
              </Text>
            </Animated.View>
          );
        })}
        <View style={{ height: CASCADE_H }} />
      </View>

      {/* Caption + Fat Loss Resistance, shown once the full sequence has played through */}
      {introComplete && (
        <View style={{ marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: colors.card }}>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>
            Your <Text style={{ fontWeight: '700', color: LAYERS[(scoreResult?.dominantLayer || 1) - 1].color }}>{clinicalDepth ? LAYERS[(scoreResult?.dominantLayer || 1) - 1].shortName.split(' \u2014 ')[1] : (LAYER_PLAIN[(scoreResult?.dominantLayer || 1) - 1].charAt(0).toUpperCase() + LAYER_PLAIN[(scoreResult?.dominantLayer || 1) - 1].slice(1))}</Text> layer is under the most strain — but all {new Set(introCascades.flatMap(c => c.layers)).size} active layers here may be feeding each other. When it's like this, the fix usually isn't just one thing.
          </Text>
          {scoreResult?.rcsInfo?.compPct != null && (
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              Right now, <Text style={{ fontWeight: '700', color: colors.text }}>{scoreResult.rcsInfo.compPct}%</Text> of your body's effort may be going toward protection instead of fat adaptation.
            </Text>
          )}
          <TouchableOpacity onPress={exitIntroMode} style={{ marginTop: 14, backgroundColor: colors.red, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Read Each Cascade One by One →</Text>
          </TouchableOpacity>
        </View>
      )}
      </>
      ) : (
      <>
      {/* Cascade Map */}
      <View style={{ borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', position: 'relative' }}>
        {/* SVG Lines — useNativeDriver false for strokeDashoffset compat */}
        <Svg width={containerW} height={CASCADE_H} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
          <Defs>
            {activeLayers.slice(0, -1).map((_, i) => (
              <SvgLinearGradient key={`g${i}`} id={`cg${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <SvgStop offset="0%" stopColor={LAYERS[activeLayers[i] - 1].color} />
                <SvgStop offset="100%" stopColor={LAYERS[activeLayers[i + 1] - 1].color} />
              </SvgLinearGradient>
            ))}
          </Defs>
          {activeLayers.slice(0, -1).map((_, i) => (
            <AnimatedSvgPath key={`l${i}`} d={curvePath(activeLayers[i], activeLayers[i + 1])} stroke={`url(#cg${i})`} strokeWidth={2.5} fill="none" strokeDasharray={LINE_DASH} strokeDashoffset={lineAnims[i]} strokeLinecap="round" />
          ))}
        </Svg>

        {/* Root node glow ring — continuous pulse */}
        {activeLayers.length > 0 && (
          <Animated.View style={{
            position: 'absolute',
            left: nodePos[activeLayers[0]].x - NODE_R - 10,
            top: nodePos[activeLayers[0]].y - NODE_R - 10,
            width: (NODE_R + 10) * 2,
            height: (NODE_R + 10) * 2,
            borderRadius: NODE_R + 10,
            backgroundColor: LAYERS[activeLayers[0] - 1].color,
            opacity: rootPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.22] }),
            zIndex: 0,
          }} />
        )}

        {/* Nodes — ALL 5 at full brightness; active ones get bounce + glow */}
        {LAYERS.map((layer) => {
          const li = layer.id;
          const ni = li - 1;
          const pos = nodePos[li];
          const isActive = activeLayers.includes(li);
          const score = scoreResult?.sc?.[li] ?? 0;
          return (
            <Animated.View key={li} style={{
              position: 'absolute', left: pos.x - NODE_R, top: pos.y - NODE_R,
              width: NODE_R * 2, height: NODE_R * 2, borderRadius: NODE_R,
              backgroundColor: `${layer.color}18`,
              borderWidth: isActive ? 2.5 : 1.5,
              borderColor: layer.color,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: nodeAnims.scales[ni] }],
              zIndex: isActive ? 10 : 2,
              shadowColor: layer.color,
              shadowOpacity: isActive
                ? nodeAnims.glows[ni].interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.5] })
                : 0,
              shadowRadius: isActive ? 22 : 0,
              shadowOffset: { width: 0, height: 0 },
            }}>
              {clinicalDepth && !alwaysShowIcon ? <Text style={{ fontSize: 20, fontWeight: '800', color: layer.color, lineHeight: 24 }}>{score}</Text> : <LayerIcon name={layer.icon} size={20} color={layer.color} />}
              <Text style={{ fontSize: 7, fontWeight: '700', color: layer.color, opacity: isActive ? 1 : 0.55, letterSpacing: 0.5, marginTop: 1, textTransform: 'uppercase' }}>
                {clinicalDepth ? (layer.shortName.split(' \u2014 ')[1] || layer.key) : LAYER_PLAIN_SHORT[layer.id - 1]}
              </Text>
            </Animated.View>
          );
        })}
        <View style={{ height: CASCADE_H }} />
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingHorizontal: 2 }}>
        {LAYERS.map(l => (
          <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: l.color }} />
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>{l.shortName.split(' \u2014 ')[1]}</Text>
          </View>
        ))}
      </View>

      {/* Story Panel */}
      {current && current.narrative && (
        <Animated.View style={{ marginTop: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', opacity: storyAnim }}>
          <View style={{ height: 3, backgroundColor: LAYERS[current.rootLayer - 1].color, opacity: 0.7 }} />
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>Domino Effect</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>{current.layers.map(l => (<View key={l} style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: LAYERS[l - 1].color }} />))}</View>
            </View>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text, fontWeight: '500' }}>{current.narrative}</Text>
            {/* Redirects to Today's 1% rather than repeating an action here — every cascade
                used to show its own action box, and since several cascades often share the same
                root layer, they'd show the identical action text verbatim. One canonical action,
                one canonical place (Today's 1%), matches what's already right for v1.0. */}
            <TouchableOpacity onPress={() => { if (onWorkOnThis) { onWorkOnThis(); } else if (onNavigate) { onNavigate('home'); } }} style={{ marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: colors.bg, borderLeftWidth: 3, borderLeftColor: LAYERS[current.rootLayer - 1].color, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 19 }}>Want to work on this? Track your Today's 1% for 2 weeks and watch this pattern shift.</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={22} color={LAYERS[current.rootLayer - 1].color} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Navigation — prev arrows, bigger dots, next arrows, replay */}
      {allCascades.length > 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 2 }}>
          <TouchableOpacity onPress={() => { setActiveIdx(i => (i - 1 + allCascades.length) % allCascades.length); setReplayKey(k => k + 1); }} style={{ padding: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {allCascades.map((c, i) => (
              <TouchableOpacity key={i} onPress={() => { setActiveIdx(i); setReplayKey(k => k + 1); }} activeOpacity={0.7} hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}>
                <View style={{ width: i === activeIdx ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === activeIdx ? LAYERS[(c.rootLayer || 1) - 1].color : `${colors.border}99` }} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity onPress={() => { setActiveIdx(i => (i + 1) % allCascades.length); setReplayKey(k => k + 1); }} style={{ padding: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReplayKey(k => k + 1)} style={{ padding: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="refresh" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      </>
      )}
    </View>
    {cascadeListModal}
    </>
  );
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ============================================================
// HOME SCREEN
// ============================================================

function HomeScreen({ onNavigate, hasScore, scoreResult, onSelectLayer, onNavigateToResultsFromHope, onSelectArticle, onGoToCravings, highlightTodaysOne }: { onNavigate: (s: ScreenId) => void; hasScore: boolean; scoreResult?: any; onSelectLayer?: (id: number) => void; onNavigateToResultsFromHope?: () => void; onSelectArticle?: (a: Insight) => void; onGoToCravings?: (from: ScreenId) => void; highlightTodaysOne?: number }) {
  const { colors, theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { clinicalDepth, toggleClinicalDepth } = useClinicalDepth();
  const { fullName, cravings: loggedCravings, deleteCraving, symptoms: ctxSymptoms, scoreHistory, refreshCravings, conditions: ctxConditions } = useAppData();
  useEffect(() => { refreshCravings(); }, [refreshCravings]);
  // Derived fresh every render from real data (hasScore/scoreResult come from AppDataContext,
  // scoreHistory is the live Supabase-backed list) — not captured once at mount, so it stays
  // correct even when this data finishes loading after HomeScreen has already mounted.
  const hasRealScore = hasScore || !!scoreResult || scoreHistory.length > 0;
  // previewOverride is a deliberate manual toggle (the eye icon / "Preview post-test state"
  // link below), not derived data — null means "no override, follow the real data."
  const [previewOverride, setPreviewOverride] = useState<boolean | null>(null);
  const showPostTest = previewOverride ?? hasRealScore;
  const [streak, setStreak] = useState(0);
  const [myBooking, setMyBooking] = useState<any>(null);
  useEffect(() => { booking.getMyBooking().then(setMyBooking).catch(() => {}); }, []);
  const [actionDone, setActionDone] = useState(false);
  const [actionDoneFlash, setActionDoneFlash] = useState(false);
  const [scorePadExpanded, setScorePadExpanded] = useState(false);
  // Swipe-to-dismiss for the "Today's 1% complete" card — dismissal is per-day (resets fresh
  // tomorrow along with the streak/actionDone state itself), so this isn't a permanent hide.
  // Built with PanResponder + Animated, both core React Native — no new native dependency,
  // deliberately avoided given react-native-razorpay just taught us the cost of adding one
  // untested native module right before an EAS build.
  const [dismissedToday, setDismissedToday] = useState(false);
  const dismissX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem('ms_action_card_dismissed_date').then(saved => {
      if (saved === todayStr) setDismissedToday(true);
    }).catch(() => {});
  }, []);
  const dismissPanResponder = useRef(
    PanResponder.create({
      // onStartShouldSetPanResponderCapture claims the gesture at the capture phase, before
      // the parent ScrollView's own responder gets first refusal — without this, the
      // ScrollView can silently win the touch and this swipe never fires at all.
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => { if (gesture.dx > 0) dismissX.setValue(gesture.dx); },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 90) {
          Animated.timing(dismissX, { toValue: 500, duration: 200, useNativeDriver: true }).start(() => {
            setDismissedToday(true);
            AsyncStorage.setItem('ms_action_card_dismissed_date', new Date().toISOString().slice(0, 10)).catch(() => {});
          });
        } else {
          Animated.spring(dismissX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;
  // Blink highlight for Today's 1% — triggered when someone taps "Want to work on this?" from
  // a cascade card. Blinks the border/glow 3 times so it's unmistakable which card they were
  // sent to, whether they were already on Home or just arrived from Profile.
  const todaysOneBlinkAnim = useRef(new Animated.Value(0)).current;
  const todaysOneRef = useRef<View>(null);
  const triggerTodaysOneBlink = () => {
    Animated.sequence([
      Animated.timing(todaysOneBlinkAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(todaysOneBlinkAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
      Animated.timing(todaysOneBlinkAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(todaysOneBlinkAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
      Animated.timing(todaysOneBlinkAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(todaysOneBlinkAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
    ]).start();
  };
  useEffect(() => {
    if (!highlightTodaysOne) return;
    triggerTodaysOneBlink();
  }, [highlightTodaysOne]);
  // Same safe pattern as Today's 1% — opacity only, never border/padding, so it can't shake
  // the layout the way an earlier attempt at this did. Fires once whenever Clinical Depth
  // turns off, drawing attention to the new qualitative framing appearing in its place.
  const scorePadBlinkAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (clinicalDepth) return; // only blink when landing IN simple mode, not when leaving it
    Animated.sequence([
      Animated.timing(scorePadBlinkAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(scorePadBlinkAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
      Animated.timing(scorePadBlinkAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(scorePadBlinkAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
      Animated.timing(scorePadBlinkAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(scorePadBlinkAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
    ]).start();
  }, [clinicalDepth]);
  // Cascade Visualization — 7-day rotation index
  const [defaultCascadeIdx, setDefaultCascadeIdx] = useState(0);
  useEffect(() => {
    if (!scoreResult?.cascadeRisk || scoreResult.cascadeRisk.includes('No immediate cascade')) return;
    (async () => {
      try {
        const lastDate = await AsyncStorage.getItem('ms_domino_last_date');
        const lastIdxStr = await AsyncStorage.getItem('ms_domino_last_idx');
        const lastIdx = lastIdxStr ? parseInt(lastIdxStr, 10) : 0;
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const lastTs = lastDate ? parseInt(lastDate, 10) : 0;
        let idx = lastIdx;
        if (now - lastTs >= sevenDays) idx = lastIdx + 1;
        const cascadesCount = scoreResult.cascadeRisk.split('|').filter(Boolean).length;
        setDefaultCascadeIdx(cascadesCount > 0 ? idx % cascadesCount : 0);
        await AsyncStorage.setItem('ms_domino_last_date', now.toString());
        await AsyncStorage.setItem('ms_domino_last_idx', idx.toString());
      } catch (e) { /* silent */ }
    })();
  }, [scoreResult?.cascadeRisk]);
  // PIPELINE 1: Home section visibility (loaded from AsyncStorage)
  const [homeSections, setHomeSections] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    HOME_SECTIONS.forEach(s => { defaults[s.id] = s.defaultOn; });
    return defaults;
  });

  // FIX 3: Restore persistence for daily action — check AsyncStorage on mount
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    AsyncStorage.getItem('ms_action_done_dates').then(async saved => {
      let dates: string[] = [];
      if (saved) {
        try { dates = JSON.parse(saved); } catch { dates = []; }
      } else {
        // Migrate the old single-date key, if it exists, so an in-progress streak isn't lost
        const legacy = await AsyncStorage.getItem('ms_action_done_today').catch(() => null);
        if (legacy) {
          dates = [legacy];
          AsyncStorage.setItem('ms_action_done_dates', JSON.stringify(dates)).catch(() => {});
        }
      }
      setStreak(computeStreak(dates));
      if (dates.includes(today)) setActionDone(true);
    }).catch(() => { /* ignore */ });
    // PIPELINE 1: Load home section visibility from AsyncStorage
    AsyncStorage.getItem('ms_home_sections').then(saved => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setHomeSections(prev => ({ ...prev, ...parsed }));
        } catch { /* ignore */ }
      }
    }).catch(() => { /* ignore */ });
  }, []);

  const markActionDone = () => {
    setActionDoneFlash(true);
    const today = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem('ms_action_done_dates').then(saved => {
      let dates: string[] = [];
      if (saved) {
        try { dates = JSON.parse(saved); } catch { dates = []; }
      }
      if (!dates.includes(today)) dates.push(today);
      AsyncStorage.setItem('ms_action_done_dates', JSON.stringify(dates)).catch(() => {});
      AsyncStorage.setItem('ms_action_done_today', today).catch(() => {}); // kept for backward compat
      setStreak(computeStreak(dates));
    }).catch(() => { /* ignore */ });
    setTimeout(() => { setActionDoneFlash(false); setActionDone(true); }, 3000);
  };

  // Fall back to the latest persisted assessment when scoreResult hasn't been set yet
  // this session (e.g. signed in without retaking the quiz) instead of silently treating
  // layer data as absent — same fallback precedence used for score/band/dominantLayerId below.
  const latestHistory = scoreHistory[0];
  const fallbackLayerScores = latestHistory
    ? { 1: latestHistory.layer1, 2: latestHistory.layer2, 3: latestHistory.layer3, 4: latestHistory.layer4, 5: latestHistory.layer5 }
    : null;
  const layerScores: Record<number, number> = scoreResult?.sc ?? fallbackLayerScores ?? {};
  const hasLayerScores = Object.keys(layerScores).length > 0;
  const sortedLayers = hasLayerScores ? [...LAYERS].sort((a, b) => (layerScores[a.id] ?? 0) - (layerScores[b.id] ?? 0)) : LAYERS;
  const getLayerSignal = (layerId: number): string | null => {
    if (!scoreResult?.history) return null;
    const layerQs = scoreResult.history.filter((h: any) => h.layer === layerId);
    if (layerQs.length === 0) return null;
    const worst = layerQs.sort((a: any, b: any) => a.score - b.score)[0];
    if (!worst?.selected?.length) return null;
    const q = QUESTIONS.find(qx => qx.layer === layerId && qx.id === worst.q);
    return q?.o[worst.selected[0]]?.replace(/[,.]$/, '') || null;
  };

  // FIX 3: Use real score from test result. Fallback to 0 only (never show fake 64).
  // Only true first-time users (no scoreResult AND no history) fall through to the
  // layer-2 default below.
  const score = scoreResult?.totalScore ?? latestHistory?.total_score ?? 0;
  // Same fallback precedence as `score` above — prefer the fresh in-session result,
  // fall back to the persisted band for the latest historical assessment.
  const band = scoreResult?.band ?? (latestHistory ? getBand(score) : null);
  const prevScore = scoreHistory[1]?.total_score;
  const scoreDelta = prevScore != null ? score - prevScore : null;
  const fallbackDominantLayerId = fallbackLayerScores
    ? Object.entries(fallbackLayerScores).sort((a, b) => a[1] - b[1])[0][0]
    : null;
  const dominantLayerId = scoreResult?.dominantLayer ?? (fallbackDominantLayerId ? Number(fallbackDominantLayerId) : 2);
  const todayAction = DAILY_ACTIONS[dominantLayerId]?.[0] ?? DAILY_ACTIONS[2][0];
  const dominantLayer = LAYERS[dominantLayerId - 1] ?? LAYERS[1];

  const renderLayerCard = (layer: typeof LAYERS[0]) => {
    const ls = layerScores[layer.id];
    const hasChip = typeof ls === 'number';
    const sc = !hasChip ? colors.textTertiary : ls >= 14 ? '#22C55E' : ls >= 9 ? '#F59E0B' : '#EF4444';
    const sig = getLayerSignal(layer.id);
    const cardDisplayName = clinicalDepth ? layer.name : (LAYER_PLAIN[layer.id - 1].charAt(0).toUpperCase() + LAYER_PLAIN[layer.id - 1].slice(1));
    return (
      <TouchableOpacity key={layer.id} onPress={() => { if (onSelectLayer) { onSelectLayer(layer.id); } else { onNavigate('layers'); } }} activeOpacity={0.98} style={{ width: 200, marginRight: 12, borderRadius: 20, padding: 16, backgroundColor: colors.card, borderWidth: hasChip && ls <= 11 ? 1 : 0, borderColor: hasChip && ls <= 11 ? `${sc}40` : 'transparent' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}><LayerIcon name={layer.icon} size={18} color={layer.color} /></View>
            {clinicalDepth && <Text style={{ fontSize: 11, fontWeight: '700', color: layer.color }}>0{layer.id}</Text>}
          </View>
          {clinicalDepth && hasChip && <View style={{ backgroundColor: `${sc}1F`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 10, fontWeight: '800', color: sc }}>{ls}/20</Text></View>}
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 18 }}>{cardDisplayName}</Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>{layer.tagline}</Text>
        {sig && <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}><Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 4 }}>Your signal</Text><Text style={{ fontSize: 11, color: layer.color, lineHeight: 15, fontWeight: '600', fontStyle: 'italic' }}>"{sig}"</Text></View>}
      </TouchableOpacity>
    );
  };

  const renderInsightCard = (i: typeof INSIGHTS[0]) => (
    <TouchableOpacity key={i.id} activeOpacity={0.99} onPress={() => { if (i.type === 'ARTICLE' && onSelectArticle) { onSelectArticle(i); } else { onNavigate('library'); } }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, backgroundColor: colors.card }}>
      <View style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden' }}>
        <LinearGradient colors={i.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {i.layer ? <LayerIcon name={LAYERS[i.layer - 1].icon} size={22} color="#fff" /> : <Ionicons name={i.type === 'VIDEO' ? 'play' : 'document-text'} size={20} color="#fff" />}
        </LinearGradient>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary }}>{i.type}</Text>
          <Text style={{ fontSize: 9, color: colors.textTertiary }}>·</Text>
          <Text style={{ fontSize: 9, color: colors.textTertiary }}>{i.readTime}</Text>
          {i.layer && <><Text style={{ fontSize: 9, color: colors.textTertiary }}>·</Text><Text style={{ fontSize: 11, fontWeight: '700', color: LAYERS[i.layer - 1].color }}>L{i.layer}</Text></>}
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 17 }} numberOfLines={2}>{i.title}</Text>
        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>{i.category}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{getTimeOfDayGreeting()},</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 2 }}>{fullName || 'Friend'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {showPostTest && (
                <TouchableOpacity onPress={() => setPreviewOverride(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="eye-outline" size={16} color={colors.text} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={toggleTheme} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={theme === 'dark' ? 'sunny' : theme === 'light' ? 'moon' : 'star'} size={16} color={colors.text} />
              </TouchableOpacity>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications" size={16} color={colors.text} />
                <View style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red }} />
              </View>
              <TouchableOpacity onPress={() => onNavigate('profile')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{(fullName || user?.email || 'A').charAt(0).toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!showPostTest ? (
            <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
              {/* Big CTA */}
              <View style={{ borderRadius: 20, padding: 32, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(212,43,43,0.19)' }}>
                <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(212,43,43,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="flash" size={36} color={colors.red} />
                </View>
                <Text style={{ fontSize: 10, letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Welcome to Metabolic Score</Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 26, marginBottom: 12 }}>Discover which of your 5 metabolic layers is blocking your fat loss.</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 20 }}>10 questions · 3 minutes</Text>
                <TouchableOpacity onPress={() => onNavigate('score')} style={{ backgroundColor: colors.red, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Take the Metabolic Score™ Test</Text>
                </TouchableOpacity>
              </View>

              {/* 5 Layers */}
              <View style={{ marginTop: 28 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>The 5 Layers</Text>
                  <TouchableOpacity onPress={() => onNavigate('layers')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>View All →</Text></TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                  {sortedLayers.map(renderLayerCard)}
                </ScrollView>
              </View>

              {/* Latest Insights */}
              <View style={{ marginTop: 28 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Latest Insights</Text>
                  <TouchableOpacity onPress={() => onNavigate('library')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>See All →</Text></TouchableOpacity>
                </View>
                <View style={{ gap: 12 }}>
                  {INSIGHTS.slice(0, 2).map(renderInsightCard)}
                </View>
              </View>

              {homeSections['methodology'] !== false && (
              <TouchableOpacity onPress={() => onNavigate('about')} activeOpacity={0.95} style={{ marginTop: 28, borderRadius: 20, padding: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.red }}>AB</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.red, textTransform: 'uppercase', marginBottom: 3 }}>Amit's Methodology</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>{ABOUT_STATS.years} years, {ABOUT_STATS.clients} clients — the foundation behind this framework</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
              )}

              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setPreviewOverride(true)}><Text style={{ fontSize: 10, color: colors.textTertiary, textDecorationLine: 'underline' }}>Preview post-test state →</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              {/* Daily Focus */}
              {homeSections['daily-focus'] !== false && (
              <View
                ref={todaysOneRef}
                style={{ paddingHorizontal: 24, marginTop: 16, position: 'relative' }}
              >
                {/* Blink overlay — pure opacity, absolutely positioned. Never touches layout,
                    unlike the earlier version which animated border width and padding directly
                    on the container, physically pushing every card below it down and back up
                    three times. This just flashes on top without moving anything. */}
                <Animated.View pointerEvents="none" style={{
                  position: 'absolute', top: 0, left: 12, right: 12, bottom: 0,
                  borderRadius: 24, borderWidth: 2.5, borderColor: colors.red,
                  opacity: todaysOneBlinkAnim, zIndex: 10,
                }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Today's 1%</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="flame" size={12} color="#FF6B6B" />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>{streak} day streak</Text>
                  </View>
                </View>
                {!actionDone ? (
                  <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
                    {actionDoneFlash ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark-circle" size={24} color="#22C55E" /></View>
                        <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '700', color: '#22C55E' }}>✓ Done</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Streak extended to {streak + 1} days</Text></View>
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="walk" size={20} color={dominantLayer.color} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 1, color: dominantLayer.color, marginBottom: 4, textTransform: 'uppercase' }}>L{dominantLayerId} — {dominantLayer.shortName.split('— ')[1]} · {todayAction.time}</Text>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 20 }}>{todayAction.title}</Text>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 20 }}>{todayAction.desc}</Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={markActionDone} style={{ marginTop: 16, backgroundColor: colors.red, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>Mark as Done</Text></TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : dismissedToday ? null : (
                  <Animated.View {...dismissPanResponder.panHandlers} style={{ transform: [{ translateX: dismissX }] }}>
                    <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark-circle" size={22} color="#22C55E" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Today's 1% complete</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{streak} day streak — see you tomorrow</Text>
                      </View>
                      {/* Guaranteed dismiss, independent of the swipe gesture above — swipe still
                          works if it wins against the parent ScrollView, but this always works
                          regardless, since a plain tap has no gesture-priority conflict to lose. */}
                      <TouchableOpacity
                        onPress={() => { setDismissedToday(true); AsyncStorage.setItem('ms_action_card_dismissed_date', new Date().toISOString().slice(0, 10)).catch(() => {}); }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="close" size={18} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                )}
              </View>
              )}

              {/* Merged Score + Fat Loss Resistance pad — single foldable card */}
              <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
                <TouchableOpacity activeOpacity={0.95} onPress={() => { if (hasRealScore) { setScorePadExpanded(!scorePadExpanded); } else { onNavigate('score'); } }} style={{ borderRadius: 20, padding: 24, backgroundColor: colors.card, position: 'relative' }}>
                  {!clinicalDepth && (
                    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, borderWidth: 2.5, borderColor: colors.red, opacity: scorePadBlinkAnim, zIndex: 10 }} />
                  )}
                  {hasRealScore && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); toggleClinicalDepth(); }}
                    style={{
                      position: 'absolute', top: 16, right: 16, zIndex: 20,
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: clinicalDepth ? `${colors.red}18` : colors.bg,
                      borderWidth: 1, borderColor: clinicalDepth ? `${colors.red}40` : colors.border,
                    }}
                  >
                    <Ionicons name="medkit-outline" size={12} color={clinicalDepth ? colors.red : colors.textTertiary} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: clinicalDepth ? colors.red : colors.textTertiary }}>{clinicalDepth ? 'Detail' : 'Simple'}</Text>
                  </TouchableOpacity>
                  )}
                  {!hasRealScore ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: `${colors.red}18`, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="analytics-outline" size={26} color={colors.red} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Take your first Metabolic Score</Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>A 3-minute assessment to see what's actually going on.</Text>
                      </View>
                    </View>
                  ) : clinicalDepth ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 28 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>Your Metabolic Score</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                        <Text style={{ fontSize: 56, fontWeight: '800', color: colors.text }}>{score}</Text>
                        <Text style={{ fontSize: 15, marginLeft: 4, color: colors.textSecondary }}>/100</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(245,158,11,0.12)' }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#F59E0B', textTransform: 'uppercase' }}>{band?.status || 'Early Dysfunction'}</Text>
                      </View>
                      {scoreDelta != null && scoreDelta !== 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                          <Ionicons name={scoreDelta > 0 ? 'trending-up' : 'trending-down'} size={11} color={scoreDelta > 0 ? '#22C55E' : '#EF4444'} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: scoreDelta > 0 ? '#22C55E' : '#EF4444' }}>{scoreDelta > 0 ? '+' : ''}{scoreDelta} since last</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 6, marginTop: 24 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: `${band?.color || colors.textSecondary}20`, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="shield" size={28} color={band?.color || colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 23 }}>Your body is working hard to protect itself</Text>
                      {scoreDelta != null && scoreDelta !== 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                          <Ionicons name={scoreDelta > 0 ? 'trending-up' : 'trending-down'} size={12} color={scoreDelta > 0 ? '#22C55E' : '#EF4444'} />
                          <Text style={{ fontSize: 12, fontWeight: '600', color: scoreDelta > 0 ? '#22C55E' : '#EF4444' }}>{scoreDelta > 0 ? '+' : ''}{scoreDelta} since last</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  )}
                  {clinicalDepth && hasRealScore && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: band?.color || colors.textSecondary }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: band?.color || colors.textSecondary }}>{band?.label || 'Metabolic Load: Moderate'}</Text>
                  </View>
                  )}

                  {scorePadExpanded && homeSections['resistance'] !== false && (() => {
                    // scoreResult is in-session-only (null after sign-in without retaking the quiz).
                    // Reconstruct from the latest persisted row when possible; reconstructScoreResultFromHistory
                    // itself returns null for rows saved before the 2026-07-30 cascade_risk/dominant_layer
                    // persistence fix, so pre-fix rows correctly fall through to "show nothing" below.
                    const effectiveScoreResult = scoreResult ?? (latestHistory ? reconstructScoreResultFromHistory(latestHistory) : null);
                    if (!effectiveScoreResult) return null;
                    const rcsPct = effectiveScoreResult?.rcsInfo?.compPct ?? 0;
                    const rcsColor = getResistanceColor(rcsPct);
                    const rcsTier = getResistanceTier(rcsPct);
                    const pointsAvailable = effectiveScoreResult?.history ? effectiveScoreResult.history.reduce((sum: number, h: any) => sum + ([0, 3, 3, 5, 4][h.ansIdx] || 0), 0) : (score <= 30 ? 35 : score <= 50 ? 25 : score <= 70 ? 15 : 8);
                    const weeksEstimate = score <= 30 ? '10–14' : score <= 50 ? '8–12' : '6–10';
                    const n1UserData = { gender: 'Male', age: '26–35', conditions: ctxConditions || [], sleepScore: 5, stressScore: 5, gutScore: 5 };
                    const n1Narrative = generateLocalN1(effectiveScoreResult as ScoreResult, n1UserData);
                    return (
                      <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Ionicons name="lock-closed" size={14} color={rcsColor} />
                          <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: rcsColor, textTransform: 'uppercase' }}>Fat Loss Resistance</Text>
                        </View>
                        {clinicalDepth ? (
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                          <Text style={{ fontSize: 26, fontWeight: '900', color: rcsColor }}>{rcsPct}%</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{rcsTier}</Text>
                        </View>
                        ) : (
                        <Text style={{ fontSize: 14, fontWeight: '600', color: rcsColor, marginBottom: 8 }}>{rcsTier} resistance</Text>
                        )}
                        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{n1Narrative}</Text>
                        {clinicalDepth && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                          <Text style={{ fontSize: 18, fontWeight: '900', color: '#22C55E' }}>+{pointsAvailable}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>points may be available over {weeksEstimate} weeks</Text>
                        </View>
                        )}
                        <TouchableOpacity onPress={() => onNavigate('results')} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>Read full analysis →</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                  {!scorePadExpanded && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>Tap for details →</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Cascade Visualization — The Metabolic Story */}
              {scoreResult && homeSections['metabolic-story'] !== false && (
                <CascadeVisualization
                  scoreResult={scoreResult}
                  defaultCascadeIdx={defaultCascadeIdx}
                  colors={colors}
                  onNavigate={onNavigate}
                  onWorkOnThis={triggerTodaysOneBlink}
                  alwaysShowIcon
                />
              )}
              {/* When there's no fresh in-session scoreResult (e.g. signed in without retaking
                  the quiz) but a persisted assessment exists: rows saved after the 2026-07-30
                  cascade_risk/dominant_layer persistence fix can be reconstructed into a real
                  CascadeVisualization; older rows (neither field persisted) fall back to the
                  lightweight dominant-pattern + layer-breakdown summary instead of hiding the
                  card entirely. */}
              {!scoreResult && latestHistory && homeSections['metabolic-story'] !== false && (() => {
                const reconstructed = reconstructScoreResultFromHistory(latestHistory);
                if (reconstructed) {
                  return (
                    <CascadeVisualization
                      scoreResult={reconstructed}
                      defaultCascadeIdx={defaultCascadeIdx}
                      colors={colors}
                      onNavigate={onNavigate}
                      onWorkOnThis={triggerTodaysOneBlink}
                      alwaysShowIcon
                    />
                  );
                }
                return (
                  <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
                    <View style={{ borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#7C5CFF15', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialCommunityIcons name="link-variant" size={17} color="#7C5CFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.3 }}>Metabolic Story</Text>
                          <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>From your last assessment</Text>
                        </View>
                      </View>
                      {latestHistory.dominant_pattern && (
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 12, lineHeight: 18 }}>{latestHistory.dominant_pattern}</Text>
                      )}
                      <View style={{ gap: 8 }}>
                        {LAYERS.map(layer => {
                          const ls = fallbackLayerScores?.[layer.id];
                          return (
                            <View key={layer.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{layer.name}</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{typeof ls === 'number' ? `${ls}/20` : '—'}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Cravings Quick-Log */}
              {homeSections['cravings'] !== false && (
              <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Cravings Quick-Log</Text>
                </View>
                <TouchableOpacity activeOpacity={0.97} onPress={() => onGoToCravings ? onGoToCravings('home') : onNavigate('cravings')} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
                  {loggedCravings.length === 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add-circle" size={22} color={colors.red} /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Log your first craving</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 }}>5–7 days of logging reveals which layer is under strain.</Text></View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </View>
                  ) : (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><Text style={{ fontSize: 11, color: colors.textSecondary }}>This week · {loggedCravings.length} logged</Text><TouchableOpacity onPress={() => onNavigate('weekly-cravings')}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>Summary →</Text></TouchableOpacity></View>
                      {loggedCravings.slice(0, 3).map((c, i) => { const ct = CRAVING_TYPES.find(t => t.id === c.craving_type); return (
                        <View key={c.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                          <Text style={{ fontSize: 18 }}>{ct?.icon}</Text>
                          <View style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{ct?.label}</Text><Text style={{ fontSize: 10, color: colors.textSecondary }}>{CRAVING_TIMING.find(t => t.id === c.timing)?.label || c.timing}</Text></View>
                          {c.mapped_layer ? <View style={{ backgroundColor: `${LAYERS[c.mapped_layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: LAYERS[c.mapped_layer - 1].color }}>L{c.mapped_layer}</Text></View> : c.tier === 'habit' ? <View style={{ backgroundColor: colors.iconBg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary }}>HABIT</Text></View> : null}
                        </View>
                      ); })}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              )}

              {/* Current Symptoms */}
              {homeSections['symptoms'] !== false && (
              <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Current Symptoms</Text>
                </View>
                <TouchableOpacity activeOpacity={0.97} onPress={() => onNavigate('symptom-tracker')} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
                  {ctxSymptoms.length === 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="pulse" size={20} color="#FF6B6B" /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>No symptoms tracked yet</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 }}>Add what you're feeling — severity + when it started.</Text></View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {ctxSymptoms.slice(0, 6).map((s, i) => { const sv = SYMPTOM_SEVERITY.find(x => x.id === s.severity); return (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sv?.color || colors.textTertiary }} />
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{s.name}</Text>
                          {s.severity && <Text style={{ fontSize: 9, color: sv?.color || colors.textTertiary, fontWeight: '700', textTransform: 'uppercase' }}>{sv?.label}</Text>}
                        </View>
                      ); })}
                      {ctxSymptoms.length > 6 && <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg }}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>+{ctxSymptoms.length - 6} more</Text></View>}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              )}


              {myBooking && homeSections['upcoming-call'] !== false && new Date(myBooking.booking_date) >= new Date(new Date().toDateString()) && (
                <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
                  <TouchableOpacity onPress={() => onNavigate('profile')} activeOpacity={0.95} style={{ borderRadius: 18, padding: 16, backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="calendar" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Upcoming call with Amit</Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                        {new Date(myBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        {myBooking.booking_availability_template && ` · ${fmtSlotTime(myBooking.booking_availability_template.start_time)} – ${fmtSlotTime(myBooking.booking_availability_template.end_time)}`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.85)" />
                  </TouchableOpacity>
                </View>
              )}

              {/* 5 Layers — always shown (locked) */}
              <View style={{ marginTop: 28 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>The 5 Layers</Text>
                  <TouchableOpacity onPress={() => onNavigate('layers')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>View All →</Text></TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                  {sortedLayers.map(renderLayerCard)}
                </ScrollView>
              </View>

              {/* Latest Insights */}
              {homeSections['insights'] !== false && (
              <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Latest Insights</Text>
                  <TouchableOpacity onPress={() => onNavigate('library')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>See All →</Text></TouchableOpacity>
                </View>
                <View style={{ gap: 12 }}>
                  {(() => {
                    if (!hasLayerScores) return INSIGHTS.slice(0, 3).map(renderInsightCard);
                    const sortedInsights = [...INSIGHTS].sort((a, b) => {
                      const aScore = a.layer ? (layerScores[a.layer] ?? 20) : 20;
                      const bScore = b.layer ? (layerScores[b.layer] ?? 20) : 20;
                      return aScore - bScore;
                    });
                    return sortedInsights.slice(0, 3).map(renderInsightCard);
                  })()}
                </View>
              </View>
              )}

              {/* Case Studies — horizontal scroll with real photos */}
              {homeSections['case-studies'] !== false && (
              <View style={{ marginTop: 28 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Case Studies</Text>
                  <TouchableOpacity onPress={() => onNavigate('cases')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>View All →</Text></TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                  {(() => {
                    let casesToShow = CASE_STUDIES;
                    let label = 'Featured';
                    if (hasLayerScores) {
                      const al = [1, 2, 3, 4, 5].filter(i => layerScores[i] <= 11);
                      const matched = CASE_STUDIES.filter(cs => (CASE_LAYER_MAP[cs.id] || []).some(l => al.includes(l)));
                      if (matched.length > 0) { casesToShow = matched.slice(0, 3); label = 'Matched to your pattern'; }
                    }
                    return casesToShow.map(cs => (
                      <TouchableOpacity key={cs.id} onPress={() => Linking.openURL(cs.reel)} activeOpacity={0.98} style={{ width: 176, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
                        <View style={{ height: 96, position: 'relative' }}>
                          <Image source={cs.photo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} /></View></View>
                          <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 7, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>{cs.tags[0]}</Text></View>
                        </View>
                        <View style={{ padding: 10 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: colors.red }}>{cs.result.split('·')[0]}</Text>
                          <Text style={{ fontSize: 9, color: colors.textTertiary, marginTop: 4 }}>{cs.layer}</Text>
                        </View>
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>
              </View>
              )}

              {/* Book a Call with Amit */}
              <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
                <TouchableOpacity activeOpacity={0.95} onPress={() => onNavigate('booking')} style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.red}30` }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="call" size={20} color={colors.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Book a Call with Amit</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Find out what's actually blocking your progress</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* Instagram */}
              {homeSections['methodology'] !== false && (
              <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
                <TouchableOpacity onPress={() => onNavigate('about')} activeOpacity={0.95} style={{ borderRadius: 20, padding: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.red}30`, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.red }}>AB</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Amit's Methodology</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>The story behind this framework</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              )}

              {homeSections['instagram'] !== false && (
              <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
                <TouchableOpacity onPress={() => Linking.openURL(BRAND.instagram)} activeOpacity={0.99} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="logo-instagram" size={18} color={colors.text} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Follow on Instagram</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>{BRAND.instagramHandle} · Daily insights</Text>
                    </View>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              )}
            </View>
          )}
        </ScrollView>
        <BottomNav active="home" onNavigate={onNavigate} hasScore={hasScore} />
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// SCORE TOOL SCREEN
// ============================================================

function ScoreToolScreen({ onNavigate, onComplete }: { onNavigate: (s: ScreenId) => void; onComplete: (result: ScoreResult, userData: UserData) => void }) {
  const { colors } = useTheme();
  const { conditions: ctxConditions } = useAppData();
  const quizStartTime = useRef(Date.now());
  const [phase, setPhase] = useState<'quiz' | 'sliders' | 'choice' | 'adaptive' | 'analyzing'>('quiz');
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sleepScore, setSleepScore] = useState(5);
  const [stressScore, setStressScore] = useState(5);
  const [gutScore, setGutScore] = useState(5);
  const [adaptiveQueue, setAdaptiveQueue] = useState<any[]>([]);
  const [adaptiveIdx, setAdaptiveIdx] = useState(0);
  const [adaptiveAnswers, setAdaptiveAnswers] = useState<any[]>([]);
  const [adaptiveSel, setAdaptiveSel] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [showMicroInsight, setShowMicroInsight] = useState(false);
  // Cinematic analyzing animation — driven by the user's actual answers
  const [cinemaStep, setCinemaStep] = useState(0);
  const cinemaSteps = useMemo(() => {
    const answerSteps: { name: string; color: string; signal: string }[] = [];
    const byLayer: Record<number, typeof history> = {};
    history.forEach(h => { (byLayer[h.layer] = byLayer[h.layer] || []).push(h); });
    [1, 2, 3, 4, 5].forEach(layerId => {
      const layer = LAYERS[layerId - 1];
      const entries = byLayer[layerId] || [];
      if (entries.length === 0) return;
      const worst = entries.sort((a, b) => a.score - b.score)[0];
      const qData = QUESTIONS.find(qx => qx.layer === layerId && qx.id === worst.q);
      const answerText = qData?.o[worst.selected?.[0] ?? worst.ansIdx] || 'Signals detected';
      const short = answerText.length > 50 ? answerText.slice(0, 47) + '...' : answerText;
      answerSteps.push({ name: layer.shortName.split(' \u2014 ')[1] || layer.key, color: layer.color, signal: `"${short}"` });
    });
    answerSteps.push({ name: 'Cascade Mapping', color: '#EF4444', signal: 'Tracing inter-layer cascade pathways...' });
    answerSteps.push({ name: 'Pattern Engine', color: '#7C5CFF', signal: 'Running pattern recognition model...' });
    answerSteps.push({ name: 'Resistance Score', color: '#F59E0B', signal: 'Computing fat loss resistance...' });
    return answerSteps;
  }, [history]);
  useEffect(() => {
    if (phase !== 'analyzing') return;
    setCinemaStep(0);
    const totalSteps = cinemaSteps.length;
    const stepDuration = Math.max(350, Math.min(600, 5000 / totalSteps));
    const timers: ReturnType<typeof setTimeout>[] = [];
    cinemaSteps.forEach((_, i) => {
      timers.push(setTimeout(() => setCinemaStep(i + 1), i * stepDuration));
    });
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const q = QUESTIONS[qIdx];
  const layer = LAYERS[q.layer - 1];

  const toggleOption = (i: number) => {
    const ns = new Set(selected);
    if (ns.has(i)) ns.delete(i); else ns.add(i);
    setSelected(ns);
  };

  const nextQuestion = () => {
    if (selected.size === 0) return;
    const scores = Array.from(selected).map(i => ANS_SCORES[i]);
    const minScore = Math.min(...scores);
    const worstIdx = Array.from(selected).reduce((a, b) => ANS_SCORES[b] < ANS_SCORES[a] ? b : a);
    const newEntry: HistoryEntry = { layer: q.layer, score: minScore, ansIdx: worstIdx, q: qIdx, selected: Array.from(selected) };
    const newHistory = [...history, newEntry];
    setHistory(newHistory);

    if (qIdx === 2 || qIdx === 5 || qIdx === 8) {
      setShowMicroInsight(true);
      setTimeout(() => {
        setShowMicroInsight(false);
        if (qIdx < QUESTIONS.length - 1) { setQIdx(qIdx + 1); setSelected(new Set()); }
        else setPhase('sliders');
      }, 1500);
      return;
    }
    if (qIdx < QUESTIONS.length - 1) { setQIdx(qIdx + 1); setSelected(new Set()); }
    else setPhase('sliders');
  };

  const finishSliders = () => {
    const scoreResult = calculateScore(history, sleepScore, stressScore, gutScore, ctxConditions);
    setResult(scoreResult);
    if (scoreResult.adaptiveQCount === 0) {
      setPhase('analyzing');
      setTimeout(() => onComplete(scoreResult, { gender: 'Male', age: '26–35', conditions: [], sleepScore, stressScore, gutScore, timeSpentSeconds: Math.round((Date.now() - quizStartTime.current) / 1000) }), 5500);
    } else {
      setPhase('choice');
    }
  };

  const startAdaptive = () => {
    const layerRank = [1, 2, 3, 4, 5].map(i => ({ layer: i, score: result!.sc[i] })).sort((a, b) => a.score - b.score);
    const picks: any[] = [];
    for (const lr of layerRank) {
      if (picks.length >= result!.adaptiveQCount) break;
      const bank = ADAPTIVE_BANK[lr.layer];
      const ranked = bank.map((item, idx) => ({ item, idx, score: item.disc })).sort((a, b) => b.score - a.score);
      if (ranked.length) picks.push({ layer: lr.layer, ...ranked[0].item });
    }
    let safety = 0;
    while (picks.length < result!.adaptiveQCount && safety < 20) {
      safety++;
      const lr = layerRank[picks.length % layerRank.length];
      const bank = ADAPTIVE_BANK[lr.layer];
      const alreadyPicked = picks.filter(p => p.layer === lr.layer).length;
      if (alreadyPicked < bank.length) {
        const ranked = bank.map((item, idx) => ({ item, idx, score: item.disc })).sort((a, b) => b.score - a.score);
        const next = ranked[alreadyPicked];
        if (next) picks.push({ layer: lr.layer, ...next.item });
      }
    }
    setAdaptiveQueue(picks.slice(0, result!.adaptiveQCount));
    setAdaptiveIdx(0);
    setAdaptiveSel(new Set());
    setPhase('adaptive');
  };

  const nextAdaptive = () => {
    if (adaptiveSel.size === 0) return;
    const item = adaptiveQueue[adaptiveIdx];
    const scores = Array.from(adaptiveSel).map(i => ANS_SCORES[i]);
    const worstScore = Math.min(...scores);
    const worstIdx = Array.from(adaptiveSel).reduce((a, b) => ANS_SCORES[b] < ANS_SCORES[a] ? b : a);
    const newAnswers = [...adaptiveAnswers, { layer: item.layer, score: worstScore, idx: worstIdx, selected: Array.from(adaptiveSel) }];
    setAdaptiveAnswers(newAnswers);
    if (adaptiveIdx < adaptiveQueue.length - 1) {
      setAdaptiveIdx(adaptiveIdx + 1); setAdaptiveSel(new Set());
    } else {
      const shadowSc = { ...result!.sc };
      [1, 2, 3, 4, 5].forEach(layerNum => {
        const baseEvidence = history.filter(h => h.layer === layerNum).map(h => h.score);
        const adaptiveEvidence = newAnswers.filter(a => a.layer === layerNum).map(a => a.score);
        if (adaptiveEvidence.length === 0) return;
        const all = baseEvidence.concat(adaptiveEvidence);
        const avg = all.reduce((s, v) => s + v, 0) / all.length;
        shadowSc[layerNum] = Math.round(avg * 2);
      });
      const hl = computeHiddenLayer(history, shadowSc, sleepScore, stressScore, gutScore);
      const rcs = calcRCS(history);
      const finalPattern = computePatternEngine(rcs, hl, shadowSc, result!.totalScore);
      const shadowCascadeRisk = buildCascadeRisk(shadowSc);
      const combinedRealSignal = [
        ...history.map(h => ({ layer: h.layer, ansIdx: h.ansIdx })),
        ...newAnswers.map(a => ({ layer: a.layer, ansIdx: a.idx })),
      ];
      const dominantPick = pickDominantLayer(shadowSc, hl, shadowCascadeRisk, ctxConditions, combinedRealSignal);
      const updatedResult = { ...result!, patternEngine: finalPattern, sc: shadowSc, cascadeRisk: shadowCascadeRisk, dominantLayer: dominantPick.layer, dominantLayerTiedFallback: dominantPick.tiedFallback };
      setResult(updatedResult);
      setPhase('analyzing');
      setTimeout(() => onComplete(updatedResult, { gender: 'Male', age: '26–35', conditions: [], sleepScore, stressScore, gutScore, timeSpentSeconds: Math.round((Date.now() - quizStartTime.current) / 1000) }), 5500);
    }
  };

  const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
    'badge-green': { bg: '#C0DD97', text: '#27500A', border: '#639922' },
    'badge-amber': { bg: '#FAC775', text: '#633806', border: '#CA8A04' },
    'badge-red': { bg: '#F5C4B3', text: '#4A1B0C', border: '#CC2200' },
    'badge-severe': { bg: '#F0997B', text: '#4A1B0C', border: '#993C1D' },
  };

  // === QUIZ PHASE ===
  if (phase === 'quiz') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity onPress={() => onNavigate('home')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>{qIdx + 1} / {QUESTIONS.length}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {QUESTIONS.map((_, i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= qIdx ? colors.red : colors.card }} />
              ))}
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: `${layer.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                <LayerIcon name={layer.icon} size={14} color={layer.color} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: layer.color }}>{layer.shortName.toUpperCase()}</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, lineHeight: 24 }}>{q.q}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>Select all that apply</Text>
            <View style={{ marginTop: 24, gap: 8 }}>
              {q.o.map((opt, i) => {
                const isSel = selected.has(i);
                const badge = ANSWER_BADGES[i];
                const bc = badgeColors[badge.class];
                return (
                  <TouchableOpacity key={i} onPress={() => toggleOption(i)} activeOpacity={0.95} style={{
                    padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                    backgroundColor: isSel ? `${bc.border}15` : colors.card,
                    borderWidth: 1.5, borderColor: isSel ? bc.border : colors.border,
                    borderLeftWidth: isSel ? 3 : 1.5,
                  }}>
                    <View style={{ width: 20, height: 20, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginTop: 2, backgroundColor: isSel ? bc.border : colors.bg, borderWidth: 1.5, borderColor: isSel ? bc.border : colors.textTertiary }}>
                      {isSel && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 18, color: isSel ? colors.text : colors.textSecondary }}>{opt}</Text>
                    {isSel && (
                      <View style={{ backgroundColor: bc.bg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: bc.text }}>{badge.label}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, backgroundColor: colors.bg }}>
            <TouchableOpacity onPress={nextQuestion} disabled={selected.size === 0} style={{ backgroundColor: selected.size > 0 ? colors.red : colors.card, paddingVertical: 14, borderRadius: 12, alignItems: 'center', opacity: selected.size > 0 ? 1 : 0.5 }}>
              <Text style={{ color: selected.size > 0 ? '#fff' : colors.textTertiary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>{qIdx === QUESTIONS.length - 1 ? 'Continue to Self-Assessment' : 'Continue'}</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={showMicroInsight} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(10,10,10,0.92)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: `${layer.color}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <LayerIcon name={layer.icon} size={28} color={layer.color} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' }}>{layer.name} is showing signals</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>Your pattern is becoming clearer</Text>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  }

  // === SLIDERS PHASE ===
  if (phase === 'sliders') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => { setPhase('quiz'); setQIdx(QUESTIONS.length - 1); setSelected(new Set(history[history.length - 1]?.selected || [])); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>Self-Assessment</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, lineHeight: 24 }}>How would you rate your overall sleep, stress, and gut health?</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>Be honest — this calibrates your result.</Text>

            <SliderCard label="Sleep Quality" value={sleepScore} setValue={setSleepScore} min1Color="#EF4444" midColor="#F59E0B" maxColor="#22C55E" labels={{ min: 'Poor', max: 'Excellent' }} good="high" colors={colors} />
            <SliderCard label="Stress Level" value={stressScore} setValue={setStressScore} min1Color="#22C55E" midColor="#F59E0B" maxColor="#EF4444" labels={{ min: 'Calm', max: 'Overwhelmed' }} good="low" colors={colors} />
            <SliderCard label="Gut Health" value={gutScore} setValue={setGutScore} min1Color="#EF4444" midColor="#F59E0B" maxColor="#22C55E" labels={{ min: 'Poor', max: 'Excellent' }} good="high" colors={colors} />
          </ScrollView>

          <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, backgroundColor: colors.bg }}>
            <TouchableOpacity onPress={finishSliders} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>See My Results</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // === CHOICE PHASE ===
  if (phase === 'choice' && result) {
    return (
      <ScrollScreen bg={colors.bg} bottomPad={40}>
        <View style={{ paddingHorizontal: 24, paddingTop: 80, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Ionicons name="sparkles" size={28} color={colors.red} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' }}>Your pattern needs refinement</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12, textAlign: 'center', lineHeight: 20 }}>We have a preliminary read on your metabolic pattern, but a few more questions could make it significantly more precise.</Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 16 }}>Confidence: {result.confidence.pct}% · {result.adaptiveQCount} questions needed</Text>
          <View style={{ marginTop: 32, width: '100%', gap: 12 }}>
            <TouchableOpacity onPress={startAdaptive} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Make it more precise ({result.adaptiveQCount} questions)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPhase('analyzing'); setTimeout(() => onComplete(result, { gender: 'Male', age: '26–35', conditions: [], sleepScore, stressScore, gutScore, timeSpentSeconds: Math.round((Date.now() - quizStartTime.current) / 1000) }), 5500); }} style={{ backgroundColor: colors.card, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>See my result now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollScreen>
    );
  }

  // === ADAPTIVE PHASE ===
  if (phase === 'adaptive' && adaptiveQueue.length > 0) {
    const aq = adaptiveQueue[adaptiveIdx];
    const aLayer = LAYERS[aq.layer - 1];
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>Refinement · {adaptiveIdx + 1} / {adaptiveQueue.length}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {adaptiveQueue.map((_, i) => (
                  <View key={i} style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: i <= adaptiveIdx ? colors.red : colors.card }} />
                ))}
              </View>
            </View>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: `${aLayer.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                <LayerIcon name={aLayer.icon} size={14} color={aLayer.color} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: aLayer.color }}>{aLayer.shortName.toUpperCase()}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text, lineHeight: 22 }}>{aq.q}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>Select all that apply</Text>
            <View style={{ marginTop: 20, gap: 8 }}>
              {aq.o.map((opt: string, i: number) => {
                const isSel = adaptiveSel.has(i);
                return (
                  <TouchableOpacity key={i} onPress={() => { const ns = new Set(adaptiveSel); if (ns.has(i)) ns.delete(i); else ns.add(i); setAdaptiveSel(ns); }} activeOpacity={0.95} style={{
                    padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                    backgroundColor: isSel ? `${colors.red}14` : colors.card,
                    borderWidth: 1.5, borderColor: isSel ? colors.red : colors.border,
                  }}>
                    <View style={{ width: 20, height: 20, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginTop: 2, backgroundColor: isSel ? colors.red : colors.bg, borderWidth: 1.5, borderColor: isSel ? colors.red : colors.textTertiary }}>
                      {isSel && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: isSel ? colors.text : colors.textSecondary }}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, backgroundColor: colors.bg }}>
            <TouchableOpacity onPress={nextAdaptive} disabled={adaptiveSel.size === 0} style={{ backgroundColor: adaptiveSel.size > 0 ? colors.red : colors.card, paddingVertical: 14, borderRadius: 12, alignItems: 'center', opacity: adaptiveSel.size > 0 ? 1 : 0.5 }}>
              <Text style={{ color: adaptiveSel.size > 0 ? '#fff' : colors.textTertiary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>{adaptiveIdx === adaptiveQueue.length - 1 ? 'See My Results' : 'Continue'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // === ANALYZING PHASE — Cinematic, driven by the user's own answers ===
  const currentSignal = cinemaSteps.length > 0 ? cinemaSteps[Math.min(cinemaStep, cinemaSteps.length - 1)] : { name: 'Analyzing', color: colors.red, signal: 'Processing...' };
  return (
    <ScreenShell bg={colors.bg}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Layer progress dots */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
          {LAYERS.map((layer) => {
            const layerStepIdx = cinemaSteps.findIndex(s => s.color === layer.color && s.name === (layer.shortName.split(' \u2014 ')[1] || layer.key));
            const lit = layerStepIdx >= 0 && cinemaStep > layerStepIdx;
            return (
              <View key={layer.id} style={{ alignItems: 'center', gap: 6 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: lit ? `${layer.color}20` : `${colors.border}40`,
                  borderWidth: 1.5,
                  borderColor: lit ? layer.color : colors.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <LayerIcon name={layer.icon} size={18} color={lit ? layer.color : colors.textTertiary} />
                </View>
                {lit && (<View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: layer.color }} />)}
              </View>
            );
          })}
        </View>

        {/* Answer/signal text */}
        <Text key={cinemaStep} style={{ fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 22 }}>
          {currentSignal.signal}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: currentSignal.color, marginTop: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {currentSignal.name}
        </Text>

        {/* Bottom progress bar */}
        <View style={{ width: '100%', height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 32, overflow: 'hidden' }}>
          <View style={{ width: `${(cinemaStep / Math.max(cinemaSteps.length, 1)) * 100}%`, height: '100%', backgroundColor: colors.red, borderRadius: 2 }} />
        </View>
        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 8 }}>{cinemaStep}/{cinemaSteps.length} steps</Text>
      </View>
    </ScreenShell>
  );
}

// Helper: Slider card
function SliderCard({ label, value, setValue, min1Color, midColor, maxColor, labels, good, colors }: {
  label: string; value: number; setValue: (v: number) => void;
  min1Color: string; midColor: string; maxColor: string;
  labels: { min: string; max: string }; good: 'high' | 'low'; colors: ThemeColors;
}) {
  const isGood = good === 'high' ? value >= 8 : value <= 4;
  const isMid = good === 'high' ? value >= 6 : value <= 6;
  const color = isGood ? maxColor : isMid ? midColor : min1Color;
  const ratingText = good === 'high'
    ? value >= 9 ? 'Excellent' : value >= 7 ? 'Fairly good' : value >= 5 ? 'Fair' : value >= 3 ? 'Poor' : 'Very poor'
    : value <= 2 ? 'Very low' : value <= 4 ? 'Low' : value <= 6 ? 'Fair' : value <= 8 ? 'High' : 'Very high';
  return (
    <View style={{ marginTop: 16, borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color }}>{value}</Text>
          <Text style={{ fontSize: 10, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 1 }}>{ratingText}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={() => setValue(Math.max(1, value - 1))} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="remove" size={16} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden', position: 'relative' }}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(value / 10) * 100}%`, backgroundColor: color, borderRadius: 4 }} />
        </View>
        <TouchableOpacity onPress={() => setValue(Math.min(10, value + 1))} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginHorizontal: 40 }}>
        <Text style={{ fontSize: 10, color: colors.textTertiary }}>{labels.min}</Text>
        <Text style={{ fontSize: 10, color: colors.textTertiary }}>{labels.max}</Text>
      </View>
    </View>
  );
}

function PulseIcon({ name, size, color, bgColor }: { name: string; size: number; color: string; bgColor: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.1, duration: 750, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(scale, { toValue: 1, duration: 750, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
      <Ionicons name={name as any} size={size} color={color} />
    </Animated.View>
  );
}

function PulseDot({ delay, color }: { delay: number; color: string }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity }} />;
}

// ============================================================
// RESULTS SCREEN
// ============================================================

function ResultsScreen({ onNavigate, result, userData, autoExpandN3, onSelectLayer }: { onNavigate: (s: ScreenId) => void; result: ScoreResult; userData: UserData; autoExpandN3?: boolean; onSelectLayer?: (id: number) => void }) {
  const [rating, setRating] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);
  const [localReveal, setLocalReveal] = useState(false);
  const { colors } = useTheme();
  const { clinicalDepth, toggleClinicalDepth } = useClinicalDepth();
  const { saveNpsRating } = useAppData();
  const shareCardRef = useRef<ViewShot>(null);
  const shareScoreImage = async () => {
    try {
      const uri = await shareCardRef.current?.capture?.();
      if (uri && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Share your Metabolic Score' });
      } else if (uri) {
        Alert.alert('Sharing not available on this device');
      }
    } catch (e) {
      Alert.alert('Could not create share image', 'Please try again.');
    }
  };
  const copyShareLink = async () => {
    await Clipboard.setStringAsync('https://amitbaruna.com');
    Alert.alert('Link copied');
  };
  const [animatedScore, setAnimatedScore] = useState(0);
  const [n1, setN1] = useState<string | null>(null);
  const [n2, setN2] = useState<string | null>(null);
  const [n3, setN3] = useState<{ title: string; body: string } | null>(null);
  const [loadingN, setLoadingN] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const n3CardY = useRef(0);

  // Load rating state from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('ms_nps_rated');
        if (saved === 'true') setRatingDone(true);
      } catch (e) {}
    })();
  }, []);

  const handleRating = (n: number) => {
    if (ratingDone) return;
    setRating(n);
    saveNpsRating(n, { total_score: result?.totalScore, dominant_layer: result?.dominantLayer }).catch(() => {});
    setTimeout(() => {
      setRatingDone(true);
      AsyncStorage.setItem('ms_nps_rated', 'true').catch(() => {});
    }, 2500);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedScore(prev => {
        if (prev >= result.totalScore) { clearInterval(interval); return result.totalScore; }
        return Math.min(result.totalScore, prev + 2);
      });
    }, 30);
    return () => clearInterval(interval);
  }, [result.totalScore]);

  // Auto-expand N3 (Where to Begin) when navigated from hope signal
  useEffect(() => {
    if (autoExpandN3) {
      const timer = setTimeout(() => {
        setExpandedCard('n3');
      }, 1500); // Wait for score animation + N3 to load
      return () => clearTimeout(timer);
    }
  }, [autoExpandN3]);

  useEffect(() => {
    const fetchAll = async () => {
      // Phase 2B: Local narrative engine (instant, free — no Claude API)
      setLoadingN('n1'); setN1(generateLocalN1(result, userData)); setLoadingN(null);
      setLoadingN('n2'); setN2(generateLocalN2(result, userData, result.history, QUESTIONS)); setLoadingN(null);
      setLoadingN('n3'); setN3(generateLocalN3(result, userData)); setLoadingN(null);
    };
    fetchAll();
  }, [result]);

  const band = result.band;
  // Band-aware qualitative framing — matches the four real score bands from getBand(), not one
  // static message shown regardless of whether the score is 15 or 85.
  const qualitativeBand = (() => {
    switch (band.status) {
      case 'Well Regulated':
        return { icon: 'checkmark-circle' as const, headline: 'Your body is largely working with you right now', subtext: 'That doesn\'t mean nothing needs attention — just that your systems aren\'t actively fighting you.' };
      case 'Early Dysfunction':
        return { icon: 'alert-circle' as const, headline: 'A few of your systems may be under some strain', subtext: 'Nothing severe yet — this is often the easiest window to make a real difference.' };
      case 'Metabolic Friction Present':
        return { icon: 'shield' as const, headline: 'Your body is working hard to protect itself right now', subtext: 'That\'s likely why fat loss has felt stuck — not a discipline problem.' };
      default: // Significant Metabolic Impairment
        return { icon: 'shield' as const, headline: 'Your body may be under significant strain right now', subtext: 'This is worth taking seriously and working through step by step, not all at once.' };
    }
  })();
  const dominantLayer = LAYERS[result.dominantLayer - 1];
  const dominantLayers = [1, 2, 3, 4, 5].filter(i => result.sc[i] <= 11);
  const matchedCases = CASE_STUDIES.filter(cs => (CASE_LAYER_MAP[cs.id] || []).some(l => dominantLayers.includes(l))).slice(0, 3);

  const avail = result.history.reduce((sum, h) => {
    const pts = [0, 3, 3, 5, 4][h.ansIdx] || 0;
    return sum + pts;
  }, 0);
  const weeks = result.totalScore <= 30 ? '10–14' : result.totalScore <= 50 ? '8–12' : '6–10';

  const toggleCard = (id: string) => setExpandedCard(expandedCard === id ? null : id);

  // PIPELINE 3: Retest countdown — days remaining until next retest is recommended.
  // Uses NEXT_ASSESSMENT_DAYS as a mock for "days remaining since last test" (14 - daysSinceLastTest).
  const retestDaysRemaining = NEXT_ASSESSMENT_DAYS; // mock: 11 days left

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      {/* Back button */}
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* PIPELINE 3: Retest countdown banner */}
      <View style={{ paddingHorizontal: 24 }}>
        <View style={{ borderRadius: 16, padding: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.amber}40`, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.amber}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time" size={18} color={colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Retake available in {retestDaysRemaining} days</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>We recommend waiting 14 days between assessments for accurate change tracking.</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('score')} style={{ backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>Retake Anyway</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Gauge section */}
      <View style={{ backgroundColor: '#0D1B2A', paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', marginTop: 16 }}>
        {clinicalDepth || localReveal ? (
          <>
            <Text style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Metabolic Permission Score</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
              <Text style={{ fontSize: 60, fontWeight: '900', color: band.color }}>{animatedScore}</Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>/100</Text>
            </View>
            <View style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4, backgroundColor: band.color }}>
              <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1, color: '#fff', textTransform: 'uppercase' }}>{band.status}</Text>
            </View>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>{band.label}</Text>
            {/* Only reachable when localReveal is what's showing this (Clinical Depth itself is
                off) — a quiet way back to simple mode without needing Profile or Home. Doesn't
                touch the global setting, same as the reveal button never did. */}
            {!clinicalDepth && (
              <TouchableOpacity onPress={() => setLocalReveal(false)} style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Back to simple view</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${band.color}25`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name={qualitativeBand.icon} size={26} color={band.color} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#fff', textAlign: 'center', lineHeight: 24, maxWidth: 280 }}>{qualitativeBand.headline}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8, maxWidth: 280, lineHeight: 19 }}>{qualitativeBand.subtext}</Text>
            {/* Local, temporary reveal only — never touches the persistent Clinical Depth
                setting. That switch now lives in exactly two places (the Home pad, Profile
                settings) and this button must not be a silent third way to flip it. */}
            <TouchableOpacity onPress={() => setLocalReveal(true)} style={{ marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="stats-chart" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>Show me the exact numbers</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* The one unmissable moment — not collapsible, not optional. Everything else in this
          screen is behind a tap; this is the one sentence that has to land regardless. */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <View style={{ borderRadius: 16, padding: 18, backgroundColor: `${dominantLayer.color}14`, borderLeftWidth: 3, borderLeftColor: dominantLayer.color }}>
          <Text style={{ fontSize: 14, lineHeight: 21, color: colors.text, fontWeight: '500' }}>
            <Text style={{ fontWeight: '700', color: dominantLayer.color }}>{clinicalDepth ? dominantLayer.name : (LAYER_PLAIN[result.dominantLayer - 1].charAt(0).toUpperCase() + LAYER_PLAIN[result.dominantLayer - 1].slice(1))}</Text> may be why fat loss has felt stuck — not a discipline problem. Right now, {result.rcsInfo.compPct}% of your body's effort may be going toward protection instead of adaptation.
          </Text>
        </View>
      </View>

      {/* Fat Loss Resistance */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <TouchableOpacity onPress={() => toggleCard('resistance')} activeOpacity={0.99} style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${result.rcsInfo.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="lock-closed" size={18} color={result.rcsInfo.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: result.rcsInfo.color, textTransform: 'uppercase' }}>Fat Loss Resistance</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>{result.rcsInfo.compPct}% · {result.rcsInfo.label}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} style={{ transform: [{ rotate: expandedCard === 'resistance' ? '180deg' : '0deg' }] }} />
          </View>
          {expandedCard === 'resistance' && (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: result.rcsInfo.color, width: `${result.rcsInfo.readyPct}%` }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>{result.rcsInfo.readyPct}% Ready</Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>{result.rcsInfo.compPct}% Resistance</Text>
              </View>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 12 }}>
                {loadingN === 'n1' ? 'Generating your personalised result...' : n1}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Layer Breakdown */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <TouchableOpacity onPress={() => toggleCard('layers')} activeOpacity={0.99} style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="layers" size={18} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>Layer Breakdown</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>5 Layers · Dominant: {dominantLayer.name}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} style={{ transform: [{ rotate: expandedCard === 'layers' ? '180deg' : '0deg' }] }} />
          </View>
          {expandedCard === 'layers' && (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
              {LAYERS.map(layer => {
                const sc = result.sc[layer.id];
                const isActive = sc <= 11;
                const isDominant = layer.id === result.dominantLayer;
                const col = sc >= 14 ? '#639922' : sc >= 9 ? '#BA7517' : '#E24B4A';
                return (
                  <TouchableOpacity key={layer.id} onPress={() => { if (onSelectLayer) { onSelectLayer(layer.id); onNavigate('layer-detail'); } }} activeOpacity={0.95} style={{ borderRadius: 12, padding: 12, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: isDominant ? `${colors.red}40` : colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${layer.color}1F`, alignItems: 'center', justifyContent: 'center' }}><LayerIcon name={layer.icon} size={12} color={layer.color} /></View>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>{layer.name}</Text>
                        {isActive && <View style={{ backgroundColor: '#F5C4B3', borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1 }}><Text style={{ fontSize: 7, fontWeight: '700', color: '#4A1B0C' }}>ACTIVE</Text></View>}
                        {isDominant && <View style={{ backgroundColor: colors.red, borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1 }}><Text style={{ fontSize: 7, fontWeight: '700', color: '#fff' }}>DOM</Text></View>}
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: col }}>{sc}/20</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.card, overflow: 'hidden', marginTop: 8 }}><View style={{ height: 6, borderRadius: 3, backgroundColor: col, width: `${(sc / 20) * 100}%` }} /></View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* N2 — Hidden Mechanism */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <TouchableOpacity onPress={() => toggleCard('n2')} activeOpacity={0.99} style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chatbubble" size={18} color={colors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>Hidden Mechanism</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>Why you're stuck — and what's actually happening</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} style={{ transform: [{ rotate: expandedCard === 'n2' ? '180deg' : '0deg' }] }} />
          </View>
          {expandedCard === 'n2' && (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              {loadingN === 'n2' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>{[0, 1, 2].map(i => <PulseDot key={i} delay={i * 200} color={colors.red} />)}</View>
                  <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.textSecondary }}>Reading your biological pattern...</Text>
                </View>
              ) : n2 ? (
                <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>{n2}</Text>
              ) : (
                <Text style={{ fontSize: 13, fontStyle: 'italic', color: colors.textSecondary }}>Your body is showing {result.rcsInfo.compPct}% resistance signals. The {dominantLayer.name} layer is your primary bottleneck — addressing it first will create the biggest shift.</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* N3 — Where to Begin */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <TouchableOpacity onPress={() => toggleCard('n3')} activeOpacity={0.99} style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="rocket" size={18} color={colors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>Where to begin</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>Your first step</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} style={{ transform: [{ rotate: expandedCard === 'n3' ? '180deg' : '0deg' }] }} />
          </View>
          {expandedCard === 'n3' && (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              {loadingN === 'n3' ? (
                <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.textSecondary }}>Finding your first step...</Text>
              ) : n3 ? (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>{n3.title}</Text>
                  <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{n3.body}</Text>
                </>
              ) : (
                <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>Start with your {dominantLayer.name} layer. Small daily actions compound into score changes within 2 weeks.</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Matched Case Studies */}
      {matchedCases.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, paddingHorizontal: 24, marginBottom: 12 }}>Real cases, matched to your pattern</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
            {matchedCases.map(cs => (
              <TouchableOpacity key={cs.id} onPress={() => onNavigate('cases')} activeOpacity={0.98} style={{ width: 224, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
                <View style={{ height: 120, position: 'relative' }}>
                  <Image source={cs.photo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} /></View>
                  </View>
                </View>
                <View style={{ padding: 12 }}>
                  <Text style={{ fontSize: 9, color: colors.red, fontWeight: '700' }}>{cs.result.split('·')[0]}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Relevant Videos — matched to dominant layer */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, paddingHorizontal: 24, marginBottom: 12 }}>Relevant Videos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
          {VIDEOS.filter(v => v.layer === result.dominantLayer || dominantLayers.includes(v.layer)).length > 0
            ? VIDEOS.filter(v => v.layer === result.dominantLayer || dominantLayers.includes(v.layer)).map(v => (
                <View key={v.id} style={{ width: 176, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
                  <View style={{ height: 96, justifyContent: 'center', alignItems: 'center' }}>
                    <LinearGradient colors={v.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} /></View>
                      <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{v.duration}</Text></View>
                    </LinearGradient>
                  </View>
                  <View style={{ padding: 10 }}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.text, lineHeight: 14 }} numberOfLines={2}>{v.title}</Text></View>
                </View>
              ))
            : VIDEOS.slice(0, 3).map(v => (
                <View key={v.id} style={{ width: 176, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
                  <View style={{ height: 96, justifyContent: 'center', alignItems: 'center' }}>
                    <LinearGradient colors={v.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} /></View>
                      <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{v.duration}</Text></View>
                    </LinearGradient>
                  </View>
                  <View style={{ padding: 10 }}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.text, lineHeight: 14 }} numberOfLines={2}>{v.title}</Text></View>
                </View>
              ))
          }
        </ScrollView>
      </View>

      {/* Hope Signal — Fat Loss Resistance + Points Available */}
      <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
        <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: `${getResistanceColor(result.rcsInfo.compPct)}30` }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="lock-closed" size={16} color={getResistanceColor(result.rcsInfo.compPct)} />
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: getResistanceColor(result.rcsInfo.compPct), textTransform: 'uppercase' }}>Fat loss resistance & potential</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: getResistanceColor(result.rcsInfo.compPct) }}>{result.rcsInfo.compPct}%</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>fat loss resistance</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>{result.rcsInfo.label} · {getResistanceTier(result.rcsInfo.compPct)} resistance</Text>
          <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#22C55E' }}>+{avail}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>points may be available over {weeks} weeks</Text>
            </View>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>Lowering your resistance may unlock <Text style={{ fontWeight: '600', color: '#22C55E' }}>+{avail} points</Text> of recovery capacity over roughly <Text style={{ fontWeight: '600', color: colors.text }}>{weeks} weeks</Text>, with the right intervention sequence.</Text>
          </View>
        </View>
      </View>

      {/* Share Card */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }} style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: '#0D1B2A' }}>
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 8 }}>Metabolic Score™</Text>
            <Text style={{ fontSize: 48, fontWeight: '900', color: band.color, marginBottom: 4 }}>{animatedScore}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>/100</Text>
            <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: band.color, marginBottom: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#fff', textTransform: 'uppercase' }}>{band.status}</Text>
            </View>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Pattern: {result.patternEngine.dominant_pattern}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>amitbaruna.com/metabolic-score</Text>
          </View>
        </ViewShot>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity onPress={shareScoreImage} style={{ flex: 1, backgroundColor: '#25D366', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={copyShareLink} style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="checkmark" size={16} color={colors.red} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Copy Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Emoji Rating */}
      {!ratingDone && (
        <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
          <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 }}>Does this feel like you?</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 12 }}>Your honest rating helps us improve.</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <TouchableOpacity key={n} onPress={() => handleRating(n)} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: rating === n ? colors.red : colors.bg }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: rating === n ? '#fff' : colors.textSecondary }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && <Text style={{ fontSize: 12, color: colors.green, marginTop: 8, textAlign: 'center' }}>✓ Thanks for your feedback!</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>Not at all</Text>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>Spot on</Text>
            </View>
          </View>
        </View>
      )}

      {/* Disclaimer */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: colors.card }}>
          <Text style={{ fontSize: 10, lineHeight: 16, color: colors.textTertiary, textAlign: 'center' }}>{DISCLAIMER}</Text>
        </View>
      </View>

      {/* CTAs */}
      <View style={{ paddingHorizontal: 24, marginTop: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => onNavigate('report')} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.red}40`, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="document-text" size={16} color={colors.red} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Download Full Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNavigate('booking')} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="calendar" size={16} color="#fff" />
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5 }}>Book a Call with Amit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNavigate('home')} style={{ paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollScreen>
  );
}

// ============================================================
// LAYERS HUB SCREEN
// ============================================================

function LayersHubScreen({ onNavigate, onSelectLayer, hasScore, scoreResult }: { onNavigate: (s: ScreenId) => void; onSelectLayer?: (id: number) => void; hasScore?: boolean; scoreResult?: any }) {
  const { colors } = useTheme();
  const { clinicalDepth } = useClinicalDepth();
  const { scoreHistory } = useAppData();
  // Fall back to the latest persisted assessment when scoreResult hasn't been set yet this
  // session (e.g. signed in without retaking the quiz) — same pattern as HomeScreen's
  // fallbackLayerScores/dominantLayerId.
  const latestHistory = scoreHistory[0];
  const fallbackLayerScores = latestHistory
    ? { 1: latestHistory.layer1, 2: latestHistory.layer2, 3: latestHistory.layer3, 4: latestHistory.layer4, 5: latestHistory.layer5 }
    : null;
  const layerScores: Record<number, number> = scoreResult?.sc ?? fallbackLayerScores ?? {};
  const dominantLayerId = scoreResult?.dominantLayer ?? latestHistory?.dominant_layer ?? null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>{clinicalDepth ? 'The 5 Layers' : 'Your 5 systems'}</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{clinicalDepth ? 'The foundational systems that determine your metabolic health.' : 'Tap any to learn more.'}</Text>
          </View>
          <View style={{ paddingHorizontal: 24, gap: 16 }}>
            {LAYERS.map(layer => {
              const ls = layerScores[layer.id];
              const hasChip = typeof ls === 'number';
              const isDominant = hasScore && layer.id === dominantLayerId;
              const needsAttention = hasChip && ls <= 11;
              const sc = !hasChip ? colors.textTertiary : ls >= 14 ? '#22C55E' : ls >= 9 ? '#F59E0B' : '#EF4444';
              const displayName = clinicalDepth ? layer.name : (LAYER_PLAIN[layer.id - 1].charAt(0).toUpperCase() + LAYER_PLAIN[layer.id - 1].slice(1));
              const qualitativeStatus = !hasChip ? null : isDominant ? 'This is your main focus right now' : needsAttention ? 'Needs some attention' : 'Holding up well';
              return (
              <TouchableOpacity key={layer.id} onPress={() => { if (onSelectLayer) { onSelectLayer(layer.id); } }} activeOpacity={0.99} style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: !clinicalDepth && isDominant ? `${colors.red}14` : colors.card, borderTopWidth: 3, borderTopColor: colors.red }}>
                <View style={{ padding: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <LayerIcon name={layer.icon} size={20} color={layer.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{displayName}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{clinicalDepth ? layer.tagline : (qualitativeStatus || layer.tagline)}</Text>
                    </View>
                    {clinicalDepth ? (
                      hasChip ? (
                        <View style={{ backgroundColor: `${sc}1F`, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: sc }}>{ls}/20</Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>0{layer.id}</Text>
                      )
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    )}
                  </View>
                  {clinicalDepth && <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 18 }} numberOfLines={2}>{layer.description}</Text>}
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <BottomNav active="layers" onNavigate={onNavigate} hasScore={hasScore} />
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// LAYER DETAIL SCREEN
// ============================================================

function LayerDetailScreen({ onNavigate, layerId, onSelectArticle }: { onNavigate: (s: ScreenId) => void; layerId: number; onSelectArticle?: (a: Insight) => void }) {
  const { colors } = useTheme();
  const { clinicalDepth } = useClinicalDepth();
  const layer = LAYERS[layerId - 1] || LAYERS[0];
  const displayName = clinicalDepth ? layer.name : (LAYER_PLAIN[layer.id - 1].charAt(0).toUpperCase() + LAYER_PLAIN[layer.id - 1].slice(1));
  const content = LAYER_CONTENT[layer.id];
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded(expanded === id ? null : id);

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <TouchableOpacity onPress={() => onNavigate('layers')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: `${layer.color}25`, alignItems: 'center', justifyContent: 'center' }}>
          <LayerIcon name={layer.icon} size={32} color={layer.color} />
        </View>
        {clinicalDepth && <Text style={{ fontSize: 14, fontWeight: '900', color: layer.color, marginTop: 16 }}>LAYER {layer.id}</Text>}
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, marginTop: clinicalDepth ? 4 : 16, textTransform: 'uppercase' }}>{displayName}</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>{layer.tagline}</Text>
      </View>

      {/* Why it matters */}
      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <View style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="sparkles" size={16} color={layer.color} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'uppercase' }}>Why it matters</Text>
          </View>
          <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{layer.description}</Text>
        </View>
      </View>

      {/* Signs */}
      <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
        <TouchableOpacity onPress={() => toggle('signs')} activeOpacity={0.99} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark" size={16} color={layer.color} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'uppercase' }}>Signs to look for</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} style={{ transform: [{ rotate: expanded === 'signs' ? '180deg' : '0deg' }] }} />
          </View>
          {expanded !== 'signs' && <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 8 }}>Tap to see thriving vs struggling signs →</Text>}
          {expanded === 'signs' && (
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, borderRadius: 12, padding: 12, backgroundColor: colors.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}><Ionicons name="checkmark" size={12} color="#22C55E" /><Text style={{ fontSize: 9, fontWeight: '700', color: '#22C55E' }}>THRIVING</Text></View>
                {content.signs.good.map(s => <Text key={s} style={{ fontSize: 11, color: colors.textSecondary, marginVertical: 2 }}>• {s}</Text>)}
              </View>
              <View style={{ flex: 1, borderRadius: 12, padding: 12, backgroundColor: colors.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}><Ionicons name="warning" size={12} color="#EF4444" /><Text style={{ fontSize: 9, fontWeight: '700', color: '#EF4444' }}>STRUGGLING</Text></View>
                {content.signs.bad.map(s => <Text key={s} style={{ fontSize: 11, color: colors.textSecondary, marginVertical: 2 }}>• {s}</Text>)}
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Practices */}
      <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
        <TouchableOpacity onPress={() => toggle('practices')} activeOpacity={0.99} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="rocket" size={16} color={layer.color} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'uppercase' }}>Practices that move the needle</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} style={{ transform: [{ rotate: expanded === 'practices' ? '180deg' : '0deg' }] }} />
          </View>
          {expanded !== 'practices' && <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 8 }}>{content.practices.length} practices · tap to expand →</Text>}
          {expanded === 'practices' && (
            <View style={{ marginTop: 16, gap: 12 }}>
              {content.practices.map(p => (
                <View key={p.title} style={{ borderRadius: 12, padding: 12, backgroundColor: colors.bg }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${layer.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="checkmark" size={14} color={layer.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{p.title}</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 16 }}>{p.desc}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Articles */}
      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Ionicons name="document-text" size={16} color={layer.color} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'uppercase' }}>Articles for this layer</Text>
        </View>
        <View style={{ gap: 12 }}>
          {content.articles.map(a => {
            const matched = INSIGHTS.find(i => i.title === a.title && i.body);
            return (
            <TouchableOpacity key={a.title} activeOpacity={matched ? 0.99 : 1} onPress={() => matched && onSelectArticle && onSelectArticle(matched)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, backgroundColor: colors.card, opacity: matched ? 1 : 0.6 }}>
              <LinearGradient colors={[layer.color, `${layer.color}80`]} style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                <LayerIcon name={layer.icon} size={18} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 17 }}>{a.title}</Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>{matched ? a.read : 'Coming soon'}</Text>
              </View>
              {matched && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
            </TouchableOpacity>
          ); })}
        </View>
      </View>

      {/* Videos */}
      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Ionicons name="play" size={16} color={layer.color} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'uppercase' }}>Videos for this layer</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {content.videos.map(v => (
            <TouchableOpacity key={v.title} activeOpacity={0.98} style={{ width: 176, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
              <View style={{ height: 96, justifyContent: 'center', alignItems: 'center' }}>
                <LinearGradient colors={[layer.color, `${layer.color}80`]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
                  </View>
                  <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{v.duration}</Text>
                  </View>
                </LinearGradient>
              </View>
              <View style={{ padding: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text, lineHeight: 14 }}>{v.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 8 }}>Synced from Instagram · @amitbaruna</Text>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <TouchableOpacity onPress={() => onNavigate('booking')} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Book a Call with Amit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(BRAND.instagram)} style={{ marginTop: 16, padding: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Follow on Instagram <Text style={{ color: colors.red, fontWeight: '600' }}>@amitbaruna</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollScreen>
  );
}

// ============================================================
// LIBRARY SCREEN
// ============================================================

// ============================================================
// ARTICLE READER SCREEN
// ============================================================

function ArticleReaderScreen({ onNavigate, article }: { onNavigate: (s: ScreenId) => void; article: Insight | null }) {
  const { colors } = useTheme();
  const [fontScale, setFontScale] = useState(1);
  if (!article) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <TouchableOpacity onPress={() => onNavigate('library')} style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: colors.card }}><Text style={{ color: colors.text }}>Back to Library</Text></TouchableOpacity>
      </View>
    );
  }
  const layer = article.layer ? LAYERS[article.layer - 1] : null;
  const baseSize = 15 * fontScale;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <View style={{ height: 180, position: 'relative' }}>
            <LinearGradient colors={article.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {layer && <LayerIcon name={layer.icon} size={40} color="rgba(255,255,255,0.9)" />}
            </LinearGradient>
            <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={['top']}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 12 }}>
                <TouchableOpacity onPress={() => onNavigate('library')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Ionicons name="headset" size={12} color="rgba(255,255,255,0.85)" />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Voice — coming in v1.1</Text>
                </View>
              </View>
            </SafeAreaView>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
            {layer && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 8, backgroundColor: `${layer.color}20`, alignItems: 'center', justifyContent: 'center' }}><LayerIcon name={layer.icon} size={12} color={layer.color} /></View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: layer.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>L{layer.id} · {layer.name}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>{article.category}</Text>
              <Text style={{ fontSize: 10, color: colors.textTertiary }}>·</Text>
              <Text style={{ fontSize: 10, color: colors.textTertiary }}>{article.readTime} read</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 29 }}>{article.title}</Text>

            {/* Font size control */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 12, padding: 10, marginTop: 18 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>Text size</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[{ label: 'Default', v: 1 }, { label: '+15%', v: 1.15 }, { label: '+30%', v: 1.3 }].map(opt => (
                  <TouchableOpacity key={opt.label} onPress={() => setFontScale(opt.v)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: fontScale === opt.v ? colors.red : 'transparent', borderWidth: 1, borderColor: fontScale === opt.v ? colors.red : colors.border }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: fontScale === opt.v ? '#fff' : colors.textSecondary }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 20 }}>
              {article.body ? article.body.map((block, i) => (
                block.type === 'callout' ? (
                  <View key={i} style={{ backgroundColor: colors.card, borderLeftWidth: 3, borderLeftColor: layer?.color || colors.red, borderTopRightRadius: 10, borderBottomRightRadius: 10, padding: 14, marginBottom: 14 }}>
                    <Text style={{ fontSize: baseSize - 1, lineHeight: (baseSize - 1) * 1.55, color: colors.text, fontWeight: '600' }}>{block.text}</Text>
                  </View>
                ) : (
                  <Text key={i} style={{ fontSize: baseSize, lineHeight: baseSize * 1.65, color: colors.textSecondary, marginBottom: 14 }}>{block.text}</Text>
                )
              )) : <Text style={{ fontSize: baseSize, lineHeight: baseSize * 1.65, color: colors.textSecondary }}>This article is coming soon.</Text>}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.red }}>AB</Text>
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Amit Baruna</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>@amitbaruna</Text>
              </View>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LibraryScreen({ onNavigate, hasScore, scoreResult, onSelectArticle }: { onNavigate: (s: ScreenId) => void; hasScore?: boolean; scoreResult?: any; onSelectArticle?: (a: Insight) => void }) {
  const { colors } = useTheme();
  const { scoreHistory, conditions: userConditions } = useAppData();
  const [activeTab, setActiveTab] = useState<'foryou' | 'all' | 'articles' | 'cases' | 'videos' | 'transformations'>('all');
  const latestScore = scoreHistory[0] || (scoreResult ? { layer1: scoreResult.sc?.[1], layer2: scoreResult.sc?.[2], layer3: scoreResult.sc?.[3], layer4: scoreResult.sc?.[4], layer5: scoreResult.sc?.[5] } : null);
  const userLayerScores: Record<number, number> = latestScore ? { 1: latestScore.layer1, 2: latestScore.layer2, 3: latestScore.layer3, 4: latestScore.layer4, 5: latestScore.layer5 } : {};
  const hasUserScores = userLayerScores[1] != null;
  const dominantLayerId = hasUserScores ? [1, 2, 3, 4, 5].reduce((best, i) => (userLayerScores[i] ?? 20) < (userLayerScores[best] ?? 20) ? i : best, 1) : null;
  const activeLayers = hasUserScores ? Array.from(new Set([...[1, 2, 3, 4, 5].filter(i => userLayerScores[i] <= 11), ...(dominantLayerId ? [dominantLayerId] : [])])) : [];
  useEffect(() => { if (hasUserScores && activeTab === 'all') setActiveTab('foryou'); }, [hasUserScores]);
  const tabs = [
    ...(hasUserScores ? [{ id: 'foryou' as const, label: 'For You' }] : []),
    { id: 'all' as const, label: 'All' }, { id: 'articles' as const, label: 'Articles' }, { id: 'cases' as const, label: 'Case Studies' },
    { id: 'videos' as const, label: 'Videos' }, { id: 'transformations' as const, label: 'Transformations' },
  ];
  const showForYou = activeTab === 'foryou';
  const showCases = !showForYou && (activeTab === 'all' || activeTab === 'cases');
  const showVideos = !showForYou && (activeTab === 'all' || activeTab === 'videos');
  const showTransformations = !showForYou && (activeTab === 'all' || activeTab === 'transformations');
  const forYouInsights = hasUserScores ? INSIGHTS.filter(i => i.layer && activeLayers.includes(i.layer)).sort((a, b) => {
    if (a.layer === dominantLayerId && b.layer !== dominantLayerId) return -1;
    if (b.layer === dominantLayerId && a.layer !== dominantLayerId) return 1;
    return (userLayerScores[a.layer!] ?? 20) - (userLayerScores[b.layer!] ?? 20);
  }) : [];
  const forYouVideos = hasUserScores ? VIDEOS.filter(v => activeLayers.includes(v.layer)).sort((a, b) => {
    if (a.layer === dominantLayerId && b.layer !== dominantLayerId) return -1;
    if (b.layer === dominantLayerId && a.layer !== dominantLayerId) return 1;
    return (userLayerScores[a.layer] ?? 20) - (userLayerScores[b.layer] ?? 20);
  }) : [];
  const forYouCases = hasUserScores ? CASE_STUDIES.filter(cs => {
    const layerMatch = (CASE_LAYER_MAP[cs.id] || []).some(l => activeLayers.includes(l));
    const conditionMatch = userConditions.some(uc => cs.tags.some(tag => uc.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(uc.toLowerCase())));
    return layerMatch || conditionMatch;
  }) : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>Library</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>Articles, case studies, videos & transformations — all in one place.</Text>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {tabs.map(t => (
                <TouchableOpacity key={t.id} onPress={() => setActiveTab(t.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: activeTab === t.id ? colors.red : colors.card }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: activeTab === t.id ? '#fff' : colors.textSecondary }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* For You tab */}
          {showForYou && hasUserScores && (
            <View style={{ marginTop: 20 }}>
              <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>For You</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Matched to your weakest layer{activeLayers.length > 1 ? 's' : ''}: {activeLayers.map(l => `L${l}`).join(', ')}</Text>
              </View>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 10 }}>Articles for your pattern</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                  {forYouInsights.filter(i => i.type === 'ARTICLE').map(article => (
                    <TouchableOpacity key={article.id} activeOpacity={0.98} onPress={() => onSelectArticle && onSelectArticle(article)} style={{ width: 240, marginRight: 12, borderRadius: 20, padding: 16, backgroundColor: colors.card, borderWidth: article.layer ? 1.5 : 0, borderColor: article.layer ? `${LAYERS[article.layer - 1].color}40` : 'transparent' }}>
                      <View style={{ width: '100%', height: 80, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}><LinearGradient colors={article.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{article.layer ? <LayerIcon name={LAYERS[article.layer - 1].icon} size={24} color="#fff" /> : <Ionicons name="document-text" size={24} color="#fff" />}</LinearGradient></View>
                      {article.layer && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}><LayerIcon name={LAYERS[article.layer - 1].icon} size={10} color={LAYERS[article.layer - 1].color} /><Text style={{ fontSize: 9, fontWeight: '700', color: LAYERS[article.layer - 1].color }}>L{article.layer} · {userLayerScores[article.layer]}/20</Text></View>}
                      <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>{article.category} · {article.readTime}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 4, lineHeight: 17 }} numberOfLines={2}>{article.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {forYouVideos.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 10 }}>Videos for your pattern</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                    {forYouVideos.map(v => (
                      <TouchableOpacity key={v.id} activeOpacity={0.98} style={{ width: 200, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1.5, borderColor: `${LAYERS[v.layer - 1].color}40` }}>
                        <View style={{ height: 112, justifyContent: 'center', alignItems: 'center' }}>
                          <LinearGradient colors={v.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} /></View>
                            <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{v.duration}</Text></View>
                          </LinearGradient>
                        </View>
                        <View style={{ padding: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase', flex: 1 }}>{v.category}</Text>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: LAYERS[v.layer - 1].color, marginLeft: 6 }}>L{v.layer}</Text>
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 4, lineHeight: 15 }} numberOfLines={2}>{v.title}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              {forYouCases.length > 0 && (
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 10 }}>Cases matched to your pattern</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                    {forYouCases.map(cs => (
                      <TouchableOpacity key={cs.id} onPress={() => onNavigate('cases')} activeOpacity={0.98} style={{ width: 240, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
                        <View style={{ height: 144, position: 'relative' }}><Image source={cs.photo} style={{ width: '100%', height: '100%' }} resizeMode="cover" /><View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 2 }} /></View></View></View>
                        <View style={{ padding: 12 }}><Text style={{ fontSize: 10, fontWeight: '700', color: colors.red }}>{cs.result.split('·')[0]}</Text></View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {!showForYou && activeTab === 'all' && (
            <View style={{ marginTop: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Articles</Text>
                <TouchableOpacity onPress={() => setActiveTab('articles')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>See All →</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                {INSIGHTS.filter(i => i.type === 'ARTICLE').map(article => (
                  <TouchableOpacity key={article.id} activeOpacity={0.98} onPress={() => onSelectArticle && onSelectArticle(article)} style={{ width: 240, marginRight: 12, borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
                    <View style={{ width: '100%', height: 80, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                      <LinearGradient colors={article.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        {article.layer ? <LayerIcon name={LAYERS[article.layer - 1].icon} size={24} color="#fff" /> : <Ionicons name="document-text" size={24} color="#fff" />}
                      </LinearGradient>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase', flex: 1 }}>{article.category} · {article.readTime}</Text>
                      {article.layer && <Text style={{ fontSize: 11, fontWeight: '700', color: LAYERS[article.layer - 1].color, marginLeft: 6 }}>L{article.layer}</Text>}
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 4, lineHeight: 17 }} numberOfLines={2}>{article.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {activeTab === 'articles' && (
            <View style={{ marginTop: 20 }}>
              <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Articles</Text>
              </View>
              <View style={{ paddingHorizontal: 24, gap: 12 }}>
                {INSIGHTS.filter(i => i.type === 'ARTICLE').map(article => (
                  <TouchableOpacity key={article.id} activeOpacity={0.98} onPress={() => onSelectArticle && onSelectArticle(article)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, backgroundColor: colors.card }}>
                    <View style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden' }}>
                      <LinearGradient colors={article.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        {article.layer ? <LayerIcon name={LAYERS[article.layer - 1].icon} size={22} color="#fff" /> : <Ionicons name="document-text" size={20} color="#fff" />}
                      </LinearGradient>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase', flex: 1 }}>{article.category} · {article.readTime}</Text>
                        {article.layer && <Text style={{ fontSize: 11, fontWeight: '700', color: LAYERS[article.layer - 1].color, marginLeft: 6 }}>L{article.layer}</Text>}
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 4, lineHeight: 17 }} numberOfLines={2}>{article.title}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {showCases && (
            <View style={{ marginTop: 28 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Case Studies</Text>
                <TouchableOpacity onPress={() => onNavigate('cases')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>See All →</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                {CASE_STUDIES.map(cs => (
                  <TouchableOpacity key={cs.id} onPress={() => onNavigate('cases')} activeOpacity={0.98} style={{ width: 240, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
                    <View style={{ height: 144, position: 'relative' }}>
                      <Image source={cs.photo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 2 }} /></View>
                      </View>
                      <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>{cs.tags[0]}</Text>
                      </View>
                    </View>
                    <View style={{ padding: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.red, marginTop: 4 }}>{cs.result.split('·')[0]}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showVideos && (
            <View style={{ marginTop: 28 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Videos</Text>
                <TouchableOpacity onPress={() => setActiveTab('videos')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>See All →</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                {VIDEOS.map(v => (
                  <TouchableOpacity key={v.id} activeOpacity={0.98} style={{ width: 240, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
                    <View style={{ height: 128, justifyContent: 'center', alignItems: 'center' }}>
                      <LinearGradient colors={v.gradient.match(/#[A-F0-9]{6}/gi) as [string, string] || ['#FF6B6B', '#D42B2B']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
                        </View>
                        <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{v.duration}</Text>
                        </View>
                      </LinearGradient>
                    </View>
                    <View style={{ padding: 12 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>{v.category}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 4, lineHeight: 15 }} numberOfLines={2}>{v.title}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showTransformations && (
            <View style={{ marginTop: 28, marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Transformations</Text>
                <TouchableOpacity onPress={() => onNavigate('transformations')}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>See All →</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                {TRANSFORMATIONS.map(t => (
                  <TouchableOpacity key={t.id} onPress={() => onNavigate('transformations')} activeOpacity={0.98} style={{ width: 208, marginRight: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card, borderTopWidth: 3, borderTopColor: t.featured ? colors.red : colors.border }}>
                    <View style={{ height: 160, backgroundColor: colors.cardAlt }}>
                      <Image source={t.photo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                    <View style={{ padding: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                        {t.tags.slice(0, 1).map(tag => <View key={tag} style={{ backgroundColor: `${colors.red}14`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 8, fontWeight: '700', color: colors.red, textTransform: 'uppercase' }}>{tag}</Text></View>)}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        {t.stats.slice(0, 2).map(s => (
                          <View key={s.label}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red }}>{s.num}</Text>
                            <Text style={{ fontSize: 8, color: colors.textSecondary, textTransform: 'uppercase' }}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 14 }} numberOfLines={2}>{t.result.split('·')[0]}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
        <BottomNav active="library" onNavigate={onNavigate} hasScore={hasScore} />
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// CASE STUDIES SCREEN
// ============================================================

function CaseStudiesScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState('all');
  const allTags = ['all', ...Array.from(new Set(CASE_STUDIES.flatMap(c => c.tags)))];
  const filtered = filter === 'all' ? CASE_STUDIES : CASE_STUDIES.filter(c => c.tags.includes(filter));

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, textTransform: 'uppercase' }}>Case Studies</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>These aren't transformation stories. They're diagnostic ones.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginTop: 16, paddingBottom: 8 }}>
        {allTags.map(t => (
          <TouchableOpacity key={t} onPress={() => setFilter(t)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: filter === t ? colors.red : colors.card }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: filter === t ? '#fff' : colors.textSecondary }}>{t === 'all' ? 'All' : t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 16 }}>
        {filtered.map(cs => (
          <View key={cs.id} style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card, borderTopWidth: 3, borderTopColor: colors.red }}>
            <TouchableOpacity activeOpacity={0.95} onPress={() => Linking.openURL(cs.reel)}>
              <View style={{ height: 200, position: 'relative' }}>
                <Image source={cs.photo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 3 }} /></View>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#fff', marginTop: 8, textTransform: 'uppercase' }}>Watch on Instagram</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>@amitbaruna</Text>
                </View>
              </View>
            </TouchableOpacity>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {cs.tags.map(t => <View key={t} style={{ backgroundColor: `${colors.red}14`, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${colors.red}30` }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.red, textTransform: 'uppercase' }}>{t}</Text></View>)}
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 20, marginBottom: 10 }}>{cs.hook}</Text>
              <View style={{ flexDirection: 'row', marginBottom: 10, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                {cs.stats.map((s, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: i < cs.stats.length - 1 ? 1 : 0, borderRightColor: colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: colors.red }}>{s.num}</Text>
                    <Text style={{ fontSize: 8, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 }}>{cs.story}</Text>
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.red, textTransform: 'uppercase' }}>→ {cs.result}</Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>{cs.layer}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollScreen>
  );
}

// ============================================================
function TransformationsScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState('all');
  const allTags = ['all', ...Array.from(new Set(TRANSFORMATIONS.flatMap(t => t.tags)))];
  const filtered = filter === 'all' ? TRANSFORMATIONS : TRANSFORMATIONS.filter(t => t.tags.includes(filter));

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, textTransform: 'uppercase' }}>Transformations</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>Not just weight loss. System transformation.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginTop: 16, paddingBottom: 8 }}>
        {allTags.map(t => (
          <TouchableOpacity key={t} onPress={() => setFilter(t)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: filter === t ? colors.red : colors.card }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: filter === t ? '#fff' : colors.textSecondary }}>{t === 'all' ? 'All' : t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 16 }}>
        {filtered.map(t => (
          <View key={t.id} style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card, borderTopWidth: t.featured ? 3 : 0, borderTopColor: colors.red }}>
            <Image source={t.photo} style={{ width: '100%', height: 220 }} resizeMode="cover" />
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {t.tags.map(tag => <View key={tag} style={{ backgroundColor: `${colors.red}14`, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.red, textTransform: 'uppercase' }}>{tag}</Text></View>)}
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 10, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                {t.stats.map((s, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: i < t.stats.length - 1 ? 1 : 0, borderRightColor: colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: colors.red }}>{s.num}</Text>
                    <Text style={{ fontSize: 8, color: colors.textTertiary, textTransform: 'uppercase' }}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>{t.result}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollScreen>
  );
}

// ============================================================
function CravingsLogScreen({ onNavigate, returnTo }: { onNavigate: (s: ScreenId) => void; returnTo?: ScreenId }) {
  const { colors } = useTheme();
  const { saveCraving, cravings: loggedCravings, deleteCraving, updateCraving } = useAppData();
  const [editingCravingId2, setEditingCravingId2] = useState<string | null>(null);
  const [editCravingType2, setEditCravingType2] = useState('');
  const [editCravingTiming2, setEditCravingTiming2] = useState('');

  const startEditCraving2 = (c: any) => {
    setEditingCravingId2(c.id);
    setEditCravingType2(c.craving_type);
    setEditCravingTiming2(c.timing);
  };

  const saveEditCraving2 = async () => {
    if (!editingCravingId2 || !editCravingType2 || !editCravingTiming2) return;
    const mapping2 = computeCravingMapping(editCravingType2, editCravingTiming2, '');
    await updateCraving(editingCravingId2, {
      craving_type: editCravingType2,
      timing: editCravingTiming2,
      mapped_layer: mapping2?.layer ?? null,
      mechanism: mapping2?.mechanism ?? 'Logged — no specific layer mapping for this combination.',
      tier: mapping2?.tier ?? 'habit',
      confidence: mapping2?.confidence ?? 'No mapping — logged for pattern tracking',
    });
    setEditingCravingId2(null);
  };
  const [step, setStep] = useState(0);
  const [cravingType, setCravingType] = useState('');
  const [timing, setTiming] = useState('');
  const [context, setContext] = useState('');
  const [logged, setLogged] = useState(false);

  const mapping = cravingType && timing ? computeCravingMapping(cravingType, timing, context) : null;

  const handleLog = async () => {
    if (!cravingType || !timing) return;
    await saveCraving({
      craving_type: cravingType,
      timing,
      context: context || undefined,
      mapped_layer: mapping?.layer ?? null,
      mechanism: mapping?.mechanism ?? 'Logged — no specific layer mapping for this combination.',
      tier: mapping?.tier ?? 'habit',
      confidence: mapping?.confidence ?? 'No mapping — logged for pattern tracking',
    });
    setLogged(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => onNavigate(returnTo || 'home')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Cravings Log</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {!logged ? (
            <View>
              <View style={{ borderRadius: 20, padding: 16, marginBottom: 24, backgroundColor: `${colors.red}0A`, borderWidth: 1, borderColor: `${colors.red}30` }}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>
                  <Text style={{ fontWeight: '700', color: colors.red }}>Cravings aren't discipline failures.</Text> They're biological signals — or sometimes just habits. Log yours to learn the difference.
                </Text>
              </View>

              {loggedCravings.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Your logged cravings ({loggedCravings.length})</Text>
                  {loggedCravings.slice(0, 20).map((c, i) => { const ct = CRAVING_TYPES.find(t => t.id === c.craving_type); const dt = new Date(c.created_at); const isEditing = editingCravingId2 === c.id; return (
                    <View key={c.id || i} style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                      {!isEditing ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Text style={{ fontSize: 18 }}>{ct?.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{ct?.label}</Text>
                            <Text style={{ fontSize: 10, color: colors.textSecondary }}>{CRAVING_TIMING.find(t => t.id === c.timing)?.label || c.timing} · {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                          </View>
                          {c.mapped_layer ? <View style={{ backgroundColor: `${LAYERS[c.mapped_layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: LAYERS[c.mapped_layer - 1].color }}>L{c.mapped_layer}</Text></View> : c.tier === 'habit' ? <View style={{ backgroundColor: colors.iconBg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary }}>HABIT</Text></View> : null}
                          <TouchableOpacity onPress={() => startEditCraving2(c)} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="pencil" size={13} color={colors.textSecondary} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteCraving(c.id)} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={14} color={colors.red} /></TouchableOpacity>
                        </View>
                      ) : (
                        <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.card }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>What were you craving?</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                            {CRAVING_TYPES.map(t => (<TouchableOpacity key={t.id} onPress={() => setEditCravingType2(t.id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: editCravingType2 === t.id ? `${colors.red}14` : colors.bg, borderWidth: 1.5, borderColor: editCravingType2 === t.id ? colors.red : colors.border }}><Text style={{ fontSize: 16 }}>{t.icon}</Text></TouchableOpacity>))}
                          </View>
                          <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>When?</Text>
                          <View style={{ gap: 6, marginBottom: 12 }}>
                            {CRAVING_TIMING.map(t => (<TouchableOpacity key={t.id} onPress={() => setEditCravingTiming2(t.id)} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: editCravingTiming2 === t.id ? colors.red : colors.bg }}><Text style={{ fontSize: 11, fontWeight: '600', color: editCravingTiming2 === t.id ? '#fff' : colors.textSecondary }}>{t.label}</Text></TouchableOpacity>))}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setEditingCravingId2(null)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center' }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={saveEditCraving2} disabled={!editCravingType2 || !editCravingTiming2} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: editCravingType2 && editCravingTiming2 ? colors.red : colors.card, alignItems: 'center', opacity: editCravingType2 && editCravingTiming2 ? 1 : 0.5 }}><Text style={{ fontSize: 12, fontWeight: '700', color: editCravingType2 && editCravingTiming2 ? '#fff' : colors.textTertiary }}>Save</Text></TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  ); })}
                </View>
              )}

              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase' }}>What are you craving?</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                {CRAVING_TYPES.map(t => (
                  <TouchableOpacity key={t.id} onPress={() => { setCravingType(t.id); setStep(1); }} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', gap: 6, backgroundColor: cravingType === t.id ? `${colors.red}14` : colors.card, borderWidth: 1.5, borderColor: cravingType === t.id ? colors.red : colors.border }}>
                    <Text style={{ fontSize: 22 }}>{t.icon}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: cravingType === t.id ? colors.red : colors.textSecondary }}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {step >= 1 && (
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase' }}>When relative to your last meal?</Text>
                  <View style={{ gap: 8, marginBottom: 24 }}>
                    {CRAVING_TIMING.map(t => (
                      <TouchableOpacity key={t.id} onPress={() => { setTiming(t.id); setStep(2); }} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: timing === t.id ? colors.red : colors.card }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: timing === t.id ? '#fff' : colors.textSecondary }}>{t.label}</Text>
                        <Text style={{ fontSize: 10, color: timing === t.id ? 'rgba(255,255,255,0.7)' : colors.textTertiary, marginTop: 2 }}>{t.desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {step >= 2 && (
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase' }}>Context? <Text style={{ color: colors.textTertiary }}>(optional)</Text></Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                    {CRAVING_CONTEXTS.map(c => (
                      <TouchableOpacity key={c.id} onPress={() => setContext(c.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: context === c.id ? colors.red : colors.card }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: context === c.id ? '#fff' : colors.textSecondary }}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {mapping && (
                <View style={{ borderRadius: 20, padding: 16, marginBottom: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: mapping.layer ? `${LAYERS[mapping.layer - 1].color}40` : colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {mapping.tier === 'habit' ? (
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textTertiary, textTransform: 'uppercase' }}>Habit Pattern</Text>
                    ) : (
                      <>
                        <Ionicons name="information-circle" size={14} color={LAYERS[mapping.layer! - 1].color} />
                        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: LAYERS[mapping.layer! - 1].color, textTransform: 'uppercase' }}>{mapping.confidence} · L{mapping.layer}</Text>
                      </>
                    )}
                  </View>
                  {mapping.layer ? (
                    <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text, marginBottom: 8 }}>
                      <Text style={{ fontWeight: '600' }}>{LAYERS[mapping.layer - 1].name}:</Text> {mapping.mechanism}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 8 }}>{mapping.mechanism}</Text>
                  )}
                  <Text style={{ fontSize: 11, fontStyle: 'italic', color: colors.textTertiary }}>
                    {mapping.tier === 'habit'
                      ? 'Logged as habit — not fed into layer scoring. Single occurrences are noise; patterns emerge over 5-7 days.'
                      : 'Single occurrences are noise; patterns emerge over 5-7 days of consistent logging.'}
                  </Text>
                </View>
              )}

              {cravingType && timing && (
                <TouchableOpacity onPress={handleLog} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Log Craving</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(34,197,94,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="checkmark-circle" size={32} color="#22C55E" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>Craving Logged</Text>
              {mapping && (
                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16, textAlign: 'center' }}>
                  {mapping.layer ? `${LAYERS[mapping.layer - 1].name} signal detected. ${mapping.mechanism}` : mapping.mechanism}
                </Text>
              )}
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 24, textAlign: 'center' }}>Log for 5-7 days to reveal your pattern. Single occurrences are noise — consistency is signal.</Text>
              <TouchableOpacity onPress={() => onNavigate('home')} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// SYMPTOM TRACKER SCREEN
// ============================================================

function SymptomTrackerScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const { symptoms, setSymptoms, cravings: loggedCravings, deleteCraving, updateCraving } = useAppData();
  const [userSymptoms, setUserSymptoms] = useState<any[]>(symptoms);
  const [showSymptomPicker, setShowSymptomPicker] = useState(false);
  const [newSymptom, setNewSymptom] = useState('');
  const [newSymptomSeverity, setNewSymptomSeverity] = useState('');
  const [newSymptomSince, setNewSymptomSince] = useState('');
  const [newSymptomQualifier, setNewSymptomQualifier] = useState<boolean | undefined>(undefined);
  const [justSaved, setJustSaved] = useState(false);
  const [editingCravingId, setEditingCravingId] = useState<string | null>(null);
  const [editCravingType, setEditCravingType] = useState('');
  const [editCravingTiming, setEditCravingTiming] = useState('');

  const startEditCraving = (c: any) => {
    setEditingCravingId(c.id);
    setEditCravingType(c.craving_type);
    setEditCravingTiming(c.timing);
  };

  const saveEditCraving = async () => {
    if (!editingCravingId || !editCravingType || !editCravingTiming) return;
    const mapping = computeCravingMapping(editCravingType, editCravingTiming, '');
    await updateCraving(editingCravingId, {
      craving_type: editCravingType,
      timing: editCravingTiming,
      mapped_layer: mapping?.layer ?? null,
      mechanism: mapping?.mechanism ?? 'Logged — no specific layer mapping for this combination.',
      tier: mapping?.tier ?? 'habit',
      confidence: mapping?.confidence ?? 'No mapping — logged for pattern tracking',
    });
    setEditingCravingId(null);
  };

  const persistAll = async (list: any[]) => {
    setUserSymptoms(list);
    await setSymptoms(list);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => onNavigate('home')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={20} color={colors.textSecondary} /></TouchableOpacity>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Symptom Tracker</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ borderRadius: 20, padding: 16, marginBottom: 24, backgroundColor: `${colors.red}0A`, borderWidth: 1, borderColor: `${colors.red}30` }}>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}><Text style={{ fontWeight: '700', color: colors.red }}>Your symptoms tell a story.</Text> Track what you feel, how strong it is, and when it started — your pattern reveals which layer is under strain.</Text>
          </View>
          {userSymptoms.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Your symptoms ({userSymptoms.length})</Text>
              {userSymptoms.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{s.name}</Text>
                    {s.severity && (() => { const sv = SYMPTOM_SEVERITY.find(x => x.id === s.severity); return sv ? <View style={{ backgroundColor: `${sv.color}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start' }}><Text style={{ fontSize: 8, fontWeight: '700', color: sv.color }}>{sv.label}</Text></View> : null; })()}
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>Since {s.since}</Text>
                  </View>
                  {s.mapped_layer ? <View style={{ backgroundColor: `${LAYERS[s.mapped_layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: LAYERS[s.mapped_layer - 1].color }}>L{s.mapped_layer}</Text></View> : s.triage_flag ? <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#EF4444' }}>ASK A DOCTOR</Text></View> : null}
                  <TouchableOpacity onPress={() => persistAll(userSymptoms.filter((_, idx) => idx !== i))} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={14} color={colors.red} /></TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {!showSymptomPicker ? (
            <TouchableOpacity onPress={() => setShowSymptomPicker(true)} style={{ backgroundColor: colors.card, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.red }}>+ Add Symptom</Text></TouchableOpacity>
          ) : (
            <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.card }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Select symptom</Text>
              <View style={{ maxHeight: 144, marginBottom: 12 }}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{SYMPTOMS.filter(s => !userSymptoms.find(us => us.name === s)).map(s => (<TouchableOpacity key={s} onPress={() => { setNewSymptom(s); setNewSymptomQualifier(undefined); }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: newSymptom === s ? colors.red : colors.bg }}><Text style={{ fontSize: 11, fontWeight: '600', color: newSymptom === s ? '#fff' : colors.textSecondary }}>{s}</Text></TouchableOpacity>))}</ScrollView></View>
              {newSymptom ? (
                <View>
                  {TRIAGE_EXCLUDED_SYMPTOMS.includes(newSymptom) && (
                    <View style={{ borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                      <Text style={{ fontSize: 12, lineHeight: 17, color: colors.text }}>This may be worth mentioning to a doctor. It's logged here for your own record, but isn't used in your layer pattern.</Text>
                    </View>
                  )}
                  {MENTAL_HEALTH_SYMPTOMS.includes(newSymptom) && (
                    <TouchableOpacity onPress={() => Linking.openURL('tel:14416')} style={{ borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: `${colors.red}10`, borderWidth: 1, borderColor: `${colors.red}30`, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="heart" size={16} color={colors.red} />
                      <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.text }}>If you're struggling, support is available — Tele-MANAS: <Text style={{ fontWeight: '700' }}>14416</Text>, free & confidential, 24/7. Tap to call.</Text>
                    </TouchableOpacity>
                  )}
                  {(() => {
                    const q = SYMPTOM_MAPPINGS.find(m => m.symptomName === newSymptom)?.needsQualifier;
                    if (!q) return null;
                    const prompt = q === 'weight_gain'
                      ? 'Is this resistant to diet/exercise, and getting worse each time you try?'
                      : q === 'cold_hands_feet'
                      ? 'Does this happen specifically during a stress or anxiety episode?'
                      : 'Is it sudden and patchy, rather than gradual thinning?';
                    return (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>One more detail</Text>
                        <Text style={{ fontSize: 12, color: colors.text, marginBottom: 8 }}>{prompt}</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => setNewSymptomQualifier(true)} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: newSymptomQualifier === true ? colors.red : colors.bg, borderWidth: 1.5, borderColor: newSymptomQualifier === true ? colors.red : colors.border }}><Text style={{ fontSize: 12, fontWeight: '700', color: newSymptomQualifier === true ? '#fff' : colors.textSecondary }}>Yes</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => setNewSymptomQualifier(false)} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: newSymptomQualifier === false ? colors.red : colors.bg, borderWidth: 1.5, borderColor: newSymptomQualifier === false ? colors.red : colors.border }}><Text style={{ fontSize: 12, fontWeight: '700', color: newSymptomQualifier === false ? '#fff' : colors.textSecondary }}>No</Text></TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()}
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Severity</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>{SYMPTOM_SEVERITY.map(sv => (<TouchableOpacity key={sv.id} onPress={() => setNewSymptomSeverity(sv.id)} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: newSymptomSeverity === sv.id ? sv.color : colors.bg, borderWidth: 1.5, borderColor: newSymptomSeverity === sv.id ? sv.color : colors.border }}><Text style={{ fontSize: 11, fontWeight: '700', color: newSymptomSeverity === sv.id ? '#fff' : sv.color }}>{sv.label}</Text></TouchableOpacity>))}</View>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>When did it start?</Text>
                  <View style={{ gap: 6, marginBottom: 12 }}>{SYMPTOM_TIMELINES.map(t => (<TouchableOpacity key={t.id} onPress={() => setNewSymptomSince(t.label)} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: newSymptomSince === t.label ? colors.red : colors.bg }}><Text style={{ fontSize: 12, fontWeight: '600', color: newSymptomSince === t.label ? '#fff' : colors.textSecondary }}>{t.label}</Text></TouchableOpacity>))}</View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => { setShowSymptomPicker(false); setNewSymptom(''); setNewSymptomSeverity(''); setNewSymptomSince(''); setNewSymptomQualifier(undefined); }} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center' }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      if (newSymptom && newSymptomSince) {
                        const mapping = TRIAGE_EXCLUDED_SYMPTOMS.includes(newSymptom) ? null : computeSymptomMapping(newSymptom, newSymptomQualifier);
                        persistAll([...userSymptoms, {
                          name: newSymptom, since: newSymptomSince, severity: newSymptomSeverity || undefined,
                          mapped_layer: mapping?.layer ?? null,
                          secondary_layers: mapping?.secondaryLayers ?? null,
                          mechanism: mapping?.mechanism,
                          tier: mapping?.tier,
                          confidence: mapping?.confidence,
                          triage_flag: TRIAGE_EXCLUDED_SYMPTOMS.includes(newSymptom),
                        }]);
                        setShowSymptomPicker(false); setNewSymptom(''); setNewSymptomSeverity(''); setNewSymptomSince(''); setNewSymptomQualifier(undefined);
                      }
                    }} disabled={!newSymptom || !newSymptomSince} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: newSymptom && newSymptomSince ? colors.red : colors.card, alignItems: 'center', opacity: newSymptom && newSymptomSince ? 1 : 0.5 }}><Text style={{ fontSize: 12, fontWeight: '700', color: newSymptom && newSymptomSince ? '#fff' : colors.textTertiary }}>Add</Text></TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          )}
          {justSaved && <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', flexDirection: 'row', alignItems: 'center', gap: 10 }}><Ionicons name="checkmark-circle" size={18} color="#22C55E" /><Text style={{ fontSize: 12, fontWeight: '600', color: '#22C55E' }}>Saved</Text></View>}

          {/* Logged cravings list with edit + delete */}
          {loggedCravings.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Your logged cravings ({loggedCravings.length})</Text>
              {loggedCravings.slice(0, 20).map((c, i) => { const ct = CRAVING_TYPES.find(t => t.id === c.craving_type); const dt = new Date(c.created_at); const isEditing = editingCravingId === c.id; return (
                <View key={c.id || i} style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                  {!isEditing ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={{ fontSize: 18 }}>{ct?.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{ct?.label}</Text>
                        <Text style={{ fontSize: 10, color: colors.textSecondary }}>{CRAVING_TIMING.find(t => t.id === c.timing)?.label || c.timing} · {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                      </View>
                      {c.mapped_layer ? <View style={{ backgroundColor: `${LAYERS[c.mapped_layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: LAYERS[c.mapped_layer - 1].color }}>L{c.mapped_layer}</Text></View> : c.tier === 'habit' ? <View style={{ backgroundColor: colors.iconBg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary }}>HABIT</Text></View> : null}
                      <TouchableOpacity onPress={() => startEditCraving(c)} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="pencil" size={13} color={colors.textSecondary} /></TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteCraving(c.id)} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={14} color={colors.red} /></TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.card }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>What were you craving?</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                        {CRAVING_TYPES.map(t => (<TouchableOpacity key={t.id} onPress={() => setEditCravingType(t.id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: editCravingType === t.id ? `${colors.red}14` : colors.bg, borderWidth: 1.5, borderColor: editCravingType === t.id ? colors.red : colors.border }}><Text style={{ fontSize: 16 }}>{t.icon}</Text></TouchableOpacity>))}
                      </View>
                      <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>When?</Text>
                      <View style={{ gap: 6, marginBottom: 12 }}>
                        {CRAVING_TIMING.map(t => (<TouchableOpacity key={t.id} onPress={() => setEditCravingTiming(t.id)} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: editCravingTiming === t.id ? colors.red : colors.bg }}><Text style={{ fontSize: 11, fontWeight: '600', color: editCravingTiming === t.id ? '#fff' : colors.textSecondary }}>{t.label}</Text></TouchableOpacity>))}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setEditingCravingId(null)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center' }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity onPress={saveEditCraving} disabled={!editCravingType || !editCravingTiming} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: editCravingType && editCravingTiming ? colors.red : colors.card, alignItems: 'center', opacity: editCravingType && editCravingTiming ? 1 : 0.5 }}><Text style={{ fontSize: 12, fontWeight: '700', color: editCravingType && editCravingTiming ? '#fff' : colors.textTertiary }}>Save</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ); })}
            </View>
          )}
        </ScrollView>
        <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}><TouchableOpacity onPress={() => onNavigate('home')} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Done</Text></TouchableOpacity></View>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// DAY GROUP (expandable daily cravings in Weekly Summary)
// ============================================================

function DayGroup({ day, entries, colors }: { day: string; entries: any[]; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card }}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 40 }}>{day}</Text>
        <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.text }}>{entries.length} craving{entries.length > 1 ? 's' : ''}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </TouchableOpacity>
      {expanded && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          {entries.map((d: any, i: number) => {
            const cravingType = CRAVING_TYPES.find(t => t.id === d.type);
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 18 }}>{cravingType?.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{cravingType?.label}</Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>{CRAVING_TIMING.find(t => t.id === d.timing)?.label}{d.context ? ` · ${d.context}` : ''}</Text>
                </View>
                {d.mapping?.layer ? (
                  <View style={{ backgroundColor: `${LAYERS[d.mapping.layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: LAYERS[d.mapping.layer - 1].color }}>L{d.mapping.layer}</Text></View>
                ) : d.mapping?.tier === 'habit' ? (
                  <View style={{ backgroundColor: colors.iconBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary }}>HABIT</Text></View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ============================================================
// WEEKLY CRAVING SUMMARY SCREEN
// ============================================================

function WeeklyCravingSummaryScreen({ onNavigate, onGoToCravings }: { onNavigate: (s: ScreenId) => void; onGoToCravings?: (from: ScreenId) => void }) {
  const { colors } = useTheme();
  const { cravings } = useAppData();

  // Filter to last 7 days, sort ascending by date
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekCravings = cravings
    .filter(c => new Date(c.created_at).getTime() >= sevenDaysAgo)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Build display rows from REAL cravings
  const weekData = weekCravings.map(c => {
    const d = new Date(c.created_at);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    return {
      day: dayLabel,
      type: c.craving_type,
      timing: c.timing,
      context: c.context || '',
      mapping: c.mapped_layer
        ? { layer: c.mapped_layer, mechanism: c.mechanism, tier: c.tier, confidence: c.confidence }
        : { layer: null, mechanism: c.mechanism, tier: c.tier, confidence: c.confidence },
    };
  });

  const layerCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const habitCount = weekData.filter(d => d.mapping?.tier === 'habit').length;
  weekData.forEach(d => { if (d.mapping?.layer) layerCounts[d.mapping.layer]++; });
  const sortedLayers = Object.entries(layerCounts).sort((a, b) => b[1] - a[1]);
  const dominantLayerNum = parseInt(sortedLayers[0][0]);
  const dominantCount = sortedLayers[0][1];

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => onNavigate('profile')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Weekly Summary</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Your Craving Pattern</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 24 }}>Last 7 days · {weekData.length} craving{weekData.length !== 1 ? 's' : ''} logged</Text>
      </View>

      {weekData.length === 0 && (
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <View style={{ borderRadius: 20, padding: 24, backgroundColor: colors.card, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="calendar-outline" size={24} color={colors.textSecondary} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 }}>No cravings logged this week</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }}>Log cravings for 5–7 days to reveal your pattern. Single occurrences are noise — consistency is signal.</Text>
            <TouchableOpacity onPress={() => onGoToCravings ? onGoToCravings('weekly-cravings') : onNavigate('cravings')} style={{ marginTop: 16, backgroundColor: colors.red, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Log your first craving →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {weekData.length > 0 && dominantCount > 0 && (
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: `${LAYERS[dominantLayerNum - 1].color}40` }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="information-circle" size={16} color={LAYERS[dominantLayerNum - 1].color} />
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: LAYERS[dominantLayerNum - 1].color, textTransform: 'uppercase' }}>Dominant signal this week</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 }}>{LAYERS[dominantLayerNum - 1].name}</Text>
            <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{dominantCount} of 7 days showed cravings mapping to this layer. This is a consistent pattern — not noise.</Text>
          </View>
        </View>
      )}

      {weekData.length > 0 && (
      <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Layer signals</Text>
        <View style={{ gap: 8 }}>
          {[1, 2, 3, 4, 5].map(layerNum => {
            const count = layerCounts[layerNum];
            const layer = LAYERS[layerNum - 1];
            if (count === 0) return null;
            return (
              <View key={layerNum} style={{ borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${layer.color}1F`, alignItems: 'center', justifyContent: 'center' }}>
                  <LayerIcon name={layer.icon} size={14} color={layer.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{layer.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <View key={i} style={{ width: 12, height: 6, borderRadius: 3, backgroundColor: i < count ? layer.color : colors.border }} />
                    ))}
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: layer.color }}>{count}/7</Text>
              </View>
            );
          })}
          {habitCount > 0 && (
            <View style={{ borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark" size={14} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>Habit patterns (not scored)</Text>
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <View key={i} style={{ width: 12, height: 6, borderRadius: 3, backgroundColor: i < habitCount ? colors.textTertiary : colors.border }} />
                  ))}
                </View>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary }}>{habitCount}/7</Text>
            </View>
          )}
        </View>
      </View>
      )}

      {weekData.length > 0 && (
      <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Daily log</Text>
        <View style={{ gap: 8 }}>
          {Object.entries(weekData.reduce((acc: Record<string, typeof weekData>, d) => {
            if (!acc[d.day]) acc[d.day] = [];
            acc[d.day].push(d);
            return acc;
          }, {})).map(([day, entries]) => (
            <DayGroup key={day} day={day} entries={entries} colors={colors} />
          ))}
        </View>
      </View>
      )}

      <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: colors.card }}>
          <Text style={{ fontSize: 10, lineHeight: 16, color: colors.textTertiary, textAlign: 'center' }}>{DISCLAIMER}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={{ backgroundColor: colors.card, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollScreen>
  );
}

// ============================================================
// PROFILE SCREEN
// ============================================================

// ============================================================
// ABOUT / METHODOLOGY SCREEN
// ============================================================

function AboutScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const [philosophyExpanded, setPhilosophyExpanded] = useState(false);

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.red, textTransform: 'uppercase' }}>My Story</Text>
        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 10, lineHeight: 24 }}>What made me obsessed with metabolic health when no one else was asking these questions.</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 26, gap: 10 }}>
        {[{ v: ABOUT_STATS.years, l: 'Years\nexperience', c: colors.red }, { v: ABOUT_STATS.clients, l: '1:1\nclients', c: '#4DA8FF' }, { v: ABOUT_STATS.glp1Cases, l: 'GLP-1\ncases', c: '#22C55E' }].map(s => (
          <View key={s.l} style={{ flex: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', backgroundColor: colors.card }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: s.c }}>{s.v}</Text>
            <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 13 }}>{s.l}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.95} onPress={() => Linking.openURL('https://www.instagram.com/p/DSARgp5jwKu/')} style={{ marginHorizontal: 20, marginTop: 32, borderRadius: 20, overflow: 'hidden', height: 220 }}>
        <Image source={require('./src/assets/about/mystory.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
          </View>
        </View>
      </TouchableOpacity>

      <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
        <TouchableOpacity activeOpacity={0.95} onPress={() => onNavigate('specialisation')} style={{ borderRadius: 20, padding: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="medical" size={20} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Specialisation</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Complex metabolic cases — GLP-1, PCOS, diabetes & more</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.red, textTransform: 'uppercase' }}>My Philosophy</Text>
        <Text style={{ fontSize: 16, fontStyle: 'italic', color: colors.text, marginTop: 10, lineHeight: 25 }}>
          "Helping people understand why their body responds the way it does — so they can change it with confidence."
        </Text>
        {philosophyExpanded && (
          <View style={{ marginTop: 18, gap: 14 }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
              <Text style={{ fontSize: 13, lineHeight: 21, color: colors.textSecondary }}>
                <Text style={{ color: colors.red, fontWeight: '600' }}>Every symptom is a signal.</Text> What looks like resistance, fatigue, cravings, weight regain, or low motivation is often the body's attempt to protect itself under chronic stress, poor recovery, unstable energy, or physiological overload. The goal isn't to force change through more discipline — it's to restore the conditions that let the body adapt and change naturally.
              </Text>
            </View>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
              <Text style={{ fontSize: 13, lineHeight: 21, color: colors.textSecondary }}>
                <Text style={{ color: colors.red, fontWeight: '600' }}>Biology first, behaviour second.</Text> Sustainable habits don't come from motivation — they come from a nervous system that feels safe enough to change. Fix the biology and the behaviour follows.
              </Text>
            </View>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
              <Text style={{ fontSize: 13, lineHeight: 21, color: colors.textSecondary }}>
                <Text style={{ color: colors.red, fontWeight: '600' }}>The right intervention is rarely what you think.</Text> It's almost never the diet. It's almost never the workout. It's whatever is upstream of everything else — and finding that is the work.
              </Text>
            </View>
          </View>
        )}
        <TouchableOpacity onPress={() => setPhilosophyExpanded(!philosophyExpanded)} style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>{philosophyExpanded ? 'Show less ↑' : 'Read the full philosophy →'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
        <TouchableOpacity activeOpacity={0.95} onPress={() => onNavigate('booking')} style={{ borderRadius: 20, padding: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.red}30`, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="call" size={20} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Book a Call with Amit</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Find out what's actually blocking your progress</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </ScrollScreen>
  );
}

function SpecialisationScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const glp1Case = CASE_STUDIES.find(cs => cs.tags.includes('GLP-1 Non-Responder'));

  const conditions = [
    { icon: 'flash', title: 'Type 2 Diabetes & Insulin Resistance', desc: 'Helping clients improve blood sugar regulation, metabolic flexibility, and long-term health outcomes.' },
    { icon: 'sync', title: 'PCOS & Hormonal Metabolic Dysfunction', desc: 'Addressing insulin resistance, weight-loss resistance, inflammation, and hormonal balance.' },
    { icon: 'medical', title: 'People on GLP-1 Medication', desc: 'Supporting muscle retention, protein intake, strength training, and sustainable fat loss.' },
    { icon: 'scale', title: 'Obesity & Weight-Loss Resistance', desc: 'For individuals struggling despite dieting, exercising, and repeated weight-loss attempts.' },
    { icon: 'heart', title: 'Hypertension & Fatty Liver Disease', desc: 'Lifestyle interventions focused on reducing cardiometabolic risk and improving liver health.' },
  ];

  const downloadProfile = async () => {
    try {
      setDownloading(true);
      const asset = Asset.fromModule(require('./src/assets/about/profile.pdf'));
      await asset.downloadAsync();
      if (asset.localUri && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(asset.localUri, { dialogTitle: "Amit Baruna's Profile" });
      }
    } catch (e) {
      Alert.alert('Could not open profile', 'Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <TouchableOpacity onPress={() => onNavigate('about')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.red, textTransform: 'uppercase' }}>Who I Work With</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 10, lineHeight: 26 }}>Specialized support across complex metabolic conditions.</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 }}>Over {ABOUT_STATS.clients} consultations across diabetes, obesity, hormonal health, and GLP-1 medication support.</Text>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
        {conditions.map(c => (
          <View key={c.title} style={{ borderLeftWidth: 3, borderLeftColor: colors.red, borderRadius: 16, padding: 16, backgroundColor: colors.card }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={c.icon as any} size={16} color={colors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 19 }}>{c.title}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 18 }}>{c.desc}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {glp1Case && (
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.red, textTransform: 'uppercase', marginBottom: 12 }}>Featured Result</Text>
          <TouchableOpacity activeOpacity={0.95} onPress={() => onNavigate('cases')} style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
            <View style={{ height: 160, position: 'relative' }}>
              <Image source={glp1Case.photo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
              <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>GLP-1 Non-Responder</Text>
              </View>
            </View>
            <View style={{ padding: 14 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 19 }}>{glp1Case.hook}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#22C55E', marginTop: 8 }}>{glp1Case.result.split('·')[0]}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://indianexpress.com/article/lifestyle/health/yearender-2025-weight-loss-injections-lifestyle-habits-metabolic-stability-experts-10423405/')} style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>One featured in The Indian Express ↗</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
        <TouchableOpacity activeOpacity={0.95} onPress={downloadProfile} disabled={downloading} style={{ borderRadius: 20, padding: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={downloading ? 'hourglass' : 'document-text'} size={20} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Download My Full Profile</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{downloading ? 'Preparing...' : 'PDF · credentials, approach & results'}</Text>
          </View>
          <Ionicons name="download-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </ScrollScreen>
  );
}

function ProfileScreen({ onNavigate, hasScore, scoreResult, onGoToCravings, onGoToTodaysOne }: { onNavigate: (s: ScreenId) => void; hasScore?: boolean; scoreResult?: any; onGoToCravings?: (from: ScreenId) => void; onGoToTodaysOne?: () => void }) {
  const { colors, theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();
  const { clinicalDepth, toggleClinicalDepth } = useClinicalDepth();
  const {
    fullName, cravings: loggedCravings, symptoms: ctxSymptoms, setSymptoms: ctxSetSymptoms,
    goals: ctxGoals, setGoals: ctxSetGoals, fatDeposition: ctxFatDeposition, setFatDeposition: ctxSetFatDeposition,
    baseline: ctxBaseline, setBaseline: ctxSetBaseline, scoreHistory, refreshScoreHistory,
    conditions: ctxConditions, setConditions: ctxSetConditions,
  } = useAppData();
  useEffect(() => { refreshScoreHistory(); }, [refreshScoreHistory]);
  const [myMembership, setMyMembership] = useState<any>({ status: 'trial' });
  const [myBooking, setMyBooking] = useState<any>(null);
  useEffect(() => {
    membership.get().then(setMyMembership).catch(() => {});
    booking.getMyBooking().then(setMyBooking).catch(() => {});
  }, []);
  const latestHistory = scoreHistory[0];
  // No hardcoded default layer. Prefer the fresh in-session scoreResult's dominantLayer; fall
  // back to the persisted dominant_layer on the latest historical entry (present on rows saved
  // after the 2026-07-30 cascade_risk/dominant_layer persistence fix) — only null (genuine
  // "Not available") when neither exists, never a guessed default.
  const weakestLayer = scoreResult?.dominantLayer
    ? LAYERS[scoreResult.dominantLayer - 1]
    : latestHistory?.dominant_layer
    ? LAYERS[latestHistory.dominant_layer - 1]
    : null;
  const weeklyCravingSummary = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = (loggedCravings || []).filter((c: any) => new Date(c.created_at).getTime() >= sevenDaysAgo);
    const groups: Record<string, { type: string; time: string; dayset: Set<string>; mapped_layer: number | null; tier: string }> = {};
    recent.forEach((c: any) => {
      const key = `${c.craving_type}_${c.timing}`;
      const dayStr = new Date(c.created_at).toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = { type: c.craving_type, time: c.timing, dayset: new Set(), mapped_layer: c.mapped_layer, tier: c.tier };
      groups[key].dayset.add(dayStr);
    });
    return Object.values(groups)
      .map(g => ({ type: g.type, time: g.time, days: g.dayset.size, mapped_layer: g.mapped_layer, tier: g.tier }))
      .sort((a, b) => b.days - a.days);
  }, [loggedCravings]);
  const cascadeRiskStr: string = scoreResult?.cascadeRisk || '';
  const activeCascades = cascadeRiskStr ? cascadeRiskStr.split('|').map((s: string) => s.trim()).filter(Boolean) : [];
  const riskPatternText = activeCascades.length > 0 && !cascadeRiskStr.includes('No immediate cascade') ? `${activeCascades.length} cascade risk${activeCascades.length > 1 ? 's' : ''}` : 'No cascade risk';
  let trajectoryText = '—'; let trajectoryColor = colors.textSecondary;
  if (scoreHistory.length >= 2) {
    const latest = scoreHistory[0].total_score; const previous = scoreHistory[1].total_score; const delta = latest - previous;
    if (delta > 0) { trajectoryText = `↗ +${delta} since last`; trajectoryColor = '#22C55E'; }
    else if (delta < 0) { trajectoryText = `↘ ${delta} since last`; trajectoryColor = '#EF4444'; }
    else { trajectoryText = '→ No change'; }
  } else if (scoreHistory.length === 1 || scoreResult) { trajectoryText = 'Baseline — retake in 2 wk'; }
  const [editSymptoms, setEditSymptoms] = useState(false);
  const [showCascades, setShowCascades] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const [userSymptoms, setUserSymptoms] = useState<any[]>(ctxSymptoms);
  const [userGoals, setUserGoals] = useState<string[]>(ctxGoals.length > 0 ? ctxGoals : []);
  const [customGoal, setCustomGoal] = useState('');
  const [showSymptomPicker, setShowSymptomPicker] = useState(false);
  const [newSymptom, setNewSymptom] = useState('');
  const [newSymptomSeverity, setNewSymptomSeverity] = useState('');
  const [newSymptomSince, setNewSymptomSince] = useState('');
  const [newSymptomQualifier, setNewSymptomQualifier] = useState<boolean | undefined>(undefined);
  // FIX 6: Fat Deposition editable
  const [editFatDeposition, setEditFatDeposition] = useState(false);
  const [userFatDeposition, setUserFatDeposition] = useState<string>(ctxFatDeposition || '');
  // FIX 7: Baseline editable
  const [editBaseline, setEditBaseline] = useState(false);
  const [metabolicPatternExpanded, setMetabolicPatternExpanded] = useState(false);
  const [cravingExpanded, setCravingExpanded] = useState(false);
  const [symptomExpanded, setSymptomExpanded] = useState(false);
  const [fatDepExpanded, setFatDepExpanded] = useState(false);
  const [medicalCondExpanded, setMedicalCondExpanded] = useState(false);
  const [goalRowExpanded, setGoalRowExpanded] = useState(false);
  const [baselineRowExpanded, setBaselineRowExpanded] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rebookFreeOpen, setRebookFreeOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState<'closed' | 'confirm' | 'cancelling' | 'done'>('closed');
  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied' | 'requesting'>('unknown');
  useEffect(() => {
    if (!Notifications) return;
    Notifications.getPermissionsAsync().then((res: any) => {
      setNotifStatus(res.status === 'granted' ? 'granted' : 'unknown');
    }).catch(() => {});
  }, []);
  const enableNotifications = async () => {
    if (!Notifications || !user?.id) {
      Alert.alert('Not available', 'Notifications aren\'t available in this build yet — this needs the full app build to work fully.');
      return;
    }
    setNotifStatus('requesting');
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        setNotifStatus('denied');
        return;
      }
      const tokenData = await Notifications.getExpoPushTokenAsync();
      await pushNotifications.saveToken(user.id, tokenData.data);
      setNotifStatus('granted');
    } catch (e) {
      console.warn('[Profile] enableNotifications threw:', e);
      setNotifStatus('unknown');
      Alert.alert('Could not enable notifications', 'Please try again, or check your device settings.');
    }
  };
  const [sharingApp, setSharingApp] = useState(false);
  const [referralStats, setReferralStats] = useState<{ totalReferred: number; successfulReferrals: number } | null>(null);
  useEffect(() => { referral.getMyStats().then(setReferralStats).catch(() => {}); }, []);
  const shareApp = async () => {
    setSharingApp(true);
    try {
      const code = await referral.getOrCreateCode();
      const message = code
        ? `I've been using the Metabolic Score app to figure out what's actually blocking my fat loss — thought you'd find it useful too. Use my code ${code} when you sign up: https://amitbaruna.com`
        : `Check out the Metabolic Score app — it helped me figure out what's actually blocking my fat loss: https://amitbaruna.com`;
      await Share.share({ message });
    } catch (e) {
      console.warn('[shareApp] failed:', e);
    } finally {
      setSharingApp(false);
    }
  };
  const [baselineAge, setBaselineAge] = useState(ctxBaseline.age || '');
  const [baselineHeight, setBaselineHeight] = useState(ctxBaseline.height || '');
  const [baselineWeight, setBaselineWeight] = useState(ctxBaseline.weight || '');
  // FIX 10: Help & Support expand
  const [showHelpSupport, setShowHelpSupport] = useState(false);
  const [editConditions, setEditConditions] = useState(false);
  const [userConditions, setUserConditions] = useState<string[]>(ctxConditions.length > 0 ? ctxConditions : []);

  const toggleGoal = (g: string) => {
    if (userGoals.includes(g)) {
      const updated = userGoals.filter(x => x !== g);
      setUserGoals(updated);
      ctxSetGoals(updated);
    } else if (userGoals.length < 3) {
      const updated = [...userGoals, g];
      setUserGoals(updated);
      ctxSetGoals(updated);
    }
  };

  return (
    <>
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{(fullName || user?.email || 'A').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{fullName || 'Friend'}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{user?.email || ''}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: `${colors.red}14`, alignSelf: 'flex-start' }}>
                  <Ionicons name="flash" size={12} color={colors.red} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red }}>Latest score: {scoreHistory[0]?.total_score ?? '—'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* My Program */}
          <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
            <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card, borderWidth: myMembership.status === 'paid' ? 1.5 : 1, borderColor: myMembership.status === 'paid' ? colors.red : colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: myMembership.status === 'paid' ? 16 : 0 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>My Program</Text>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: myMembership.status === 'paid' ? colors.red : `${colors.textTertiary}20` }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: myMembership.status === 'paid' ? '#fff' : colors.textSecondary, textTransform: 'uppercase' }}>{myMembership.status === 'paid' ? 'Paid Member' : 'Trial'}</Text>
                </View>
              </View>

              {myMembership.status === 'paid' ? (
                <>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{myMembership.plan_type === '90_day_program' ? '90-Day Metabolic Reset' : '360° Transformation Blueprint'}</Text>
                  <View style={{ flexDirection: 'row', gap: 20, marginTop: 10 }}>
                    <View>
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>Joined</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 2 }}>{myMembership.joined_date ? new Date(myMembership.joined_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text>
                    </View>
                    {myMembership.plan_end_date ? (
                      <View>
                        <Text style={{ fontSize: 10, color: colors.textTertiary }}>Plan ends</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 2 }}>{new Date(myMembership.plan_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      </View>
                    ) : myBooking ? (
                      <View>
                        <Text style={{ fontSize: 10, color: colors.textTertiary }}>Session</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                          {new Date(myBooking.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {myBooking.booking_availability_template && ` · ${fmtSlotTime(myBooking.booking_availability_template.start_time)}`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {myBooking ? (
                    <>
                    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="calendar" size={16} color={colors.red} />
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        Upcoming: {new Date(myBooking.booking_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {myBooking.booking_availability_template && ` · ${fmtSlotTime(myBooking.booking_availability_template.start_time)} – ${fmtSlotTime(myBooking.booking_availability_template.end_time)}`}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setRescheduleOpen(true)} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>Reschedule call →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCancelStep('confirm')} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Cancel call</Text>
                    </TouchableOpacity>
                    </>
                  ) : (
                    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>No call currently booked — your plan is still active, so booking one is free.</Text>
                      <TouchableOpacity onPress={() => setRebookFreeOpen(true)} style={{ backgroundColor: colors.red, paddingVertical: 12, borderRadius: 10, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 20 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Book a Call</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <TouchableOpacity onPress={() => onNavigate('booking')} activeOpacity={0.9} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="rocket" size={18} color={colors.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>You're on the free trial</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Book a call to unlock your program</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* My Health Data */}
          <View style={{ paddingHorizontal: 24, marginTop: 28, marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>My Health Data</Text>
          </View>

          {/* 1. Metabolic Story */}
          <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setMetabolicPatternExpanded(!metabolicPatternExpanded)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="pulse" size={17} color={colors.red} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Metabolic Story</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{weakestLayer ? `${weakestLayer.name} dominant` : (latestHistory?.dominant_pattern || 'Take your first assessment to see your metabolic story')}</Text>
              </View>
              <Ionicons name={metabolicPatternExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            {metabolicPatternExpanded && (
            <View style={{ borderRadius: 20, padding: 20, marginTop: 8, backgroundColor: colors.card }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase' }}>Your Metabolic Pattern</Text>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Dominant layer</Text>
                  {weakestLayer ? (
                    <Text style={{ fontSize: 13, fontWeight: '600', color: weakestLayer.color }}>{weakestLayer.name}</Text>
                  ) : (
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary }}>Not available</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Trajectory</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: trajectoryColor }}>{trajectoryText}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Assessments</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{scoreHistory.length} taken</Text>
                </View>
              </View>
            </View>
            )}
            {metabolicPatternExpanded && scoreResult && (
              <View style={{ marginTop: 12 }}>
                <CascadeVisualization scoreResult={scoreResult} colors={colors} onNavigate={onNavigate} onWorkOnThis={onGoToTodaysOne} />
              </View>
            )}
            {/* Same reconstruction attempt as Home: rows saved after the 2026-07-30
                cascade_risk/dominant_layer persistence fix can rebuild a real
                CascadeVisualization; older rows fall back to the layer1-5 breakdown instead
                of hiding the section entirely. */}
            {metabolicPatternExpanded && !scoreResult && latestHistory && (() => {
              const reconstructed = reconstructScoreResultFromHistory(latestHistory);
              if (reconstructed) {
                return (
                  <View style={{ marginTop: 12 }}>
                    <CascadeVisualization scoreResult={reconstructed} colors={colors} onNavigate={onNavigate} onWorkOnThis={onGoToTodaysOne} />
                  </View>
                );
              }
              const layerScoreMap: Record<number, number> = { 1: latestHistory.layer1, 2: latestHistory.layer2, 3: latestHistory.layer3, 4: latestHistory.layer4, 5: latestHistory.layer5 };
              return (
                <View style={{ marginTop: 12, borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase' }}>Layer Breakdown — Last Assessment</Text>
                  <View style={{ gap: 10 }}>
                    {LAYERS.map(layer => {
                      const ls = layerScoreMap[layer.id];
                      return (
                        <View key={layer.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{layer.name}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{typeof ls === 'number' ? `${ls}/20` : '—'}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </View>

          {/* 2. Craving Patterns */}
          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setCravingExpanded(!cravingExpanded)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="flame" size={17} color={colors.red} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Cravings</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{weeklyCravingSummary.length} logged this week</Text>
              </View>
              <Ionicons name={cravingExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            {cravingExpanded && (
            <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => onNavigate('weekly-cravings')}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>Weekly Summary →</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onGoToCravings ? onGoToCravings('profile') : onNavigate('cravings')}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>Log →</Text></TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.97} onPress={() => onNavigate('weekly-cravings')} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 12 }}>This week's signals</Text>
              {weeklyCravingSummary.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.textTertiary, paddingVertical: 8 }}>No cravings logged yet this week — tap "Log →" above to start tracking.</Text>
              ) : weeklyCravingSummary.map((c, i) => {
                const cravingType = CRAVING_TYPES.find(t => t.id === c.type);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                    <Text style={{ fontSize: 20 }}>{cravingType?.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{cravingType?.label} · {c.time}</Text>
                      <Text style={{ fontSize: 10, color: colors.textSecondary }}>{c.days} of 7 days</Text>
                    </View>
                    {c.mapped_layer && <View style={{ backgroundColor: `${LAYERS[c.mapped_layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: LAYERS[c.mapped_layer - 1].color }}>L{c.mapped_layer}</Text></View>}
                    {c.tier === 'habit' && <View style={{ backgroundColor: colors.iconBg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary }}>HABIT</Text></View>}
                  </View>
                );
              })}
              {weeklyCravingSummary.some(c => c.mapped_layer) && (
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 12, lineHeight: 18 }}>
                  Your cravings suggest {[...new Set(weeklyCravingSummary.filter(c => c.mapped_layer).map(c => `L${c.mapped_layer}`))].join(' + ')} {weeklyCravingSummary.filter(c => c.mapped_layer).length > 1 ? 'are' : 'is'} under strain. Retake your score to confirm.
                </Text>
              )}
            </TouchableOpacity>
            </View>
            )}
          </View>

          {/* 3. Symptom Timeline */}
          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSymptomExpanded(!symptomExpanded)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="pulse-outline" size={17} color={colors.red} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Symptoms</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{userSymptoms.length} active</Text>
              </View>
              <Ionicons name={symptomExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            {symptomExpanded && (
            <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setEditSymptoms(!editSymptoms)}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>{editSymptoms ? 'Done' : 'Edit →'}</Text></TouchableOpacity>
            </View>
            {!editSymptoms ? (
              <TouchableOpacity activeOpacity={0.97} onPress={() => setEditSymptoms(!editSymptoms)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
                {userSymptoms.length === 0 ? (
                  <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 12 }}>No symptoms added yet. Tap "Edit →" to add.</Text>
                ) : (
                  userSymptoms.map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{s.name}</Text>
                        {s.severity && (() => { const sv = SYMPTOM_SEVERITY.find(x => x.id === s.severity); return sv ? <View style={{ backgroundColor: `${sv.color}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 8, fontWeight: '700', color: sv.color }}>{sv.label}</Text></View> : null; })()}
                        {s.mapped_layer ? <View style={{ backgroundColor: `${LAYERS[s.mapped_layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 8, fontWeight: '700', color: LAYERS[s.mapped_layer - 1].color }}>L{s.mapped_layer}</Text></View> : s.triage_flag ? <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 7, fontWeight: '700', color: '#EF4444' }}>ASK A DOCTOR</Text></View> : null}
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>{s.since}</Text>
                    </View>
                  ))
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
                {userSymptoms.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Your symptoms ({userSymptoms.length})</Text>
                    {userSymptoms.map((s, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{s.name}</Text>
                          {s.severity && (() => { const sv = SYMPTOM_SEVERITY.find(x => x.id === s.severity); return sv ? <View style={{ backgroundColor: `${sv.color}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2, alignSelf: 'flex-start' }}><Text style={{ fontSize: 8, fontWeight: '700', color: sv.color }}>{sv.label}</Text></View> : null; })()}
                          <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>{s.since}</Text>
                        </View>
                        {s.mapped_layer ? <View style={{ backgroundColor: `${LAYERS[s.mapped_layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 8, fontWeight: '700', color: LAYERS[s.mapped_layer - 1].color }}>L{s.mapped_layer}</Text></View> : s.triage_flag ? <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 7, fontWeight: '700', color: '#EF4444' }}>ASK A DOCTOR</Text></View> : null}
                        <TouchableOpacity onPress={() => { const updated = userSymptoms.filter((_, idx) => idx !== i); setUserSymptoms(updated); ctxSetSymptoms(updated); }} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="close" size={14} color={colors.red} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                {!showSymptomPicker ? (
                  <TouchableOpacity onPress={() => setShowSymptomPicker(true)} style={{ backgroundColor: colors.bg, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>+ Add Symptom</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.bg }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Select symptom</Text>
                    <View style={{ maxHeight: 128, marginBottom: 12 }}>
                      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {SYMPTOMS.filter(s => !userSymptoms.find(us => us.name === s)).map(s => (
                          <TouchableOpacity key={s} onPress={() => { setNewSymptom(s); setNewSymptomQualifier(undefined); }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: newSymptom === s ? colors.red : colors.card }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: newSymptom === s ? '#fff' : colors.textSecondary }}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    {newSymptom ? (
                      <View>
                        {TRIAGE_EXCLUDED_SYMPTOMS.includes(newSymptom) && (
                          <View style={{ borderRadius: 12, padding: 10, marginBottom: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                            <Text style={{ fontSize: 11, lineHeight: 16, color: colors.text }}>This may be worth mentioning to a doctor. It's logged here for your own record, but isn't used in your layer pattern.</Text>
                          </View>
                        )}
                        {MENTAL_HEALTH_SYMPTOMS.includes(newSymptom) && (
                          <TouchableOpacity onPress={() => Linking.openURL('tel:14416')} style={{ borderRadius: 12, padding: 10, marginBottom: 12, backgroundColor: `${colors.red}10`, borderWidth: 1, borderColor: `${colors.red}30`, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name="heart" size={15} color={colors.red} />
                            <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, color: colors.text }}>If you're struggling, support is available — Tele-MANAS: <Text style={{ fontWeight: '700' }}>14416</Text>, free & confidential, 24/7. Tap to call.</Text>
                          </TouchableOpacity>
                        )}
                        {(() => {
                          const q = SYMPTOM_MAPPINGS.find(m => m.symptomName === newSymptom)?.needsQualifier;
                          if (!q) return null;
                          const prompt = q === 'weight_gain'
                            ? 'Is this resistant to diet/exercise, and getting worse each time you try?'
                            : q === 'cold_hands_feet'
                            ? 'Does this happen specifically during a stress or anxiety episode?'
                            : 'Is it sudden and patchy, rather than gradual thinning?';
                          return (
                            <View style={{ marginBottom: 12 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>One more detail</Text>
                              <Text style={{ fontSize: 11, color: colors.text, marginBottom: 8 }}>{prompt}</Text>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => setNewSymptomQualifier(true)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: newSymptomQualifier === true ? colors.red : colors.card, borderWidth: 1, borderColor: newSymptomQualifier === true ? colors.red : colors.border }}><Text style={{ fontSize: 11, fontWeight: '700', color: newSymptomQualifier === true ? '#fff' : colors.textSecondary }}>Yes</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setNewSymptomQualifier(false)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: newSymptomQualifier === false ? colors.red : colors.card, borderWidth: 1, borderColor: newSymptomQualifier === false ? colors.red : colors.border }}><Text style={{ fontSize: 11, fontWeight: '700', color: newSymptomQualifier === false ? '#fff' : colors.textSecondary }}>No</Text></TouchableOpacity>
                              </View>
                            </View>
                          );
                        })()}
                        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Severity</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                          {SYMPTOM_SEVERITY.map(sv => (
                            <TouchableOpacity key={sv.id} onPress={() => setNewSymptomSeverity(sv.id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: newSymptomSeverity === sv.id ? sv.color : colors.card, borderWidth: 1, borderColor: newSymptomSeverity === sv.id ? sv.color : colors.border }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: newSymptomSeverity === sv.id ? '#fff' : sv.color }}>{sv.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>When did it start?</Text>
                        <View style={{ gap: 6, marginBottom: 12 }}>
                          {SYMPTOM_TIMELINES.map(t => (
                            <TouchableOpacity key={t.id} onPress={() => setNewSymptomSince(t.label)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: newSymptomSince === t.label ? colors.red : colors.card }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: newSymptomSince === t.label ? '#fff' : colors.textSecondary }}>{t.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => { setShowSymptomPicker(false); setNewSymptom(''); setNewSymptomSeverity(''); setNewSymptomSince(''); setNewSymptomQualifier(undefined); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.card, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => {
                            if (newSymptom && newSymptomSince) {
                              const mapping = TRIAGE_EXCLUDED_SYMPTOMS.includes(newSymptom) ? null : computeSymptomMapping(newSymptom, newSymptomQualifier);
                              const updated = [...userSymptoms, {
                                name: newSymptom, since: newSymptomSince, severity: newSymptomSeverity || undefined,
                                mapped_layer: mapping?.layer ?? null,
                                secondary_layers: mapping?.secondaryLayers ?? null,
                                mechanism: mapping?.mechanism,
                                tier: mapping?.tier,
                                confidence: mapping?.confidence,
                                triage_flag: TRIAGE_EXCLUDED_SYMPTOMS.includes(newSymptom),
                              }];
                              setUserSymptoms(updated); ctxSetSymptoms(updated);
                              setShowSymptomPicker(false); setNewSymptom(''); setNewSymptomSeverity(''); setNewSymptomSince(''); setNewSymptomQualifier(undefined);
                            }
                          }} disabled={!newSymptom || !newSymptomSince} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: newSymptom && newSymptomSince ? colors.red : colors.card, alignItems: 'center', opacity: newSymptom && newSymptomSince ? 1 : 0.5 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: newSymptom && newSymptomSince ? '#fff' : colors.textTertiary }}>Add</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </View>
            )}
          </View>

          {/* 5. Fat Deposition */}
          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setFatDepExpanded(!fatDepExpanded)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="body" size={17} color={colors.red} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Fat Deposition</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{userFatDeposition ? (FAT_DEPOSITION_OPTIONS.find(f => f.id === userFatDeposition)?.label || 'Not set') : 'Not set'}</Text>
              </View>
              <Ionicons name={fatDepExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            {fatDepExpanded && (
            <View style={{ marginTop: 8 }}>
            <TouchableOpacity activeOpacity={0.97} onPress={() => setEditFatDeposition(!editFatDeposition)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
              {(() => {
                const pattern = FAT_DEPOSITION_OPTIONS.find(f => f.id === userFatDeposition) || null;
                if (editFatDeposition) {
                  return (
                    <View style={{ gap: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Select your pattern</Text>
                      {FAT_DEPOSITION_OPTIONS.map(f => {
                        const sel = userFatDeposition === f.id;
                        return (
                          <TouchableOpacity key={f.id} onPress={() => { setUserFatDeposition(f.id); ctxSetFatDeposition(f.id); setEditFatDeposition(false); }} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: sel ? `${colors.red}14` : colors.bg, borderWidth: 1.5, borderColor: sel ? colors.red : colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {sel && <Ionicons name="checkmark" size={14} color={colors.red} />}
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: sel ? colors.red : colors.text }}>{f.label}</Text>
                              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{f.desc}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity onPress={() => setEditFatDeposition(false)} style={{ marginTop: 8, paddingVertical: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textTertiary }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                if (!pattern) {
                  return (
                    <TouchableOpacity onPress={() => setEditFatDeposition(true)} style={{ paddingVertical: 8 }}>
                      <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>Not set yet. Tap to select your pattern.</Text>
                    </TouchableOpacity>
                  );
                }
                return (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{pattern.label}</Text>
                      <TouchableOpacity onPress={() => setEditFatDeposition(true)}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>Change</Text></TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>{pattern.desc}</Text>
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>What this signals</Text>
                      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>{pattern.signal}</Text>
                    </View>
                  </View>
                );
              })()}
            </TouchableOpacity>
            </View>
            )}
          </View>

          {/* 5b. Medical Conditions */}
          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setMedicalCondExpanded(!medicalCondExpanded)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="medkit" size={17} color={colors.red} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Medical Condition</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{userConditions.length > 0 ? userConditions.join(', ') : 'None set'}</Text>
              </View>
              <Ionicons name={medicalCondExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            {medicalCondExpanded && (
            <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setEditConditions(!editConditions)}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>{editConditions ? 'Done' : 'Edit →'}</Text></TouchableOpacity>
            </View>
            {!editConditions ? (
              <TouchableOpacity activeOpacity={0.97} onPress={() => setEditConditions(true)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
                {userConditions.length === 0 ? (
                  <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 8 }}>No conditions added. Tap "Edit →" to add.</Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {userConditions.map(c => <View key={c} style={{ backgroundColor: `${colors.red}14`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>{c}</Text></View>)}
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card }}>
                <View style={{ gap: 8 }}>
                  {CONDITIONS_MALE.map(c => {
                    const sel = userConditions.includes(c);
                    return (
                      <TouchableOpacity key={c} onPress={() => { if (c === 'No known condition' || c === 'Prefer not to say') { setUserConditions([c]); ctxSetConditions([c]); } else { const updated = sel ? userConditions.filter(x => x !== c) : [...userConditions.filter(x => x !== 'No known condition' && x !== 'Prefer not to say'), c]; setUserConditions(updated); ctxSetConditions(updated); } }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: sel ? `${colors.red}14` : colors.bg, borderWidth: 1.5, borderColor: sel ? colors.red : colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {sel && <Ionicons name="checkmark" size={14} color={colors.red} />}
                        <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: sel ? colors.red : colors.textSecondary }}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
            )}
          </View>

          {/* 4. My Goal */}
          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setGoalRowExpanded(!goalRowExpanded)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="flag" size={17} color={colors.red} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>My Goal</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{userGoals.length > 0 ? userGoals.join(', ') : 'No goal set'}</Text>
              </View>
              <Ionicons name={goalRowExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            {goalRowExpanded && (
            <View style={{ marginTop: 8 }}>
            {!editGoal ? (
              <TouchableOpacity activeOpacity={0.97} onPress={() => setEditGoal(!editGoal)} style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{userGoals.length > 0 ? userGoals.join(', ') : 'No goal set'}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Set 3 weeks ago · Flexible</Text>
                </View>
                <TouchableOpacity onPress={() => setEditGoal(true)}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>Change</Text></TouchableOpacity>
              </TouchableOpacity>
            ) : (
              <View style={{ borderRadius: 20, padding: 16, gap: 8, backgroundColor: colors.card }}>
                {GOAL_PRESETS.map(g => {
                  const sel = userGoals.includes(g);
                  return (
                    <TouchableOpacity key={g} onPress={() => toggleGoal(g)} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: sel ? `${colors.red}14` : colors.bg, borderWidth: 1.5, borderColor: sel ? colors.red : colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {sel && <Ionicons name="checkmark" size={14} color={colors.red} />}
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: sel ? colors.red : colors.text }}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginTop: 8, marginBottom: 4, textTransform: 'uppercase' }}>Write my own (replaces selections)</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    placeholder="Your custom goal"
                    placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: customGoal ? colors.red : colors.border, color: colors.text, fontSize: 14 }}
                  />
                  <TouchableOpacity onPress={() => { if (customGoal.trim()) { setUserGoals([customGoal.trim()]); setCustomGoal(''); setEditGoal(false); } }} disabled={!customGoal.trim()} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: customGoal.trim() ? colors.red : colors.card }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: customGoal.trim() ? '#fff' : colors.textTertiary }}>Set</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setEditGoal(false)} style={{ marginTop: 8, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textTertiary }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
            </View>
            )}
          </View>

          {/* 6. Baseline */}
          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setBaselineRowExpanded(!baselineRowExpanded)} style={{ borderRadius: 20, padding: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="body-outline" size={17} color={colors.red} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Baseline</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{baselineAge || '—'} yrs · {baselineHeight || '—'} cm · {baselineWeight || '—'} kg</Text>
              </View>
              <Ionicons name={baselineRowExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            {baselineRowExpanded && (
            <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
              {!editBaseline && (
                <TouchableOpacity onPress={() => setEditBaseline(true)}><Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>Edit</Text></TouchableOpacity>
              )}
            </View>
            {!editBaseline ? (
              <TouchableOpacity activeOpacity={0.97} onPress={() => setEditBaseline(!editBaseline)} style={{ flexDirection: 'row', gap: 12 }}>
                {[{ l: 'Age', v: baselineAge }, { l: 'Height (cm)', v: baselineHeight }, { l: 'Weight (kg)', v: baselineWeight }].map(s => (
                  <View key={s.l} style={{ flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', backgroundColor: colors.card }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{s.v}</Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>{s.l}</Text>
                  </View>
                ))}
              </TouchableOpacity>
            ) : (
              <View style={{ borderRadius: 20, padding: 16, gap: 12, backgroundColor: colors.card }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>Age</Text>
                  <TextInput
                    value={baselineAge}
                    onChangeText={setBaselineAge}
                    keyboardType="number-pad"
                    style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14 }}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>Height (cm)</Text>
                  <TextInput
                    value={baselineHeight}
                    onChangeText={setBaselineHeight}
                    keyboardType="number-pad"
                    style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14 }}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>Weight (kg)</Text>
                  <TextInput
                    value={baselineWeight}
                    onChangeText={setBaselineWeight}
                    keyboardType="number-pad"
                    style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14 }}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity onPress={() => setEditBaseline(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { ctxSetBaseline({ age: baselineAge, height: baselineHeight, weight: baselineWeight }); setEditBaseline(false); }} style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.red, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
            )}
          </View>

          {/* 7. Settings */}
          <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Settings</Text>
            <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
              <TouchableOpacity onPress={() => onNavigate('customize')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="options" size={16} color={colors.red} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Customize Home</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Toggle sections on/off</Text></View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={toggleTheme} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={theme === 'dark' ? 'sunny' : theme === 'light' ? 'moon' : 'star'} size={16} color={colors.text} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Appearance</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{theme === 'dark' ? 'Dark mode' : theme === 'light' ? 'Light mode' : 'Midnight mode'}</Text></View>
                <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colors.red, justifyContent: 'flex-end', padding: 2 }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} /></View>
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={() => onNavigate('about')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person-circle" size={16} color={colors.red} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Amit's Methodology</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>My story & specialisation</Text></View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={() => onNavigate('booking')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="calendar" size={16} color={colors.red} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Book a Call</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>1:1 with Amit</Text></View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={shareApp} disabled={sharingApp} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={sharingApp ? 'hourglass' : 'share-social'} size={16} color={colors.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Share the App</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{referralStats ? `${referralStats.totalReferred} shared · ${referralStats.successfulReferrals} completed their quiz` : 'Invite friends & family'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={() => Linking.openURL(BRAND.instagram)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#FF6B6B20', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="logo-instagram" size={16} color="#FF6B6B" /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Instagram</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>@amitbaruna</Text></View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={() => onNavigate('health-connect')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#4DA8FF20', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="heart-circle" size={16} color="#4DA8FF" /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Connect Health App</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Apple Health / Google Fit</Text></View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={() => setShowHelpSupport(!showHelpSupport)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#4DA8FF20', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="help-circle" size={16} color="#4DA8FF" /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Help & Support</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Get help with the app</Text></View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ transform: [{ rotate: showHelpSupport ? '90deg' : '0deg' }] }} />
              </TouchableOpacity>
              {showHelpSupport && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, backgroundColor: colors.cardAlt }}>
                  <TouchableOpacity onPress={() => Linking.openURL('tel:9891828688')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${colors.green}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="call" size={14} color={colors.green} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>Phone</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>9891828688</Text>
                    </View>
                    <Ionicons name="call-outline" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Linking.openURL('mailto:Help@amitbaruna.com')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="mail" size={14} color={colors.red} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase' }}>Email</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>Help@amitbaruna.com</Text>
                    </View>
                    <Ionicons name="mail-outline" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={() => onNavigate('compliance')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="shield-checkmark" size={16} color={colors.red} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Privacy & Consent</Text><Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>DPDP 2023 · Manage your data</Text></View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <TouchableOpacity onPress={notifStatus === 'granted' ? undefined : enableNotifications} disabled={notifStatus === 'requesting'} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="notifications-outline" size={16} color={colors.red} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Reminders & Check-ins</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {notifStatus === 'granted' ? 'Enabled' : notifStatus === 'denied' ? 'Turned off — enable in device settings' : notifStatus === 'requesting' ? 'Requesting…' : 'Optional — get a nudge if you go quiet'}
                  </Text>
                </View>
                {notifStatus === 'granted' ? <Ionicons name="checkmark-circle" size={18} color="#22C55E" /> : notifStatus === 'requesting' ? <ActivityIndicator size="small" color={colors.red} /> : <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
              </TouchableOpacity>
              <View style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.border }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.red}20`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="medkit-outline" size={16} color={colors.red} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Clinical Depth Mode</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {clinicalDepth ? 'On — exact scores and terms shown by default' : 'Off — plain language first, numbers a tap away'}
                  </Text>
                </View>
                <Switch value={clinicalDepth} onValueChange={toggleClinicalDepth} trackColor={{ false: colors.border, true: colors.red }} thumbColor="#fff" />
              </View>
            </View>
            <TouchableOpacity onPress={async () => { await signOut(); onNavigate('login'); }} style={{ marginTop: 20, backgroundColor: colors.card, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="log-out" size={16} color={colors.red} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.red }}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center', marginTop: 24, letterSpacing: 1 }}>METABOLIC SCORE™ V1.0 · BY {BRAND.fullName.toUpperCase()}</Text>
          </View>
        </ScrollView>
        <BottomNav active="profile" onNavigate={onNavigate} hasScore={hasScore} />
      </SafeAreaView>
    </View>
    {rescheduleOpen && myBooking && (
      <SlotPickerModal
        planType={myMembership.plan_type || 'single_consultation'}
        razorpayLink=""
        price=""
        mode="reschedule"
        rescheduleBookingId={myBooking.id}
        onClose={() => setRescheduleOpen(false)}
        onNavigate={onNavigate}
      />
    )}
    {rebookFreeOpen && (
      <SlotPickerModal
        planType={myMembership.plan_type || 'single_consultation'}
        razorpayLink=""
        price=""
        mode="rebook-free"
        onClose={() => { setRebookFreeOpen(false); booking.getMyBooking().then(setMyBooking).catch(() => {}); }}
        onNavigate={onNavigate}
      />
    )}
    <Modal visible={cancelStep !== 'closed'} transparent animationType="fade" onRequestClose={() => setCancelStep('closed')}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ backgroundColor: colors.bg, borderRadius: 20, padding: 24, width: '100%' }}>
          {cancelStep === 'confirm' && myBooking && (
            <>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Cancel this call?</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 20 }}>
                Your call on {new Date(myBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                {myBooking.booking_availability_template && ` at ${fmtSlotTime(myBooking.booking_availability_template.start_time)}`} will be cancelled — the slot will be freed up. This doesn't cancel your plan, just this specific call. You can book a new one anytime from here.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setCancelStep('closed')} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Keep it</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                  setCancelStep('cancelling');
                  await booking.cancelBooking(myBooking.id);
                  const fresh = await booking.getMyBooking();
                  setMyBooking(fresh);
                  setCancelStep('done');
                }} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Cancel Call</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {cancelStep === 'cancelling' && (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <ActivityIndicator color={colors.red} />
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 12 }}>Cancelling…</Text>
            </View>
          )}
          {cancelStep === 'done' && (
            <>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Call cancelled</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 20 }}>You can book a new slot anytime — your plan is still active.</Text>
              <TouchableOpacity onPress={() => setCancelStep('closed')} style={{ paddingVertical: 12, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

// ============================================================
// CUSTOMIZE HOME SCREEN
// ============================================================

function CustomizeHomeScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const [sections, setSections] = useState<string[]>(DEFAULT_HOME_SECTIONS);
  const [showExplanation, setShowExplanation] = useState<string | null>(null);

  // PIPELINE 1: Load saved home sections from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem('ms_home_sections').then(saved => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Record<string, boolean>;
          // Convert the boolean map back to an array of "on" section ids
          const onIds = HOME_SECTIONS.filter(s => parsed[s.id] !== false).map(s => s.id);
          setSections(onIds);
        } catch { /* ignore */ }
      }
    }).catch(() => { /* ignore */ });
  }, []);

  // PIPELINE 1: Persist home sections as a JSON object whenever they change
  useEffect(() => {
    const map: Record<string, boolean> = {};
    HOME_SECTIONS.forEach(s => { map[s.id] = sections.includes(s.id); });
    AsyncStorage.setItem('ms_home_sections', JSON.stringify(map)).catch(() => { /* ignore */ });
  }, [sections]);

  const toggleSection = (sectionId: string) => {
    const section = HOME_SECTIONS.find(s => s.id === sectionId);
    if (section?.locked) return;
    if (sections.includes(sectionId)) {
      if (section?.explanation) { setShowExplanation(sectionId); return; }
      setSections(sections.filter(id => id !== sectionId));
    } else {
      setSections([...sections, sectionId]);
    }
  };

  const confirmTurnOff = () => {
    if (showExplanation) {
      setSections(sections.filter(id => id !== showExplanation));
      setShowExplanation(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={() => onNavigate('profile')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Customize Home</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Your Home, Your Way</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 24 }}>Toggle sections on or off. Your score and 5 Layers stay — they're the core.</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 12 }} showsVerticalScrollIndicator={false}>
          {HOME_SECTIONS.map(section => {
            const isOn = sections.includes(section.id);
            return (
              <View key={section.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 20, backgroundColor: colors.card }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{section.label}</Text>
                    {section.locked && <View style={{ backgroundColor: `${colors.textTertiary}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' }}>Locked</Text></View>}
                  </View>
                </View>
                <ToggleSwitch isOn={isOn} onToggle={() => toggleSection(section.id)} colors={colors} />
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!showExplanation} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: `${colors.textTertiary}40`, alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="alert-circle" size={18} color={colors.red} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Before you turn this off</Text>
            </View>
            <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginBottom: 24 }}>{HOME_SECTIONS.find(s => s.id === showExplanation)?.explanation}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowExplanation(null)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Keep It On</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmTurnOff} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.red, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Turn Off Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// SCORE HISTORY SCREEN
// ============================================================

function ScoreHistoryScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const { scoreHistory, refreshScoreHistory } = useAppData();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { refreshScoreHistory(); }, [refreshScoreHistory]);

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  const layerKeys: { key: 'layer1' | 'layer2' | 'layer3' | 'layer4' | 'layer5'; layer: typeof LAYERS[0] }[] = [
    { key: 'layer1', layer: LAYERS[0] },
    { key: 'layer2', layer: LAYERS[1] },
    { key: 'layer3', layer: LAYERS[2] },
    { key: 'layer4', layer: LAYERS[3] },
    { key: 'layer5', layer: LAYERS[4] },
  ];

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'uppercase' }}>Score History</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>Your Assessment Timeline</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 18 }}>Every Metabolic Score™ result is saved here. Track how your 5 layers shift over time as you apply the protocols.</Text>
      </View>

      {scoreHistory.length === 0 ? (
        <View style={{ paddingHorizontal: 24, marginTop: 60, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="flash" size={32} color={colors.red} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' }}>No assessments yet.</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>Take your first Metabolic Score™ test to see your history here.</Text>
          <TouchableOpacity onPress={() => onNavigate('score')} style={{ marginTop: 20, backgroundColor: colors.red, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Take the Test</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 24, marginTop: 20, gap: 12 }}>
          {scoreHistory.map((s) => {
            const isExpanded = expandedId === s.id;
            const band = getBand(s.total_score);
            return (
              <View key={s.id} style={{ borderRadius: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: isExpanded ? `${colors.red}40` : colors.border, overflow: 'hidden' }}>
                <TouchableOpacity activeOpacity={0.97} onPress={() => toggleExpand(s.id)} style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, letterSpacing: 0.5 }}>{s.date}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6, gap: 4 }}>
                        <Text style={{ fontSize: 32, fontWeight: '900', color: band.color }}>{s.total_score}</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>/100</Text>
                      </View>
                      {s.dominant_pattern ? (
                        <View style={{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: `${band.color}20` }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: band.color, textTransform: 'uppercase', letterSpacing: 1 }}>{s.dominant_pattern}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
                  </View>
                  <View style={{ marginTop: 14, gap: 6 }}>
                    {layerKeys.map(({ key, layer }) => {
                      const sc = s[key] || 0;
                      const col = sc >= 14 ? '#639922' : sc >= 9 ? '#BA7517' : '#E24B4A';
                      return (
                        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: `${layer.color}1F`, alignItems: 'center', justifyContent: 'center' }}><LayerIcon name={layer.icon} size={10} color={layer.color} /></View>
                          <Text style={{ flex: 1, fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>L{layer.id}</Text>
                          <View style={{ flex: 4, height: 5, borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: col, width: `${(sc / 20) * 100}%` }} /></View>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: col, width: 32, textAlign: 'right' }}>{sc}/20</Text>
                        </View>
                      );
                    })}
                  </View>
                </TouchableOpacity>
                {isExpanded && s.rcs != null && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="shield-checkmark" size={12} color={colors.red} />
                      <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.red, textTransform: 'uppercase' }}>Recovery Capacity Score</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{s.rcs}/20 · {getRCSInfo(s.rcs).label}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 16 }}>{getRCSInfo(s.rcs).desc}</Text>
                    <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 8, fontStyle: 'italic' }}>N1/N2/N3 narratives are viewable on the Results screen at the time of taking the test.</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ paddingHorizontal: 24, marginTop: 24, marginBottom: 16 }}>
        {scoreHistory.length > 0 && (
          <View style={{ marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center' }}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} style={{ marginBottom: 4 }} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>Retake every 2 weeks for accurate tracking. Your next assessment is recommended in 14 days.</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => onNavigate('score')} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Take a New Assessment</Text>
        </TouchableOpacity>
      </View>
    </ScrollScreen>
  );
}

// ============================================================
// BOOKING SCREEN
// ============================================================

function BookingScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [approachExpanded, setApproachExpanded] = useState(false);
  const [programExpanded, setProgramExpanded] = useState(false);
  const [blueprintExpanded, setBlueprintExpanded] = useState(false);
  const [rebookFreeOpen, setRebookFreeOpen] = useState(false);
  const [myMembership, setMyMembership] = useState<any>({ status: 'trial' });
  const [myBooking, setMyBooking] = useState<any>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [redirectPrompt, setRedirectPrompt] = useState<null | 'single_consultation' | '90_day_program'>(null); // same-tier tap while already active
  const [rescheduleFromRedirect, setRescheduleFromRedirect] = useState(false);
  useEffect(() => {
    Promise.all([membership.get(), booking.getMyBooking()])
      .then(([m, b]) => { setMyMembership(m); setMyBooking(b); })
      .catch(() => {})
      .finally(() => setMembershipLoading(false));
  }, []);
  const now = new Date();
  // Unified: both plan tiers now carry a plan_end_date (single_consultation = 7-day window from
  // join date, 90_day_program = anchored to payment/kickoff — see the Worker's confirmBookingAndMembership
  // and confirmMembershipByEmail).
  const planActive = myMembership.status === 'paid' && myMembership.plan_end_date && new Date(myMembership.plan_end_date) > now;
  const hasBookedCall = !!myBooking; // an existing confirmed call, regardless of which plan it belongs to
  // Replaces handleTapPlan + handleUpgradePayment. No payment happens inside the app at all —
  // this just opens a conversation, pre-filled with exactly what Amit needs to send the right
  // Razorpay Payment Link: which program, its price, and the email to match the payment against.
  // Payment (via that link) and the membership flip both happen entirely outside the app; the
  // already-deployed Worker's webhook is what marks someone 'paid' once that external payment
  // completes, matching on the same email shared here.
  const contactCoach = (tier: 'single_consultation' | '90_day_program') => {
    if (planActive && myMembership.plan_type === tier) {
      // Already on this exact tier — nothing to arrange, offer to reschedule the existing call
      setRedirectPrompt(tier);
      return;
    }
    const planLabel = tier === '90_day_program' ? '90-Day Metabolic Reset' : 'Single Consultation';
    const priceLabel = tier === '90_day_program' ? '₹24,990' : '₹3,499';
    const message = `Hi Amit, I'd like to enroll in the ${planLabel} (${priceLabel}). My registered email: ${user?.email || '(not set)'}`;
    Linking.openURL(`https://wa.me/919891828688?text=${encodeURIComponent(message)}`).catch(() => {
      Alert.alert('Could not open WhatsApp', 'Please make sure WhatsApp is installed, or reach out by email instead.');
    });
  };
  const approachSteps = [
    { n: '01', icon: 'search', title: 'Diagnose the pattern', desc: 'Not just the symptom. I identify which biological system is blocking progress before recommending anything.' },
    { n: '02', icon: 'analytics', title: 'Biology before behaviour', desc: 'Sustainable habits follow when the biology is right. I fix the upstream problem first.' },
    { n: '03', icon: 'document-text', title: 'Read your data', desc: 'CGM reports, wearables, recovery markers. I work with your actual data — not generic advice.' },
    { n: '04', icon: 'shield-checkmark', title: 'Protocols that hold under stress', desc: 'Not just ideal conditions. Real life, real pressure, real results.' },
  ];
  const analyses = [
    'Deep metabolic intake across all 5 layers',
    'CGM and biomarker interpretation',
    'Root-cause nutrition and meal timing protocol',
    'Nervous system and stress recovery plan',
    'GLP-1 lifestyle integration (if applicable)',
    'Muscle Guard Protocol for lean mass preservation',
    'Weekly 1:1 check-ins and adjustments',
  ];

  return (
    <>
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="rocket" size={20} color={colors.red} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>Work With Amit</Text>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
        <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>Choose how you want to begin. Both options include a deep diagnostic conversation that identifies exactly what's blocking your progress.</Text>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
        <TouchableOpacity onPress={() => onNavigate('about')} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Not sure yet?</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red }}>Read Amit's story & methodology →</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <TouchableOpacity activeOpacity={0.95} onPress={() => setApproachExpanded(!approachExpanded)} style={{ borderRadius: 20, padding: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="compass" size={20} color={colors.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>My Approach</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>How I work with clients — 4 steps</Text>
            </View>
            <Ionicons name={approachExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
          </View>
          {approachExpanded && (
            <View style={{ marginTop: 18, gap: 14 }}>
              {approachSteps.map(s => (
                <View key={s.n} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.red, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.red }}>{s.n}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, paddingBottom: 2 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{s.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 }}>{s.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {planActive && (
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.red }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#22C55E', textTransform: 'uppercase' }}>Plan Active</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{myMembership.plan_type === '90_day_program' ? '90-Day Metabolic Reset' : '360° Transformation Blueprint'}</Text>
            {myBooking ? (
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 }}>
                Upcoming call: {new Date(myBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                {myBooking.booking_availability_template && ` at ${fmtSlotTime(myBooking.booking_availability_template.start_time)}`}
              </Text>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 }}>
                  No call currently booked — your plan is still active, so booking a new one is free.
                </Text>
                <TouchableOpacity onPress={() => setRebookFreeOpen(true)} style={{ marginTop: 12, backgroundColor: colors.red, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Book a Call</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={() => onNavigate('profile')} style={{ marginTop: 16, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red }}>Manage in My Program →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Option 1: Single Consultation — hidden once a plan is active (can't buy the same tier twice,
          and someone on the 90-day program doesn't need this either) */}
      {!planActive && (
      <>
      {/* Option 1: Single Consultation */}
      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: `${colors.red}30` }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${colors.red}14`, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="videocam" size={20} color={colors.red} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>360° Transformation Blueprint</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>45 min consultation · ₹3,499</Text>
            </View>
          </View>
          {!blueprintExpanded ? (
            <View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 }}>Deep metabolic intake covering 10 areas — sleep, gut health, hormonal panel, stress physiology, and more.</Text>
              <TouchableOpacity onPress={() => setBlueprintExpanded(true)}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red, marginBottom: 16 }}>View what's covered ↓</Text></TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16, marginTop: 4 }}>
                {['Sleep', 'Gut Health', 'Advanced Blood Work', 'Hormonal Panel', 'Human Behavior', 'Habit Pattern', 'Stress Physiology', 'Metabolic Health', 'Physical Fitness Level', 'Nutrition'].map(tag => (
                  <View key={tag} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.bg }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>{tag}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 8, fontStyle: 'italic' }}>By the end of the call, you'll know what's actually blocking your progress — and how to unlock it.</Text>
              <TouchableOpacity onPress={() => setBlueprintExpanded(false)}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.red, marginBottom: 16 }}>Show less ↑</Text></TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={() => contactCoach('single_consultation')} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Message Amit to Enroll →</Text>
          </TouchableOpacity>
        </View>
      </View>
      </>
      )}

      {/* Option 2: 90-Day Program — shown when nothing is active, or when single_consultation is
          active (upsell path). Hidden only when 90_day_program itself is already active. */}
      {(!planActive || myMembership.plan_type === 'single_consultation') && (
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <TouchableOpacity activeOpacity={0.97} onPress={() => setProgramExpanded(!programExpanded)} style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.red }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{ backgroundColor: colors.red, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>MOST POPULAR</Text></View>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>90 Days — 360° Metabolic Reset</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>₹24,990 (tax included)</Text>

          {!programExpanded ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>Full 90-day rebuild — deep intake, weekly 1:1s, nutrition & recovery protocols, built around your specific layer breakdown.</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red, marginTop: 10 }}>View full program details ↓</Text>
            </View>
          ) : (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>What's Included</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.5, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 12 }}>Built around your specific layer breakdown — not a generic template</Text>
              <View style={{ marginBottom: 4 }}>
                {analyses.map(a => (
                  <View key={a} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <Ionicons name="checkmark" size={13} color={colors.red} style={{ marginTop: 2 }} />
                    <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 17 }}>{a}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red, marginTop: 8 }}>Show less ↑</Text>
            </View>
          )}

          <TouchableOpacity onPress={() => contactCoach('90_day_program')} style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 18 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Message Amit to Enroll →</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
      )}

      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 16 }}>
        <TouchableOpacity onPress={() => Linking.openURL(BRAND.instagram)} style={{ backgroundColor: colors.card, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Follow on Instagram <Text style={{ color: colors.red }}>@amitbaruna</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollScreen>

    {/* Same-tier redirect prompt — tapped a plan they're already on (defensive; normally hidden already) */}
    {redirectPrompt && myBooking && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, width: '100%' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 }}>You already have a call booked</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 20 }}>
            You have a call booked for {new Date(myBooking.booking_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {myBooking.booking_availability_template && ` at ${fmtSlotTime(myBooking.booking_availability_template.start_time)}`}. Want to change it instead?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => setRedirectPrompt(null)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRedirectPrompt(null); setRescheduleFromRedirect(true); }} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Reschedule my call</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}
    {rescheduleFromRedirect && myBooking && (
      <SlotPickerModal
        planType={myMembership.plan_type || 'single_consultation'}
        razorpayLink=""
        price=""
        mode="reschedule"
        rescheduleBookingId={myBooking.id}
        onClose={() => { setRescheduleFromRedirect(false); booking.getMyBooking().then(setMyBooking).catch(() => {}); }}
        onNavigate={onNavigate}
      />
    )}

    {/* Upgrade-and-reuse prompt — buying 90-day while already having a booked call */}
    {rebookFreeOpen && (
      <SlotPickerModal
        planType={myMembership.plan_type || 'single_consultation'}
        razorpayLink=""
        price=""
        mode="rebook-free"
        onClose={() => { setRebookFreeOpen(false); booking.getMyBooking().then(setMyBooking).catch(() => {}); }}
        onNavigate={onNavigate}
      />
    )}
    </>
  );
}

function SlotPickerModal({ planType, razorpayLink, price, onClose, onNavigate, mode = 'book', rescheduleBookingId }: { planType: 'single_consultation' | '90_day_program'; razorpayLink: string; price: string; onClose: () => void; onNavigate: (s: ScreenId) => void; mode?: 'book' | 'reschedule' | 'rebook-free'; rescheduleBookingId?: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<{ date: string; label: string; slots: { id: string; label: string }[] }[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ id: string; label: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const fmtTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const localDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const template = await booking.getTemplate();
        // template loaded successfully
        const todayD = new Date();
        const toDate = new Date(todayD.getTime() + 14 * 24 * 60 * 60 * 1000);
        const fromStr = localDateStr(todayD);
        const toStr = localDateStr(toDate);
        const [exceptions, bookedRows] = await Promise.all([
          booking.getExceptions(fromStr, toStr),
          booking.getBookedSlots(fromStr, toStr),
        ]);
        // exceptions and booked rows loaded successfully
        const bookedSet = new Set(
          (Array.isArray(bookedRows) ? bookedRows : [])
            .filter((b: any) => b.status === 'confirmed' || (b.status === 'held' && new Date(b.hold_expires_at) > new Date()))
            .map((b: any) => `${b.booking_date}_${b.template_slot_id}`)
        );
        const blockedFullDays = new Set((Array.isArray(exceptions) ? exceptions : []).filter((e: any) => e.type === 'full_day_block').map((e: any) => e.exception_date));
        const blockedSlots = new Set((Array.isArray(exceptions) ? exceptions : []).filter((e: any) => e.type === 'slot_block').map((e: any) => `${e.exception_date}_${e.template_slot_id}`));

        const result: typeof days = [];
        for (let i = 0; i < 14 && result.length < 4; i++) {
          const d = new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate() + i);
          const dow = d.getDay(); // 0=Sun (local)
          if (dow === 0) continue;
          const dateStr = localDateStr(d);
          if (blockedFullDays.has(dateStr)) continue;
          const jsDowToTemplate = dow; // template uses 1=Mon..6=Sat, JS getDay() 1=Mon..6=Sat too (0=Sun excluded already)
          const isToday = i === 0;
          const cutoffMs = todayD.getTime() + 5 * 60 * 1000; // 5-minute buffer before a slot starts
          const daySlots = (Array.isArray(template) ? template : [])
            .filter((t: any) => Number(t.day_of_week) === jsDowToTemplate)
            .filter((t: any) => !bookedSet.has(`${dateStr}_${t.id}`) && !blockedSlots.has(`${dateStr}_${t.id}`))
            .filter((t: any) => {
              if (!isToday) return true;
              const [h, m] = String(t.start_time).split(':').map(Number);
              const slotStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
              return slotStart > cutoffMs;
            })
            .map((t: any) => ({ id: t.id, label: `${fmtTime(t.start_time)} – ${fmtTime(t.end_time)}` }));
          if (daySlots.length > 0) {
            result.push({ date: dateStr, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), slots: daySlots });
          }
        }
        // days with availability computed successfully
        setDays(result);
        if (result.length) setSelectedDay(result[0].date);
      } catch (e) {
        console.warn('Slot load failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const confirmHold = async () => {
    if (!selectedDay || !selectedSlot || !user?.id) return;

    // This flow no longer handles in-app payment at all — every real payment now happens
    // externally (WhatsApp/email → Razorpay link, confirmed by the Worker's webhook). This
    // function only ever runs for an already-active member picking a call slot, which is
    // free — no money changes hands here.
    setConfirming(true);
    try {
      const res = await booking.createFreeRebooking({ user_id: user.id, template_slot_id: selectedSlot.id, booking_date: selectedDay });
      const row = Array.isArray(res) ? res[0] : res;
      if (!row?.id) {
        console.warn('[SlotPicker] createFreeRebooking did not return a valid row:', res);
        Alert.alert('Could not book this slot', 'Please try again, and if it keeps happening, let Amit know.');
        return;
      }
      setConfirmed(true);
    } catch (e) {
      console.warn('[SlotPicker] createFreeRebooking threw:', e);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const confirmReschedule = async () => {
    if (!selectedDay || !selectedSlot || !rescheduleBookingId) return;
    setConfirming(true);
    try {
      const res = await booking.rescheduleBooking(rescheduleBookingId, selectedSlot.id, selectedDay);
      // rescheduleBooking succeeded
      const row = Array.isArray(res) ? res[0] : null;
      if (!row?.id) {
        Alert.alert('Could not reschedule', 'Something went wrong on our end. Please try again.');
        return;
      }
      setConfirmed(true);
    } catch (e) {
      console.warn('[SlotPicker] rescheduleBooking threw:', e);
      Alert.alert('Could not reschedule', 'Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  // testConfirmPayment removed — payment confirmation is now automatic, inside confirmHold,
  // via the real Worker verification. No manual "I've completed payment" step needed anymore.


  const selectedDayObj = days.find(d => d.date === selectedDay);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 20 }}>
      <View style={{ backgroundColor: colors.bg, borderRadius: 24, maxHeight: '80%', borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{confirmed ? (mode === 'reschedule' ? 'Rescheduled' : 'Booking Confirmed') : (mode === 'reschedule' ? 'Pick a new time' : 'Pick your slot')}</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0 }}>
          {confirmed ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(34,197,94,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="checkmark" size={32} color="#22C55E" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{mode === 'reschedule' ? "You're rescheduled!" : "You're booked!"}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>{selectedDayObj?.label} · {selectedSlot?.label}</Text>
              <TouchableOpacity onPress={() => { onClose(); onNavigate('profile'); }} style={{ marginTop: 24, backgroundColor: colors.red, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>View My Program</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <ActivityIndicator color={colors.red} style={{ marginTop: 40 }} />
          ) : days.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>No slots available right now — please check back soon.</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {days.map(d => (
                  <TouchableOpacity key={d.date} onPress={() => { setSelectedDay(d.date); setSelectedSlot(null); }} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginRight: 8, backgroundColor: selectedDay === d.date ? colors.red : colors.card }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedDay === d.date ? '#fff' : colors.text }}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {selectedDayObj?.slots.map(s => (
                  <TouchableOpacity key={s.id} onPress={() => setSelectedSlot(s)} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: selectedSlot?.id === s.id ? colors.red : colors.border, backgroundColor: selectedSlot?.id === s.id ? `${colors.red}14` : 'transparent' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedSlot?.id === s.id ? colors.red : colors.text }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {mode === 'reschedule' ? (
                selectedSlot ? (
                  <TouchableOpacity onPress={confirmReschedule} disabled={confirming} style={{ marginTop: 24, backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                    {confirming ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Confirm New Time →</Text>}
                  </TouchableOpacity>
                ) : (
                  <Text style={{ marginTop: 24, fontSize: 12, color: colors.textTertiary, textAlign: 'center' }}>Select a new slot to continue</Text>
                )
              ) : (
                selectedSlot ? (
                  <TouchableOpacity onPress={confirmHold} disabled={confirming} style={{ marginTop: 24, backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                    {confirming ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{mode === 'rebook-free' ? 'Confirm Slot →' : `Book · ${price} →`}</Text>}
                  </TouchableOpacity>
                ) : (
                  <Text style={{ marginTop: 24, fontSize: 12, color: colors.textTertiary, textAlign: 'center' }}>Select a slot to continue</Text>
                )
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ReportScreen({ onNavigate, scoreResult, userData }: { onNavigate: (s: ScreenId) => void; scoreResult?: any; userData?: any }) {
  const { colors } = useTheme();
  const { cravings: loggedCravings, symptoms: ctxSymptoms, scoreHistory, baseline } = useAppData();

  // Use real scoreResult if available, else fall back to latest scoreHistory
  const latestHistory = scoreHistory[0];
  const totalScore = scoreResult?.totalScore ?? latestHistory?.total_score ?? 0;
  const layerScores = scoreResult?.sc ?? (latestHistory ? { 1: latestHistory.layer1, 2: latestHistory.layer2, 3: latestHistory.layer3, 4: latestHistory.layer4, 5: latestHistory.layer5 } : {});
  const dominantLayer = scoreResult?.dominantLayer ?? 2;
  const pattern = scoreResult?.patternEngine?.dominant_pattern ?? latestHistory?.dominant_pattern ?? 'Pattern';
  const rcsVal = scoreResult?.rcs ?? latestHistory?.rcs ?? 0;
  const rcsInfo = scoreResult?.rcsInfo ?? getRCSInfo(rcsVal);
  const band = getBand(totalScore);

  // Real N1/N2/N3 via local engine
  const realUserData = { gender: userData?.gender || 'Male', age: userData?.age || '32', conditions: userData?.conditions || [], sleepScore: userData?.sleepScore || 5, stressScore: userData?.stressScore || 5, gutScore: userData?.gutScore || 5 };
  const n1Text = scoreResult ? generateLocalN1(scoreResult, realUserData) : rcsInfo.desc;
  const n2Text = scoreResult ? generateLocalN2(scoreResult, realUserData, scoreResult.history || [], []) : 'Take the test to see your hidden mechanism analysis.';
  const n3Data = scoreResult ? generateLocalN3(scoreResult, realUserData) : { title: 'Take the Test', body: 'Complete your Metabolic Score to see personalized recommendations.' };

  // Matched case studies (same logic as Results screen)
  const dominantLayers = [1, 2, 3, 4, 5].filter(i => layerScores[i] <= 11);
  const matchedCases = CASE_STUDIES.filter(cs => (CASE_LAYER_MAP[cs.id] || []).some(l => dominantLayers.includes(l))).slice(0, 3);

  // Dynamic 14-day countdown
  const lastTestDate = scoreHistory[0]?.date ? new Date(scoreHistory[0].date) : null;
  let retakeDaysText = 'Take your first test';
  if (lastTestDate) {
    const daysSince = Math.floor((Date.now() - lastTestDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 14 - daysSince);
    if (daysRemaining > 0) retakeDaysText = `${daysRemaining} days`;
    else retakeDaysText = 'Ready to retake';
  }

  // Report data
  const reportData = {
    name: 'User',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    age: baseline?.age || userData?.age || '—',
    gender: userData?.gender || '—',
    weight: baseline?.weight || '—',
    totalScore,
    band,
    rcs: rcsVal,
    rcsInfo,
    layers: [1, 2, 3, 4, 5].map(i => ({ id: i, name: LAYERS[i - 1].name, score: layerScores[i] || 0, color: LAYERS[i - 1].color })),
    dominantLayer,
    pattern,
    n1: n1Text,
    n2: n2Text,
    n3: n3Data,
  };

  // WhatsApp share text
  const shareText = `My Metabolic Score™ is ${totalScore}/100. Fat loss resistance: ${rcsInfo.compPct}%. Primary pattern: ${pattern}. Get yours at amitbaruna.com`;

  return (
    <ScrollScreen bg={colors.bg} bottomPad={40}>
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => onNavigate('results')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Report Preview</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Report Header */}
      <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
        <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: '#0D1B2A' }}>
          <View style={{ padding: 24, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#D42B2B', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Ionicons name="flash" size={24} color="#fff" /></View>
            <Text style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Metabolic Score™</Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>Comprehensive Analysis Report</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>{reportData.date}</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Age / Gender</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff', marginTop: 2 }}>{reportData.age} / {reportData.gender}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Weight</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff', marginTop: 2 }}>{reportData.weight} kg</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Retake in</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff', marginTop: 2 }}>{retakeDaysText}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 1. Score Summary */}
      <ReportSection title="1. Score Summary" colors={colors}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 10, color: colors.textTertiary, textTransform: 'uppercase' }}>Metabolic Permission Score</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: reportData.band.color }}>{reportData.totalScore}</Text>
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>/100</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: reportData.band.color }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>{reportData.band.status}</Text>
            </View>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 8 }}>Fat Loss Resistance</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: reportData.rcsInfo.color }}>{reportData.rcsInfo.label}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 18 }}>{reportData.band.label}</Text>
      </ReportSection>

      {/* 2. Layer Breakdown */}
      <ReportSection title="2. Layer Breakdown (5 Layers of Metabolic Permission™)" colors={colors}>
        <View style={{ gap: 12 }}>
          {reportData.layers.map(l => {
            const isDominant = l.id === reportData.dominantLayer;
            const col = l.score >= 14 ? '#639922' : l.score >= 9 ? '#BA7517' : '#E24B4A';
            return (
              <View key={l.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: `${l.color}20`, alignItems: 'center', justifyContent: 'center' }}><LayerIcon name={LAYERS[l.id - 1].icon} size={12} color={l.color} /></View>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.text }}>{l.name}</Text>
                  {isDominant && <View style={{ backgroundColor: colors.red, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#fff' }}>DOMINANT</Text></View>}
                  <Text style={{ fontSize: 12, fontWeight: '900', color: col }}>{l.score}/20</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden' }}><View style={{ height: 6, borderRadius: 3, backgroundColor: col, width: `${(l.score / 20) * 100}%` }} /></View>
              </View>
            );
          })}
        </View>
      </ReportSection>

      {/* 3. N1 — Readiness Brief */}
      <ReportSection title="3. Readiness Brief (N1)" colors={colors}>
        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>{reportData.n1}</Text>
      </ReportSection>

      {/* 4. N2 — Hidden Mechanism */}
      <ReportSection title="4. Hidden Mechanism — Why You're Stuck (N2)" colors={colors}>
        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>{reportData.n2}</Text>
      </ReportSection>

      {/* 5. N3 — Where to Begin */}
      <ReportSection title="5. Where to Begin — Your First Step (N3)" colors={colors}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>{reportData.n3.title}</Text>
        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>{reportData.n3.body}</Text>
      </ReportSection>

      {/* 6. Case Studies — Matched to Pattern */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, padding: 20, paddingBottom: 12, textTransform: 'uppercase' }}>6. Real Cases — Matched to Your Pattern</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            {(matchedCases.length > 0 ? matchedCases : CASE_STUDIES.slice(0, 3)).map(cs => (
              <TouchableOpacity key={cs.id} onPress={() => Linking.openURL(cs.reel)} activeOpacity={0.98} style={{ width: 200, marginRight: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg }}>
                <View style={{ height: 120, position: 'relative' }}>
                  <Image source={cs.photo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} /></View></View>
                </View>
                <View style={{ padding: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.red }}>{cs.result.split('·')[0]}</Text>
                  <Text style={{ fontSize: 9, color: colors.textTertiary, marginTop: 4 }}>{cs.layer}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* 7. Craving Patterns */}
      <ReportSection title="7. Craving Patterns (This Week)" colors={colors}>
        {loggedCravings.length === 0 ? (
          <Text style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', paddingVertical: 8 }}>No cravings logged this week.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {loggedCravings.slice(0, 7).map((c, i) => {
              const cravingType = CRAVING_TYPES.find(t => t.id === c.craving_type);
              return (
                <View key={c.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 16 }}>{cravingType?.icon}</Text>
                  <Text style={{ flex: 1, fontSize: 12, color: colors.text }}>{cravingType?.label} · {CRAVING_TIMING.find(t => t.id === c.timing)?.label || c.timing}</Text>
                  {c.mapped_layer ? <View style={{ backgroundColor: `${LAYERS[c.mapped_layer - 1].color}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: LAYERS[c.mapped_layer - 1].color }}>L{c.mapped_layer}</Text></View> : c.tier === 'habit' ? <View style={{ backgroundColor: colors.iconBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.textTertiary }}>HABIT</Text></View> : null}
                </View>
              );
            })}
          </View>
        )}
      </ReportSection>

      {/* 8. Symptoms */}
      <ReportSection title="8. Symptom Timeline" colors={colors}>
        {ctxSymptoms.length === 0 ? (
          <Text style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', paddingVertical: 8 }}>No symptoms logged.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {ctxSymptoms.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: colors.text }}>{s.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{s.since}</Text>
              </View>
            ))}
          </View>
        )}
      </ReportSection>

      {/* Retake Recommendation */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: colors.card, alignItems: 'center' }}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} style={{ marginBottom: 4 }} />
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>We recommend waiting 14 days between assessments. {retakeDaysText !== 'Ready to retake' ? `Your next assessment is in ${retakeDaysText}.` : 'You can retake now.'}</Text>
        </View>
      </View>

      {/* Disclaimer */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <View style={{ borderRadius: 12, padding: 12, backgroundColor: colors.card }}>
          <Text style={{ fontSize: 10, lineHeight: 16, color: colors.textTertiary, textAlign: 'center' }}>{DISCLAIMER}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 16, marginBottom: 24, alignItems: 'center' }}>
        <Text style={{ fontSize: 10, color: colors.textTertiary }}>Generated by Metabolic Score™ · {BRAND.fullName} · amitbaruna.com</Text>
        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>{BRAND.instagramHandle}</Text>
      </View>

      <View style={{ paddingHorizontal: 24, gap: 12 }}>
        <TouchableOpacity style={{ backgroundColor: colors.red, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="document-text" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>Download PDF Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareText)}`)} style={{ backgroundColor: '#25D366', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="logo-whatsapp" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Share via WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNavigate('results')} style={{ paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Back to Results</Text>
        </TouchableOpacity>
      </View>
    </ScrollScreen>
  );
}

function ReportSection({ title, colors, children }: { title: string; colors: ThemeColors; children: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
      <View style={{ borderRadius: 20, padding: 20, backgroundColor: colors.card }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.textSecondary, marginBottom: 16, textTransform: 'uppercase' }}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

// ============================================================
// HEALTH CONNECT SCREEN — Coming Soon
// ============================================================

function HealthConnectScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const { colors } = useTheme();

  // Floating/bouncing icons
  const metrics = [
    { icon: 'moon', label: 'Deep Sleep', color: '#7C5CFF' },
    { icon: 'heart-circle', label: 'HRV', color: '#22C55E' },
    { icon: 'eye', label: 'REM', color: '#4DA8FF' },
    { icon: 'speedometer', label: 'VO₂ Max', color: '#F59E0B' },
    { icon: 'heart', label: 'Resting HR', color: '#D42B2B' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Back button */}
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
            <TouchableOpacity onPress={() => onNavigate('profile')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, marginTop: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center' }}>Connect Health App</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 1, color: colors.red, marginTop: 6, textTransform: 'uppercase' }}>Phase 2 — Coming Soon</Text>
          </View>

          {/* Floating icons card */}
          <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
            <View style={{ borderRadius: 24, padding: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
                {metrics.map((m, i) => (
                  <BounceIcon key={m.label} icon={m.icon} label={m.label} color={m.color} delay={i * 150} />
                ))}
              </View>
            </View>
          </View>

          {/* Coming Soon badge */}
          <View style={{ paddingHorizontal: 24, marginTop: 20, alignItems: 'center' }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: `${colors.red}14`, borderWidth: 1, borderColor: `${colors.red}40` }}>
              <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1, color: colors.red, textTransform: 'uppercase' }}>Coming Soon</Text>
            </View>
          </View>

          {/* Description */}
          <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
            <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>
              We're building integrations with Apple Health and Health Connect (Android) to automatically sync your sleep, HRV, and heart rate data — making your Metabolic Score™ even more precise.
            </Text>
          </View>

          {/* Bottom back button */}
          <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
            <TouchableOpacity onPress={() => onNavigate('profile')} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function BounceIcon({ icon, label, color, delay }: { icon: string; label: string; color: string; delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -8, duration: 600, delay, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(translateY, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ alignItems: 'center', width: 80, transform: [{ translateY }] }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: '700', color: color, textAlign: 'center', letterSpacing: 0.5 }}>{label}</Text>
    </Animated.View>
  );
}

// ============================================================
// BOTTOM NAV
// ============================================================

function BottomNav({ active, onNavigate, hasScore }: { active: string; onNavigate: (s: ScreenId) => void; hasScore?: boolean }) {
  const { colors } = useTheme();
  const renderTab = (tab: { id: string; icon: string; label: string; screen: ScreenId }) => {
    const isActive = active === tab.id;
    return (
      <TouchableOpacity key={tab.id} onPress={() => onNavigate(tab.screen)} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 }}>
        <Ionicons name={tab.icon as any} size={20} color={isActive ? colors.red : colors.textSecondary} />
        <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? colors.red : colors.textSecondary }}>{tab.label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8 }}>
      {renderTab({ id: 'home', icon: 'home', label: 'Home', screen: 'home' })}
      {renderTab({ id: 'layers', icon: 'layers', label: 'Layers', screen: 'layers' })}
      <TouchableOpacity onPress={() => onNavigate(hasScore ? 'score-history' : 'score')} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.red, borderWidth: 3, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center', marginTop: -24, shadowColor: '#D42B2B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}>
          <Ionicons name="flash" size={24} color="#fff" />
        </View>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, marginTop: 2 }}>Score</Text>
      </TouchableOpacity>
      {renderTab({ id: 'library', icon: 'book', label: 'Library', screen: 'library' })}
      {renderTab({ id: 'profile', icon: 'person', label: 'Profile', screen: 'profile' })}
    </View>
  );
}

// ============================================================
// APP NAVIGATOR
// ============================================================

function AppNavigator() {
  const { user, loading } = useAuth();
  const { hasScore, saveScore, setLastQuizAnswers, scoreHistory } = useAppData();
  const [screen, setScreen] = useState<ScreenId>('splash');
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  // In-memory only (not persisted) — reset on sign-in/sign-out/account switch so a
  // freshly logged-in account never inherits the previous account's quiz result.
  // Same identity signal (user?.id) that AppDataContext's own identity-change check is built from.
  useEffect(() => { setScoreResult(null); }, [user?.id]);
  const [userData, setUserData] = useState<UserData>({ gender: 'Male', age: '26–35', conditions: [], sleepScore: 5, stressScore: 5, gutScore: 5 });
  const [selectedLayer, setSelectedLayer] = useState(1);
  const [selectedArticle, setSelectedArticle] = useState<Insight | null>(null);
  const [cravingsReturnTo, setCravingsReturnTo] = useState<ScreenId>('home');
  const goToCravings = (from: ScreenId) => { setCravingsReturnTo(from); navigate('cravings'); };
  const [autoExpandN3, setAutoExpandN3] = useState(false);
  // Cross-screen signal for "jump to Today's 1% and blink it" — a timestamp, not a boolean,
  // so it re-triggers even if fired twice while already on Home (a boolean set to true when
  // it's already true wouldn't register as a change and the blink wouldn't fire again).
  const [highlightTodaysOne, setHighlightTodaysOne] = useState(0);
  const goToTodaysOne = useCallback(() => {
    setAutoExpandN3(false);
    setScreen('home');
    setHighlightTodaysOne(Date.now());
  }, []);

  const navigate = useCallback((s: ScreenId) => {
    setAutoExpandN3(false); // Reset on normal navigation
    setScreen(s);
  }, []);

  const navigateToResultsFromHope = useCallback(() => {
    setAutoExpandN3(true);
    setScreen('results');
  }, []);


  const [complianceFromProfile, setComplianceFromProfile] = useState(false);
  useEffect(() => {
    (async () => {
      const dpdp = await AsyncStorage.getItem('ms_dpdp_accepted');
      const t = setTimeout(() => {
        if (!loading) {
          // Only resolve the initial splash decision — never hijack navigation
          // if the app has already moved on (e.g. into onboarding) since this
          // timer was armed. Without this guard, this effect re-fires on every
          // `user`/`loading` change (including right after sign-in) and was
          // forcibly bouncing users out of onboarding back to Home ~1.5s later.
          setScreen(prev => {
            if (prev !== 'splash') return prev;
            if (user) return 'home';
            if (!dpdp) return 'compliance';
            return 'login';
          });
        }
      }, 1500);
      return () => clearTimeout(t);
    })();
  }, [user, loading]);

  const handleScoreComplete = (result: ScoreResult, data: UserData) => {
    setScoreResult(result);
    setUserData(data);
    setLastQuizAnswers(result.history);
    saveScore({
      total_score: result.totalScore,
      layer1: result.sc[1], layer2: result.sc[2], layer3: result.sc[3], layer4: result.sc[4], layer5: result.sc[5],
      rcs: result.rcs, dominant_pattern: result.patternEngine.dominant_pattern,
      dominant_pattern_confidence: result.patternEngine.dominant_pattern_confidence,
      answers: result.history,
      cascade_risk: result.cascadeRisk,
      dominant_layer: result.dominantLayer,
      time_spent_seconds: data.timeSpentSeconds ?? null,
      engagement_grade: data.timeSpentSeconds != null ? getEngagementGrade(data.timeSpentSeconds) : null,
    }).catch(() => {});
    referral.markQuizCompleted().catch(() => {});
    setScreen('results');
  };

  if (screen === 'splash') return <SplashScreen />;

  switch (screen) {
    case 'login': return <LoginScreen onNavigate={navigate} />;
    case 'compliance': return <ComplianceScreen onNavigate={navigate} fromProfile={complianceFromProfile} />;
    case 'onboarding': return <OnboardingScreen onNavigate={navigate} />;
    case 'home': return <HomeScreen onNavigate={navigate} hasScore={hasScore || !!scoreResult} scoreResult={scoreResult} onSelectLayer={(id) => { setSelectedLayer(id); navigate('layer-detail'); }} onNavigateToResultsFromHope={navigateToResultsFromHope} onSelectArticle={(a) => { setSelectedArticle(a); navigate('article-reader'); }} onGoToCravings={goToCravings} highlightTodaysOne={highlightTodaysOne} />;
    case 'score': return <ScoreToolScreen onNavigate={navigate} onComplete={handleScoreComplete} />;
    case "results": {
      // scoreResult is in-session-only (null after sign-in without retaking the quiz this
      // session). Falls back to reconstructing from the latest persisted row, same pattern
      // as the score-summary card's expanded section — reconstructScoreResultFromHistory
      // itself returns null for rows saved before the 2026-07-30 cascade_risk/dominant_layer
      // persistence fix, so pre-fix rows correctly still show nothing (HomeScreen) here.
      const effectiveScoreResult = scoreResult ?? (scoreHistory[0] ? reconstructScoreResultFromHistory(scoreHistory[0]) : null);
      return effectiveScoreResult ? <ResultsScreen onNavigate={navigate} result={effectiveScoreResult as ScoreResult} userData={userData} autoExpandN3={autoExpandN3} onSelectLayer={(id) => setSelectedLayer(id)} /> : <HomeScreen onNavigate={navigate} hasScore={hasScore} />;
    }
    case 'layers': return <LayersHubScreen onNavigate={navigate} onSelectLayer={(id) => { setSelectedLayer(id); navigate('layer-detail'); }} hasScore={hasScore || !!scoreResult} scoreResult={scoreResult} />;
    case 'layer-detail': return <LayerDetailScreen onNavigate={navigate} layerId={selectedLayer} onSelectArticle={(a) => { setSelectedArticle(a); navigate('article-reader'); }} />;
    case 'library': return <LibraryScreen onNavigate={navigate} hasScore={hasScore || !!scoreResult} scoreResult={scoreResult} onSelectArticle={(a) => { setSelectedArticle(a); navigate('article-reader'); }} />;
    case 'article-reader': return <ArticleReaderScreen onNavigate={navigate} article={selectedArticle} />;
    case 'about': return <AboutScreen onNavigate={navigate} />;
    case 'specialisation': return <SpecialisationScreen onNavigate={navigate} />;
    case 'cases': return <CaseStudiesScreen onNavigate={navigate} />;
    case 'transformations': return <TransformationsScreen onNavigate={navigate} />;
    case 'cravings': return <CravingsLogScreen onNavigate={navigate} returnTo={cravingsReturnTo} />;
    case 'weekly-cravings': return <WeeklyCravingSummaryScreen onNavigate={navigate} onGoToCravings={goToCravings} />;
    case 'symptom-tracker': return <SymptomTrackerScreen onNavigate={navigate} />;
    case 'profile': return <ProfileScreen onNavigate={(s: ScreenId) => { setComplianceFromProfile(s === 'compliance'); setAutoExpandN3(false); setScreen(s); }} hasScore={hasScore || !!scoreResult} scoreResult={scoreResult} onGoToCravings={goToCravings} onGoToTodaysOne={goToTodaysOne} />;
    case 'customize': return <CustomizeHomeScreen onNavigate={navigate} />;
    case 'booking': return <BookingScreen onNavigate={navigate} />;
    case 'report': return <ReportScreen onNavigate={navigate} scoreResult={scoreResult} userData={userData} />;
    case 'health-connect': return <HealthConnectScreen onNavigate={navigate} />;
    case 'score-history': return <ScoreHistoryScreen onNavigate={navigate} />;
    default: return <HomeScreen onNavigate={navigate} hasScore={hasScore} />;
  }
}

// ============================================================
// APP (default export)
// ============================================================

// Real error boundary — must be a class component, React has no hook equivalent for this.
// Without this, any single screen crashing takes down the entire app to a blank white screen,
// with no way to recover except force-closing. This catches it and offers a way back in,
// without losing the user's actual data (nothing here touches storage, it's purely a render
// fallback).
class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error('[ErrorBoundary] caught a crash:', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#D42B2B" />
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 16, textAlign: 'center' }}>Something went wrong</Text>
          <Text style={{ fontSize: 13, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 19 }}>This screen ran into a problem. Your data is safe — tap below to continue.</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })} style={{ marginTop: 24, backgroundColor: '#D42B2B', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children as any;
  }
}

// Catches what ErrorBoundary structurally cannot — errors in async code (promises, event
// handlers, setTimeout callbacks) never reach a React error boundary, since boundaries only
// catch errors thrown during render. A silent app reload with zero error shown, zero log
// written, is the exact signature of this category of bug. This won't stop it from happening,
// but it guarantees the next occurrence leaves a real trace instead of nothing.
if (typeof (global as any).ErrorUtils !== 'undefined') {
  const previousHandler = (global as any).ErrorUtils.getGlobalHandler?.();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.error('[GlobalError]', isFatal ? 'FATAL' : 'non-fatal', error?.message || error, error?.stack);
    if (previousHandler) previousHandler(error, isFatal);
  });
}

export default function App() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
        });
      } catch (e) {
        console.warn('Font load failed:', e);
      } finally {
        setFontsReady(true);
      }
    })();
  }, []);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#D42B2B" size="large" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ClinicalDepthProvider>
            <AppDataProvider>
              <AppInner />
            </AppDataProvider>
          </ClinicalDepthProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function AppInner() {
  const { theme } = useTheme();
  const colors = THEMES[theme];
  return (
    <>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} backgroundColor={colors.bg} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppNavigator />
      </View>
    </>
  );
}
