import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { profiles as profileApi, scores as scoreApi, cravings as cravingApi, nps as npsApi } from '../config/supabase';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CravingEntry = {
  id: string;
  craving_type: string;
  timing: string;
  context?: string;
  mapped_layer: number | null;
  mechanism: string;
  tier: 'book' | 'practitioner' | 'habit';
  confidence?: string;
  created_at: string;
};

export type SymptomEntry = {
  name: string;
  severity?: string;
  since: string;
  mapped_layer?: number | null;   // from computeSymptomMapping — undefined for legacy entries logged before this existed
  secondary_layers?: number[] | null;
  mechanism?: string;
  tier?: 'book' | 'author_interview' | 'practitioner';
  confidence?: string;
  triage_flag?: boolean;          // true for the six excluded symptoms — "worth mentioning to a doctor," never layer-scored
};

export type BaselineEntry = {
  age?: string;
  height?: string;
  weight?: string;
};

export type ScoreHistoryEntry = {
  id: string;
  date: string;
  total_score: number;
  layer1: number;
  layer2: number;
  layer3: number;
  layer4: number;
  layer5: number;
  dominant_pattern?: string;
  rcs?: number;
  answers?: { layer: number; q: number; selected: number[]; score: number }[];
};

export type MiniQuizMap = Record<number, number[]>;

type DataContextType = {
  hasScore: boolean;
  scoreHistory: ScoreHistoryEntry[];
  refreshScoreHistory: () => Promise<void>;
  saveProfile: (data: any) => Promise<void>;
  saveScore: (data: any) => Promise<void>;
  cravings: CravingEntry[];
  saveCraving: (entry: Omit<CravingEntry, 'id' | 'created_at'>) => Promise<void>;
  updateCraving: (id: string, updates: Partial<Omit<CravingEntry, 'id' | 'created_at'>>) => Promise<void>;
  saveNpsRating: (score: number, context?: { total_score?: number; dominant_layer?: number }) => Promise<void>;
  deleteCraving: (id: string) => Promise<void>;
  refreshCravings: () => Promise<void>;
  symptoms: SymptomEntry[];
  setSymptoms: (list: SymptomEntry[]) => Promise<void>;
  goals: string[];
  setGoals: (list: string[]) => Promise<void>;
  fatDeposition: string;
  setFatDeposition: (id: string) => Promise<void>;
  baseline: BaselineEntry;
  setBaseline: (data: BaselineEntry) => Promise<void>;
  conditions: string[];
  setConditions: (data: string[]) => Promise<void>;
  miniQuiz: MiniQuizMap;
  setMiniQuizAnswers: (layerId: number, answers: number[]) => Promise<void>;
  lastQuizAnswers: { layer: number; q: number; selected: number[]; score: number }[];
  setLastQuizAnswers: (answers: { layer: number; q: number; selected: number[]; score: number }[]) => void;
  loading: boolean;
};

const DataContext = createContext<DataContextType>({} as DataContextType);

const KEYS = {
  hasScore: 'ms_has_score',
  cravings: 'ms_cravings',
  symptoms: 'ms_symptoms',
  goals: 'ms_goals',
  fatDeposition: 'ms_fat_deposition',
  baseline: 'ms_baseline',
  scoreHistory: 'ms_score_history',
  miniQuiz: 'ms_mini_quiz',
  lastQuizAnswers: 'ms_last_quiz_answers',
  conditions: 'ms_conditions',
};

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const nowISO = () => new Date().toISOString();

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) as T : fallback;
  } catch { return fallback; }
}
async function writeJSON(key: string, value: any) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hasScore, setHasScore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cravings, setCravingsState] = useState<CravingEntry[]>([]);
  const [symptoms, setSymptomsState] = useState<SymptomEntry[]>([]);
  const [goals, setGoalsState] = useState<string[]>([]);
  const [fatDeposition, setFatDepositionState] = useState<string>('');
  const [baseline, setBaselineState] = useState<BaselineEntry>({});
  const [conditions, setConditionsState] = useState<string[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([]);
  const [miniQuiz, setMiniQuizState] = useState<MiniQuizMap>({});
  const [lastQuizAnswers, setLastQuizAnswersState] = useState<{ layer: number; q: number; selected: number[]; score: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [c, s, g, fd, bl, sh, hs, mq, lqa, cond] = await Promise.all([
        readJSON<CravingEntry[]>(KEYS.cravings, []),
        readJSON<SymptomEntry[]>(KEYS.symptoms, []),
        readJSON<string[]>(KEYS.goals, []),
        AsyncStorage.getItem(KEYS.fatDeposition).then(v => v || ''),
        readJSON<BaselineEntry>(KEYS.baseline, {}),
        readJSON<ScoreHistoryEntry[]>(KEYS.scoreHistory, []),
        AsyncStorage.getItem(KEYS.hasScore).then(v => v === 'true'),
        readJSON<MiniQuizMap>(KEYS.miniQuiz, {}),
        readJSON<{ layer: number; q: number; selected: number[]; score: number }[]>(KEYS.lastQuizAnswers, []),
        readJSON<string[]>(KEYS.conditions, []),
      ]);
      setCravingsState(c); setSymptomsState(s); setGoalsState(g);
      setFatDepositionState(fd); setBaselineState(bl); setScoreHistory(sh);
      setHasScore(hs); setMiniQuizState(mq); setLastQuizAnswersState(lqa);
      setConditionsState(cond);

      if (user?.id) {
        try {
          const [remoteScores, remoteCravings, remoteProfile] = await Promise.all([
            scoreApi.list(user.id).catch(() => []),
            cravingApi.list(user.id).catch(() => []),
            profileApi.get(user.id).catch(() => []),
          ]);
          if (Array.isArray(remoteScores) && remoteScores.length > 0) {
            const mapped: ScoreHistoryEntry[] = remoteScores.map((row: any) => ({
              id: row.id,
              date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              total_score: row.total_score,
              layer1: row.layer1, layer2: row.layer2, layer3: row.layer3,
              layer4: row.layer4, layer5: row.layer5,
              dominant_pattern: row.dominant_pattern, rcs: row.rcs,
              answers: row.answers || null,
            }));
            setScoreHistory(mapped);
            await writeJSON(KEYS.scoreHistory, mapped);
            setHasScore(true);
            await AsyncStorage.setItem(KEYS.hasScore, 'true');
          }
          if (Array.isArray(remoteCravings) && remoteCravings.length > 0) {
            const mappedC: CravingEntry[] = remoteCravings.map((row: any) => ({
              id: row.id, craving_type: row.craving_type, timing: row.timing,
              context: row.context, mapped_layer: row.mapped_layer, mechanism: row.mechanism,
              tier: row.tier, confidence: row.confidence, created_at: row.created_at,
            }));
            setCravingsState(mappedC);
            await writeJSON(KEYS.cravings, mappedC);
          }
          if (Array.isArray(remoteProfile) && remoteProfile.length > 0) {
            const p = remoteProfile[0];
            if (Array.isArray(p.symptoms)) { setSymptomsState(p.symptoms); await writeJSON(KEYS.symptoms, p.symptoms); }
            if (Array.isArray(p.goals)) { setGoalsState(p.goals); await writeJSON(KEYS.goals, p.goals); }
            if (p.fat_deposition) { setFatDepositionState(p.fat_deposition); await AsyncStorage.setItem(KEYS.fatDeposition, p.fat_deposition); }
            if (p.baseline && typeof p.baseline === 'object') { setBaselineState(p.baseline); await writeJSON(KEYS.baseline, p.baseline); }
            if (Array.isArray(p.conditions)) { setConditionsState(p.conditions); await writeJSON(KEYS.conditions, p.conditions); }
          }
        } catch (e) { console.warn('Background sync failed (non-blocking):', e); }
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const saveCraving = useCallback(async (entry: Omit<CravingEntry, 'id' | 'created_at'>) => {
    const newEntry: CravingEntry = { ...entry, id: uuid(), created_at: nowISO() };
    const updated = [newEntry, ...cravings];
    setCravingsState(updated);
    await writeJSON(KEYS.cravings, updated);
    try {
      if (user?.id) {
        await cravingApi.save({
          craving_type: entry.craving_type, timing: entry.timing, context: entry.context || null,
          mapped_layer: entry.mapped_layer, mechanism: entry.mechanism, tier: entry.tier, confidence: entry.confidence || null,
        });
      }
    } catch (e) { console.warn('Craving sync failed (kept locally):', e); }
  }, [cravings, user?.id]);

  const saveNpsRating = useCallback(async (score: number, context?: { total_score?: number; dominant_layer?: number }) => {
    try {
      if (user?.id) {
        await npsApi.save({
          score,
          total_score: context?.total_score ?? null,
          dominant_layer: context?.dominant_layer ?? null,
        });
      }
    } catch (e) { console.warn('NPS rating sync failed:', e); }
  }, [user?.id]);

  const updateCraving = useCallback(async (id: string, updates: Partial<Omit<CravingEntry, 'id' | 'created_at'>>) => {
    const updated = cravings.map(c => c.id === id ? { ...c, ...updates } : c);
    setCravingsState(updated);
    await writeJSON(KEYS.cravings, updated);
    try {
      if (user?.id) {
        await cravingApi.update(id, updates);
      }
    } catch (e) { console.warn('Craving update sync failed (kept locally):', e); }
  }, [cravings, user?.id]);

  const deleteCraving = useCallback(async (id: string) => {
    const updated = cravings.filter(c => c.id !== id);
    setCravingsState(updated);
    await writeJSON(KEYS.cravings, updated);
  }, [cravings]);

  const refreshCravings = useCallback(async () => {
    // Always load from AsyncStorage first (instant, offline-friendly)
    try {
      const local = await readJSON<CravingEntry[]>(KEYS.cravings, []);
      if (local.length > 0) setCravingsState(local);
    } catch (e) { /* ignore */ }

    // Then try Supabase (background sync) — but MERGE, don't overwrite local
    if (!user?.id) return;
    try {
      const remote = await cravingApi.list(user.id);
      if (Array.isArray(remote) && remote.length > 0) {
        const remoteMapped: CravingEntry[] = remote.map((row: any) => ({
          id: row.id, craving_type: row.craving_type, timing: row.timing,
          context: row.context, mapped_layer: row.mapped_layer, mechanism: row.mechanism,
          tier: row.tier, confidence: row.confidence, created_at: row.created_at,
        }));
        // Merge: keep local entries that don't have a remote counterpart (by created_at)
        const remoteTimestamps = new Set(remoteMapped.map(r => r.created_at));
        const localOnly = (await readJSON<CravingEntry[]>(KEYS.cravings, [])).filter(l => !remoteTimestamps.has(l.created_at));
        const merged = [...remoteMapped, ...localOnly].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setCravingsState(merged);
        await writeJSON(KEYS.cravings, merged);
      }
    } catch (e) { console.warn('refreshCravings failed (kept local):', e); }
  }, [user?.id]);

  const setSymptoms = useCallback(async (list: SymptomEntry[]) => {
    setSymptomsState(list);
    await writeJSON(KEYS.symptoms, list);
    try { if (user?.id) await profileApi.updateFields(user.id, { symptoms: list }); } catch (e) { console.warn('Symptoms sync failed:', e); }
  }, [user?.id]);

  const setGoals = useCallback(async (list: string[]) => {
    setGoalsState(list);
    await writeJSON(KEYS.goals, list);
    try { if (user?.id) await profileApi.updateFields(user.id, { goals: list }); } catch (e) { console.warn('Goals sync failed:', e); }
  }, [user?.id]);

  const setFatDeposition = useCallback(async (id: string) => {
    setFatDepositionState(id);
    await AsyncStorage.setItem(KEYS.fatDeposition, id);
    try { if (user?.id) await profileApi.updateFields(user.id, { fat_deposition: id }); } catch (e) { console.warn('FatDeposition sync failed:', e); }
  }, [user?.id]);

  const setBaseline = useCallback(async (data: BaselineEntry) => {
    setBaselineState(data);
    await writeJSON(KEYS.baseline, data);
    try { if (user?.id) await profileApi.updateFields(user.id, { baseline: data }); } catch (e) { console.warn('Baseline sync failed:', e); }
  }, [user?.id]);

  const setConditions = useCallback(async (data: string[]) => {
    setConditionsState(data);
    await writeJSON(KEYS.conditions, data);
    try { if (user?.id) await profileApi.updateFields(user.id, { conditions: data }); } catch (e) { console.warn('Conditions sync failed:', e); }
  }, [user?.id]);

  const saveProfile = useCallback(async (data: any) => {
    if (!user) return;
    try { await profileApi.upsert({ id: user.id, email: user.email, ...data }); } catch (e) { console.warn('saveProfile', e); }
  }, [user]);

  const refreshScoreHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const remote = await scoreApi.list(user.id);
      if (Array.isArray(remote)) {
        const mapped: ScoreHistoryEntry[] = remote.map((row: any) => ({
          id: row.id,
          date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          total_score: row.total_score,
          layer1: row.layer1, layer2: row.layer2, layer3: row.layer3,
          layer4: row.layer4, layer5: row.layer5,
          dominant_pattern: row.dominant_pattern, rcs: row.rcs,
          answers: row.answers || null,
        }));
        setScoreHistory(mapped);
        await writeJSON(KEYS.scoreHistory, mapped);
      }
    } catch (e) { console.warn('refreshScoreHistory failed:', e); }
  }, [user?.id]);

  const saveScore = useCallback(async (data: any) => {
    let currentUser = user;
    if (!currentUser) {
      try { currentUser = await (await import('../config/supabase')).auth.getSession(); } catch { /* ignore */ }
    }
    if (!currentUser) {
      console.warn('[saveScore] No user session — score not saved to Supabase (kept locally only)');
      setHasScore(true);
      await AsyncStorage.setItem(KEYS.hasScore, 'true');
      return;
    }
    // LOCAL BACKUP: Always save to AsyncStorage first
    const localEntry: ScoreHistoryEntry = {
      id: 'local-' + Date.now(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      total_score: data.total_score,
      layer1: data.layer1, layer2: data.layer2, layer3: data.layer3,
      layer4: data.layer4, layer5: data.layer5,
      dominant_pattern: data.dominant_pattern, rcs: data.rcs,
    };
    const updatedHistory = [localEntry, ...scoreHistory];
    setScoreHistory(updatedHistory);
    await writeJSON(KEYS.scoreHistory, updatedHistory);
    try {
      const result = await scoreApi.save(data);
      if (result && (result.code || result.error) && !Array.isArray(result)) {
        console.warn('[saveScore] Supabase save returned error:', result);
      } else {
        console.log('[saveScore] Supabase save succeeded — refreshing history');
        refreshScoreHistory();
      }
    } catch (e) { console.warn('[saveScore] save failed:', e); }
    setHasScore(true);
    await AsyncStorage.setItem(KEYS.hasScore, 'true');
  }, [user, scoreHistory, refreshScoreHistory]);

  const setMiniQuizAnswers = useCallback(async (layerId: number, answers: number[]) => {
    const updated = { ...miniQuiz, [layerId]: answers };
    setMiniQuizState(updated);
    await writeJSON(KEYS.miniQuiz, updated);
    try { if (user?.id) await profileApi.updateFields(user.id, { mini_quiz: updated }); } catch (e) { console.warn('Mini-quiz sync failed:', e); }
  }, [miniQuiz, user?.id]);

  const setLastQuizAnswers = useCallback((answers: { layer: number; q: number; selected: number[]; score: number }[]) => {
    setLastQuizAnswersState(answers);
    writeJSON(KEYS.lastQuizAnswers, answers);
  }, []);

  return (
    <DataContext.Provider value={{
      hasScore, scoreHistory, refreshScoreHistory, saveProfile, saveScore,
      cravings, saveCraving, updateCraving, saveNpsRating, deleteCraving, refreshCravings, symptoms, setSymptoms, goals, setGoals,
      fatDeposition, setFatDeposition, baseline, setBaseline, conditions, setConditions,
      miniQuiz, setMiniQuizAnswers, lastQuizAnswers, setLastQuizAnswers, loading,
    }}>
      {children}
    </DataContext.Provider>
  );
}
export function useAppData() { return useContext(DataContext); }
