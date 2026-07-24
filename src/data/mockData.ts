/**
 * Mock data + mock services for DEMO MODE.
 * These mirror the Supabase API shape so swapping to live mode is seamless.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  user: 'ms_demo_user',
  scores: 'ms_demo_scores',
  profile: 'ms_demo_profile',
};

export type DemoUser = {
  id: string;
  email: string;
  user_metadata: { full_name: string; avatar_url?: string };
};

export type ScoreRecord = {
  id: string;
  user_id: string;
  total: number;
  layers: Record<string, number>;
  answers: Record<string, number | string>;
  tier: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  age?: number;
  gender?: string;
  height_cm?: number;
  weight_kg?: number;
  symptoms?: string[];
  conditions?: string[];
  medications?: string[];
  onboarded?: boolean;
};

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: any) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ---------- AUTH ----------
export const mockAuthService = {
  async signInWithEmail(email: string, _password: string) {
    await delay();
    const user: DemoUser = {
      id: 'demo-' + email,
      email,
      user_metadata: { full_name: email.split('@')[0] },
    };
    await writeJSON(KEYS.user, user);
    return { user };
  },

  async signUpWithEmail(email: string, _password: string, name: string) {
    await delay();
    const user: DemoUser = {
      id: 'demo-' + email,
      email,
      user_metadata: { full_name: name },
    };
    await writeJSON(KEYS.user, user);
    return { user };
  },

  async signInWithGoogle() {
    await delay();
    const user: DemoUser = {
      id: 'demo-google-user',
      email: 'guest@gmail.com',
      user_metadata: { full_name: 'Google Guest' },
    };
    await writeJSON(KEYS.user, user);
    return { user };
  },

  async signOut() {
    await AsyncStorage.removeItem(KEYS.user);
  },

  async getSession() {
    const user = await readJSON<DemoUser | null>(KEYS.user, null);
    return user ? { user } : null;
  },

  onAuthStateChange(_callback: (event: string, session: any) => void) {
    // No-op in demo mode; AuthContext handles initial load.
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

// ---------- SCORES ----------
export const mockScoreService = {
  async save(payload: any) {
    await delay();
    const user = await readJSON<DemoUser | null>(KEYS.user, null);
    const record: ScoreRecord = {
      id: uuid(),
      user_id: user?.id || 'anon',
      total: payload.total,
      layers: payload.layers,
      answers: payload.answers,
      tier: payload.tier,
      created_at: new Date().toISOString(),
    };
    const scores = await readJSON<ScoreRecord[]>(KEYS.scores, []);
    scores.unshift(record);
    await writeJSON(KEYS.scores, scores);
    return record;
  },

  async list(userId: string) {
    await delay(300);
    const scores = await readJSON<ScoreRecord[]>(KEYS.scores, []);
    return scores.filter((s) => s.user_id === userId);
  },
};

// ---------- PROFILE ----------
export const mockProfileService = {
  async get(userId: string) {
    await delay(200);
    const profiles = await readJSON<Record<string, Profile>>(KEYS.profile, {});
    return profiles[userId] || null;
  },

  async upsert(profile: any) {
    await delay();
    const profiles = await readJSON<Record<string, Profile>>(KEYS.profile, {});
    profiles[profile.id] = { ...profiles[profile.id], ...profile };
    await writeJSON(KEYS.profile, profiles);
    return profiles[profile.id];
  },
};

// ---------- SEED DATA (first run) ----------
export async function seedDemoDataIfEmpty() {
  const existing = await readJSON<ScoreRecord[] | null>(KEYS.scores, null);
  if (existing && existing.length > 0) return;

  const now = Date.now();
  const seeded: ScoreRecord[] = [
    {
      id: uuid(),
      user_id: 'demo-seed',
      total: 58,
      layers: { sleep: 45, stress: 52, gut: 68, movement: 61, nervous: 64 },
      answers: {},
      tier: 'Building',
      created_at: new Date(now - 1000 * 60 * 60 * 24 * 28).toISOString(),
    },
    {
      id: uuid(),
      user_id: 'demo-seed',
      total: 64,
      layers: { sleep: 55, stress: 58, gut: 72, movement: 65, nervous: 70 },
      answers: {},
      tier: 'Building',
      created_at: new Date(now - 1000 * 60 * 60 * 24 * 21).toISOString(),
    },
    {
      id: uuid(),
      user_id: 'demo-seed',
      total: 71,
      layers: { sleep: 68, stress: 65, gut: 78, movement: 72, nervous: 74 },
      answers: {},
      tier: 'Optimising',
      created_at: new Date(now - 1000 * 60 * 60 * 24 * 14).toISOString(),
    },
    {
      id: uuid(),
      user_id: 'demo-seed',
      total: 76,
      layers: { sleep: 74, stress: 70, gut: 82, movement: 78, nervous: 76 },
      answers: {},
      tier: 'Optimising',
      created_at: new Date(now - 1000 * 60 * 60 * 24 * 7).toISOString(),
    },
  ];
  await writeJSON(KEYS.scores, seeded);
}
