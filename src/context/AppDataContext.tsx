import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { profiles as profileApi, scores as scoreApi, cravings as cravingApi, nps as npsApi, reportDownloads as reportDownloadsApi, checkins as checkinApi, actionContent, notificationLog } from '../config/supabase';
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
  created_at: string;
  total_score: number;
  layer1: number;
  layer2: number;
  layer3: number;
  layer4: number;
  layer5: number;
  dominant_pattern?: string;
  rcs?: number;
  answers?: { layer: number; q: number; selected: number[]; score: number; ansIdx: number }[];
  cascade_risk: string | null;
  dominant_layer: number | null;
  time_spent_seconds?: number | null;
  engagement_grade?: string | null;
  dominant_pattern_confidence?: number | null;
};

export type MiniQuizMap = Record<number, number[]>;

type DataContextType = {
  hasScore: boolean;
  fullName: string;
  scoreHistory: ScoreHistoryEntry[];
  refreshScoreHistory: () => Promise<void>;
  // identityOverride: for callers (e.g. OnboardingScreen, right after signUp) that have a
  // just-created user id/email in hand but can't rely on this context's own `user` having
  // caught up to the new session yet — see saveProfile's implementation comment.
  saveProfile: (data: any, identityOverride?: { id: string; email?: string | null }) => Promise<void>;
  saveScore: (data: any) => Promise<void>;
  cravings: CravingEntry[];
  saveCraving: (entry: Omit<CravingEntry, 'id' | 'created_at'>) => Promise<void>;
  updateCraving: (id: string, updates: Partial<Omit<CravingEntry, 'id' | 'created_at'>>) => Promise<void>;
  saveNpsRating: (score: number, context?: { total_score?: number; dominant_layer?: number }) => Promise<void>;
  logReportDownload: (reportType?: string) => Promise<void>;
  // Returns whether the write actually succeeded — callers use this to gate optimistic
  // local/AsyncStorage state, rather than assuming success just because nothing threw
  // (sbFetch never throws on a non-2xx response; a Postgres error comes back as normal
  // resolved data). Confirmed 2026-08-07: without this signal, a failed calendar check-in
  // still left Home showing "done" because the AsyncStorage write happened unconditionally.
  logCheckin: (assignedActionId: string | null, date?: string) => Promise<boolean>;
  logCheckinUndo: (date: string) => Promise<boolean>;
  // Single shared source for check-in data (2026-08-13 consolidation) — sourced from
  // app_checkins via checkins.listSince(), a 60-day rolling lookback. Home, the Insights
  // Hub habit card, and the Streak Calendar all read this instead of each keeping an
  // independent AsyncStorage-mirrored copy. Keyed by date (YYYY-MM-DD); present + true
  // means completed. logCheckin/logCheckinUndo update this directly on a confirmed
  // server write, so every consumer reflects a change made on any one screen instantly.
  checkinDates: Record<string, boolean>;
  // Consecutive-day streak derived from checkinDates (counts back from today, or
  // yesterday so the streak stays "alive" for one day before resetting). Replaces the
  // three independent computeStreak()-over-AsyncStorage call sites that used to exist.
  streak: number;
  refreshCheckins: () => Promise<void>;
  deleteCraving: (id: string) => Promise<void>;
  refreshCravings: () => Promise<void>;
  symptoms: SymptomEntry[];
  setSymptoms: (list: SymptomEntry[]) => Promise<void>;
  goals: string[];
  setGoals: (list: string[]) => Promise<void>;
  fatDeposition: string;
  setFatDeposition: (id: string) => Promise<void>;
  baseline: BaselineEntry;
  setBaseline: (data: BaselineEntry, identityOverride?: { id: string }) => Promise<void>;
  conditions: string[];
  setConditions: (data: string[], identityOverride?: { id: string }) => Promise<void>;
  miniQuiz: MiniQuizMap;
  setMiniQuizAnswers: (layerId: number, answers: number[]) => Promise<void>;
  lastQuizAnswers: { layer: number; q: number; selected: number[]; score: number }[];
  setLastQuizAnswers: (answers: { layer: number; q: number; selected: number[]; score: number }[]) => void;
  // Optimistic-hide set for the Home bell panel, NOT the source of truth for dismissal
  // (2026-08-13) — notification_log.dismissed_at is, via notificationLog.list()/
  // listLast7Days() filtering server-side. This set only covers the gap between a swipe and
  // the next fetch reflecting that write, so the row disappears instantly instead of waiting
  // on a round-trip. Still lives here rather than HomeScreen's own useState for the same
  // navigation-survival reason as before (HomeScreen fully unmounts/remounts on every
  // navigation away and back — this app's screen router is a plain switch(screen), not a
  // persistent tab navigator, see CLAUDE.md) — a swipe that hasn't finished its PATCH yet
  // shouldn't un-hide if the user bounces to Profile and back to Home before it lands.
  dismissedNotifIds: Set<string>;
  markNotifDismissed: (id: string) => void;
  loading: boolean;
};

const DataContext = createContext<DataContextType>({} as DataContextType);

const KEYS = {
  cravings: 'ms_cravings',
  symptoms: 'ms_symptoms',
  goals: 'ms_goals',
  fatDeposition: 'ms_fat_deposition',
  baseline: 'ms_baseline',
  scoreHistory: 'ms_score_history',
  miniQuiz: 'ms_mini_quiz',
  lastQuizAnswers: 'ms_last_quiz_answers',
  conditions: 'ms_conditions',
  lastUserId: 'ms_last_user_id',
  fullName: 'ms_full_name',
};

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const nowISO = () => new Date().toISOString();

// Same UTC-based 'today' convention checkins.markDone already uses internally
// (src/config/supabase.ts) — matched here, not reinvented, so the lookback boundary and
// logCheckin's own default date always agree on what "today" means.
const todayKey = () => new Date().toISOString().slice(0, 10);
const daysAgoKey = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const CHECKIN_LOOKBACK_DAYS = 60;
const checkinCacheKey = (uid: string) => `ms_checkin_dates_cache_${uid}`;

// Consecutive-day streak, counting back from today (or yesterday, so a streak stays
// "alive" for one day before resetting — standard habit-tracker behavior). Moved here
// from App.tsx (2026-08-13 streak consolidation) to operate on the shared, server-backed
// checkinDates map instead of three independent AsyncStorage reads.
function computeStreak(doneDates: string[]): number {
  if (doneDates.length === 0) return 0;
  const doneSet = new Set(doneDates);
  const todayStr = todayKey();
  const yesterdayStr = daysAgoKey(1);
  let cursor: Date | null = doneSet.has(todayStr) ? new Date() : doneSet.has(yesterdayStr) ? new Date(Date.now() - 86400000) : null;
  if (!cursor) return 0;
  let count = 0;
  while (doneSet.has(cursor.toISOString().slice(0, 10))) {
    count++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return count;
}

// Same isErrorResponse shape logCheckin/logCheckinUndo already check — sbFetch never
// throws on a non-2xx response, it resolves with the PostgREST error body, so a real
// failure has to be distinguished from a genuine empty array this way.
function isCheckinErrorResponse(result: any): boolean {
  return !!(result && (result.code || result.error || (result.message && !Array.isArray(result))));
}

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) as T : fallback;
  } catch { return fallback; }
}
async function writeJSON(key: string, value: any) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// Per-user cache key, matching the convention checkinCacheKey/ClinicalDepthProvider already
// use (2026-08-13 namespacing pass) — 'anonymous' for guest/no-session, so guest-mode local
// data (which was always device-wide anyway, same as before) stays isolated from whichever
// real account signs in on the same device next.
const nsKey = (base: string, uid: string) => `${base}_${uid}`;

// One-time, non-destructive migration for the namespacing pass above: every KEYS.* value
// below used to BE the actual storage key (device-wide, not per-user — the root cause of
// the 2026-08-13 offline identity-wipe investigation). Now it's only referenced as the
// legacy fallback: a namespaced key with nothing in it yet falls back once to the old flat
// key, copies it forward, and leaves the flat key alone (never deleted) — so this stays safe
// to re-run and can't destroy data even if something upstream is wrong.
async function readJSONMigrated<T>(namespacedKey: string, legacyKey: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(namespacedKey);
    if (v != null) return JSON.parse(v) as T;
  } catch { /* fall through to legacy */ }
  try {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw != null) {
      AsyncStorage.setItem(namespacedKey, legacyRaw).catch(() => {});
      return JSON.parse(legacyRaw) as T;
    }
  } catch { /* ignore, fall through to fallback */ }
  return fallback;
}
async function readStringMigrated(namespacedKey: string, legacyKey: string): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(namespacedKey);
    if (v != null) return v;
  } catch { /* ignore */ }
  try {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw != null) {
      AsyncStorage.setItem(namespacedKey, legacyRaw).catch(() => {});
      return legacyRaw;
    }
  } catch { /* ignore */ }
  return '';
}

// Attempts to sync any local-only, not-yet-synced score entries (id prefixed 'local-') before
// a server refetch would otherwise silently discard them (2026-08-14: confirmed this was
// destroying offline-completed scores on reconnect — the refetch overwrote scoreHistory
// wholesale with server-only data, with no merge step). A successful sync reconciles the entry
// to its real server id/created_at, same pattern saveCraving already uses; a failed attempt
// (still offline, or a genuine save error) keeps the entry as-is so it isn't lost either way.
async function syncPendingLocalScores(pending: ScoreHistoryEntry[], postedIds: Set<string>): Promise<ScoreHistoryEntry[]> {
  const results: ScoreHistoryEntry[] = [];
  for (const entry of pending) {
    if (postedIds.has(entry.id)) {
      // Already posted once — by saveScore's own save, or an earlier sync pass for this same
      // id — so the real row already exists (or that original attempt is what should be
      // trusted to complete). Dropping it here rather than re-adding the stale local entry is
      // safe: the server-side list fetch this same refresh performs already includes the real
      // row once committed, and if the original attempt is still genuinely in flight, its own
      // eventual refreshScoreHistory() call brings the real row back on the next pass.
      postedIds.delete(entry.id);
      continue;
    }
    try {
      const { id, date, created_at, ...payload } = entry;
      const result = await scoreApi.save(payload);
      const realRow = Array.isArray(result) && result.length > 0 ? result[0] : null;
      if (realRow) {
        results.push({ ...entry, id: realRow.id, created_at: realRow.created_at || entry.created_at });
      } else {
        console.warn('[syncPendingLocalScores] Supabase save returned no usable row — keeping local-only:', result);
        results.push(entry);
      }
    } catch (e) {
      console.warn('[syncPendingLocalScores] threw — keeping local-only:', e);
      results.push(entry);
    }
  }
  return results;
}

// ── TEMPORARY diagnostic (2026-08-19) — tracing the "offline cold-restart loses prior
// score history, new offline entry survives" bug (CLAUDE.md Known Issues). Appends to its
// own AsyncStorage key rather than console.log, so the sequence survives an app close/kill
// and can be read back on-device (DebugScoreTraceScreen, App.tsx) without a live Metro
// connection — the exact scenario (offline, app closed/reopened) makes a live terminal
// unavailable. Never throws, never blocks/affects real app state — a logging failure here
// must not change save/read behavior. Remove once the mechanism is confirmed and fixed.
export const DEBUG_SCORE_TRACE_KEY = 'ms_debug_score_trace';
const DEBUG_SCORE_TRACE_MAX = 200;
export async function logScoreTrace(event: string, data: Record<string, any> = {}) {
  try {
    const raw = await AsyncStorage.getItem(DEBUG_SCORE_TRACE_KEY);
    const existing: any[] = raw ? JSON.parse(raw) : [];
    existing.push({ t: new Date().toISOString(), event, ...data });
    const trimmed = existing.length > DEBUG_SCORE_TRACE_MAX ? existing.slice(existing.length - DEBUG_SCORE_TRACE_MAX) : existing;
    await AsyncStorage.setItem(DEBUG_SCORE_TRACE_KEY, JSON.stringify(trimmed));
  } catch { /* diagnostic only — never let a logging failure affect real behavior */ }
}
// Small summary (not the full entries, to keep log entries compact/legible) — length plus
// ids is enough to see exactly which entries were present/written/dropped at each step.
const summarizeScores = (arr: ScoreHistoryEntry[]) => ({ length: arr.length, ids: arr.map(e => e.id) });

export function AppDataProvider({ children }: { children: ReactNode }) {
  // authLoading (AuthContext.tsx) reflects whether the async auth.getSession() restore has
  // resolved — user is null until then, whether a real session exists or not. Gating the
  // identity-check effect below on this (not just user?.id) closes the 2026-08-13 race:
  // previously this provider's own mount effect always ran once with user still null before
  // AuthContext's async read resolved, computing 'anonymous' and (pre-namespacing) wiping
  // every local cache built from a stale identity comparison.
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cravings, setCravingsState] = useState<CravingEntry[]>([]);
  const [checkinDates, setCheckinDatesState] = useState<Record<string, boolean>>({});
  const [symptoms, setSymptomsState] = useState<SymptomEntry[]>([]);
  const [goals, setGoalsState] = useState<string[]>([]);
  const [fatDeposition, setFatDepositionState] = useState<string>('');
  const [baseline, setBaselineState] = useState<BaselineEntry>({});
  const [conditions, setConditionsState] = useState<string[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([]);
  const hasScore = scoreHistory.length > 0;
  // Mirrors scoreHistory for refreshScoreHistory below, which needs the current value to check
  // for not-yet-synced local entries without taking scoreHistory as a useCallback dependency —
  // doing that would recreate the callback (and re-fire callers' `useEffect(() =>
  // refreshScoreHistory(), [refreshScoreHistory])`) on every score change, looping.
  const scoreHistoryRef = useRef(scoreHistory);
  useEffect(() => { scoreHistoryRef.current = scoreHistory; }, [scoreHistory]);
  // Guards the exact duplicate-save mechanism confirmed via ms_debug_score_trace on
  // 2026-08-22: saveScore's own success path calls refreshScoreHistory() below, which — via
  // syncPendingLocalScores — re-POSTs any 'local-' prefixed entry still sitting in
  // scoreHistory, including the one saveScore itself just successfully saved (nothing
  // reconciles it out of state until that same refresh's own merge finishes). That produced a
  // guaranteed second insert on every completed quiz, 100% reproducible, with no navigation or
  // double-tap involved. Tracks local entry ids that already had a real scoreApi.save POST
  // dispatched for them, so any syncPendingLocalScores pass — this save's own refresh, a
  // caller screen's mount refresh, or the identity-change effect — skips re-submitting that id
  // instead of blindly retrying it. Shared at the provider level (not per-call) since the
  // whole point is to close this regardless of which code path triggers the second attempt.
  const scoreSavePostedIdsRef = useRef<Set<string>>(new Set());
  const [fullName, setFullNameState] = useState<string>('');
  const [miniQuiz, setMiniQuizState] = useState<MiniQuizMap>({});
  const [lastQuizAnswers, setLastQuizAnswersState] = useState<{ layer: number; q: number; selected: number[]; score: number }[]>([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<Set<string>>(new Set());
  const markNotifDismissed = useCallback((id: string) => {
    // Instant optimistic hide first — the swipe gesture shouldn't wait on a network
    // round-trip. The actual durable write follows in the background; if it fails, the row
    // simply reappears next time notificationLog.list() is fetched (same fail-open behavior
    // as leaving it undismissed, not a silent false success).
    setDismissedNotifIds(prev => new Set(prev).add(id));
    notificationLog.dismiss(id).then(result => {
      const dismissedCount = Array.isArray(result) ? result.length : 0;
      if (dismissedCount === 0) {
        console.warn('[markNotifDismissed] Remote dismiss matched no rows — kept optimistically hidden locally, id:', id, result);
      }
    }).catch(e => {
      console.warn('[markNotifDismissed] Remote dismiss failed — kept optimistically hidden locally, id:', id, e);
    });
  }, []);

  useEffect(() => {
    // Gate on authLoading (see the comment above its destructure): don't even evaluate the
    // identity comparison below until AuthContext's own async session restore has resolved.
    // Previously this effect always ran once with `user` still null on every cold start,
    // computing currentIdentity as 'anonymous' before the real identity was known — combined
    // with the flat (pre-namespacing) keys below, that transient pass used to actively wipe
    // every local cache. Now the keys are namespaced per-identity (see nsKey below) so a
    // stale 'anonymous' pass can no longer collide with a real account's data even in
    // principle — but there's still no reason to run this twice on every cold start, so the
    // gate stays as the primary fix.
    if (authLoading) return;
    (async () => {
      const currentIdentity = user?.id || 'anonymous';
      const lastIdentity = await AsyncStorage.getItem(KEYS.lastUserId);
      if (lastIdentity !== currentIdentity) {
        await AsyncStorage.setItem(KEYS.lastUserId, currentIdentity);
        console.log('[AppDataContext] Identity changed (', lastIdentity, '->', currentIdentity, ')');
        // Every KEYS.* cache below is now namespaced per-identity (nsKey), so a genuinely
        // different account reads/writes its own key and can't collide with the previous
        // one — nothing left to wipe there. dismissedNotifIds is plain in-memory (never
        // AsyncStorage-backed at all) and checkinDates gets overwritten by the read a few
        // lines down regardless — both are still reset explicitly here so a live in-session
        // account switch (sign out, into a different account, no app restart) doesn't flash
        // the previous account's values for a frame before those reads resolve.
        setDismissedNotifIds(new Set());
        setCheckinDatesState({});
      }

      const [c, s, g, fd, bl, sh, mq, lqa, cond, ckd, fn] = await Promise.all([
        readJSONMigrated<CravingEntry[]>(nsKey(KEYS.cravings, currentIdentity), KEYS.cravings, []),
        readJSONMigrated<SymptomEntry[]>(nsKey(KEYS.symptoms, currentIdentity), KEYS.symptoms, []),
        readJSONMigrated<string[]>(nsKey(KEYS.goals, currentIdentity), KEYS.goals, []),
        readStringMigrated(nsKey(KEYS.fatDeposition, currentIdentity), KEYS.fatDeposition),
        readJSONMigrated<BaselineEntry>(nsKey(KEYS.baseline, currentIdentity), KEYS.baseline, {}),
        readJSONMigrated<ScoreHistoryEntry[]>(nsKey(KEYS.scoreHistory, currentIdentity), KEYS.scoreHistory, []),
        readJSONMigrated<MiniQuizMap>(nsKey(KEYS.miniQuiz, currentIdentity), KEYS.miniQuiz, {}),
        readJSONMigrated<{ layer: number; q: number; selected: number[]; score: number }[]>(nsKey(KEYS.lastQuizAnswers, currentIdentity), KEYS.lastQuizAnswers, []),
        readJSONMigrated<string[]>(nsKey(KEYS.conditions, currentIdentity), KEYS.conditions, []),
        readJSON<Record<string, boolean>>(checkinCacheKey(currentIdentity), {}),
        AsyncStorage.getItem(nsKey(KEYS.fullName, currentIdentity)).catch(() => null),
      ]);
      setCravingsState(c); setSymptomsState(s); setGoalsState(g);
      setFatDepositionState(fd); setBaselineState(bl); setScoreHistory(sh);
      setMiniQuizState(mq); setLastQuizAnswersState(lqa);
      setConditionsState(cond); setCheckinDatesState(ckd);
      logScoreTrace('identity-effect:initial-cache-load', { currentIdentity, ...summarizeScores(sh) });
      // Cached per-user (2026-08-14 — previously always reset to '' here and re-fetched live,
      // which meant an offline load showed the 'Friend' placeholder even for a returning user
      // with a real cached name). Reading the namespaced cache directly already isolates this
      // from the previous account's name, so there's no flash-of-wrong-name risk in setting it
      // immediately instead of blanking it — a genuinely new/never-cached identity just reads ''.
      setFullNameState(fn || '');

      if (user?.id) {
        try {
          // remoteCheckins uses .catch(() => null), distinct from the other three's
          // .catch(() => []) — null means "fetch failed, offline" (keep the cached value
          // already set above), [] means "fetch succeeded, genuinely zero rows." Collapsing
          // both to [] would make a dead network look like a real empty checkin history.
          // scoreApi.list now uses the same .catch(() => null) convention (2026-08-19 fix) —
          // it used to catch to [], which made an offline fetch failure indistinguishable
          // from "the server confirmed zero scores." Combined with the merge below only ever
          // pulling non-local entries from this fetch's result, that silently discarded real
          // already-synced history whenever a fresh offline score (a 'local-' entry) was also
          // pending — confirmed via trace, not assumed (see CLAUDE.md Known Issues).
          const [remoteScores, remoteCravings, remoteProfile, remoteCheckins] = await Promise.all([
            scoreApi.list(user.id).catch(() => null),
            cravingApi.list(user.id).catch(() => []),
            profileApi.get(user.id).catch(() => []),
            checkinApi.listSince(daysAgoKey(CHECKIN_LOOKBACK_DAYS)).catch(() => null),
          ]);
          const pendingLocalScores = sh.filter(e => e.id.startsWith('local-'));
          logScoreTrace('identity-effect:pre-merge', {
            remoteScoresIsArray: Array.isArray(remoteScores),
            remoteScoresLength: Array.isArray(remoteScores) ? remoteScores.length : null,
            ...summarizeScores(pendingLocalScores),
          });
          if (Array.isArray(remoteScores)) {
            // A genuine response — even a real empty array is safe to merge/overwrite with.
            if (remoteScores.length > 0 || pendingLocalScores.length > 0) {
              const mapped: ScoreHistoryEntry[] = remoteScores.map((row: any) => ({
                id: row.id,
                date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                created_at: row.created_at,
                total_score: row.total_score,
                layer1: row.layer1, layer2: row.layer2, layer3: row.layer3,
                layer4: row.layer4, layer5: row.layer5,
                dominant_pattern: row.dominant_pattern, rcs: row.rcs,
                answers: row.answers || null,
                cascade_risk: row.cascade_risk ?? null,
                dominant_layer: row.dominant_layer ?? null,
              }));
              // Never let this refetch silently discard a not-yet-synced score — reconcile any
              // 'local-' entries (attempt the sync they missed while offline) before merging, don't
              // just overwrite with server-only data.
              const reconciledLocal = await syncPendingLocalScores(pendingLocalScores, scoreSavePostedIdsRef.current);
              const merged = [...mapped, ...reconciledLocal].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              setScoreHistory(merged);
              await writeJSON(nsKey(KEYS.scoreHistory, user.id), merged);
              logScoreTrace('identity-effect:merged-and-wrote', summarizeScores(merged));
            } else {
              logScoreTrace('identity-effect:skip-genuinely-empty', {});
            }
          } else if (pendingLocalScores.length > 0) {
            // scoreApi.list failed (offline) or resolved with a non-array error body — neither
            // is a genuine empty result. Leave `sh` (already loaded from cache via
            // setScoreHistory above) as-is instead of merging as if the server confirmed zero
            // scores; the pending local entry syncs on the next successful fetch (e.g.
            // refreshScoreHistory, called on Profile/Score History mount).
            console.warn('[AppDataContext] scoreApi.list did not return an array while a local-only score is pending — keeping cached history untouched:', remoteScores);
            logScoreTrace('identity-effect:skip-fetch-failed-kept-cache', summarizeScores(sh));
          } else {
            logScoreTrace('identity-effect:skip-fetch-failed-no-pending', {});
          }
          console.log('[DEBUG symptom] raw remote fetch (profileApi.get) on identity change — full row:', Array.isArray(remoteProfile) ? remoteProfile[0] : remoteProfile, '— .symptoms field specifically:', Array.isArray(remoteProfile) ? remoteProfile[0]?.symptoms : undefined);
          if (Array.isArray(remoteCravings) && remoteCravings.length > 0) {
            const mappedC: CravingEntry[] = remoteCravings.map((row: any) => ({
              id: row.id, craving_type: row.craving_type, timing: row.craving_time,
              context: row.craving_context, mapped_layer: row.mapped_layer, mechanism: row.mechanism,
              tier: row.tier, confidence: row.confidence, created_at: row.created_at,
            }));
            setCravingsState(mappedC);
            await writeJSON(nsKey(KEYS.cravings, user.id), mappedC);
          }
          if (Array.isArray(remoteProfile) && remoteProfile.length > 0) {
            const p = remoteProfile[0];
            if (p.full_name) { setFullNameState(p.full_name); await AsyncStorage.setItem(nsKey(KEYS.fullName, user.id), p.full_name); }
            if (Array.isArray(p.symptoms)) { setSymptomsState(p.symptoms); await writeJSON(nsKey(KEYS.symptoms, user.id), p.symptoms); }
            if (Array.isArray(p.goals)) { setGoalsState(p.goals); await writeJSON(nsKey(KEYS.goals, user.id), p.goals); }
            if (p.fat_deposition) { setFatDepositionState(p.fat_deposition); await AsyncStorage.setItem(nsKey(KEYS.fatDeposition, user.id), p.fat_deposition); }
            if (p.baseline && typeof p.baseline === 'object') { setBaselineState(p.baseline); await writeJSON(nsKey(KEYS.baseline, user.id), p.baseline); }
            if (Array.isArray(p.conditions)) { setConditionsState(p.conditions); await writeJSON(nsKey(KEYS.conditions, user.id), p.conditions); }
          }
          if (Array.isArray(remoteCheckins)) {
            const map: Record<string, boolean> = {};
            remoteCheckins.forEach((r: any) => { if (r.completed) map[r.date] = true; });

            // Reconciliation, before ever retiring the legacy local ms_action_done_dates key
            // (2026-08-13 streak consolidation): compare it against what the server actually
            // has. logCheckin has written through to app_checkins on every mark since
            // 2026-08-06/07, so this should be a no-op — but that's confirmed here, not
            // assumed. Only dates within the same lookback window are checked, since that's
            // all remoteCheckins covers.
            const legacyRaw = await AsyncStorage.getItem('ms_action_done_dates').catch(() => null);
            let legacyDates: string[] = [];
            if (legacyRaw) { try { legacyDates = JSON.parse(legacyRaw); } catch { legacyDates = []; } }
            const lookbackStart = daysAgoKey(CHECKIN_LOOKBACK_DAYS);
            const missingOnServer = legacyDates.filter(d => d >= lookbackStart && !map[d]);

            if (missingOnServer.length > 0) {
              console.log('[checkin reconciliation] local-only dates found, backfilling:', missingOnServer);
              // app_checkins.assigned_action_id is NOT NULL (confirmed 2026-08-07 — Streak
              // Calendar hit this exact constraint), so a real action row is needed. Same
              // dominant-layer fallback chain Home/StreakCalendarScreen already use: prefer
              // the persisted dominant_layer, else the lowest-scoring layer, else default 2.
              const latestForBackfill = (Array.isArray(remoteScores) && remoteScores.length > 0) ? remoteScores[0] : sh[0];
              const backfillLayerId = latestForBackfill?.dominant_layer ?? (latestForBackfill
                ? Number(Object.entries({ 1: latestForBackfill.layer1, 2: latestForBackfill.layer2, 3: latestForBackfill.layer3, 4: latestForBackfill.layer4, 5: latestForBackfill.layer5 }).sort((a, b) => (a[1] as number) - (b[1] as number))[0][0])
                : 2);
              const backfillAction = await actionContent.get(`L${backfillLayerId}`).catch(() => null);
              let allBackfillsSucceeded = true;
              for (const d of missingOnServer) {
                try {
                  const result = await checkinApi.markDone(backfillAction?.id ?? null, d);
                  if (!isCheckinErrorResponse(result) && Array.isArray(result) && result.length > 0) {
                    map[d] = true;
                  } else {
                    allBackfillsSucceeded = false;
                    console.warn('[checkin reconciliation] backfill failed for', d, result);
                  }
                } catch (e) {
                  allBackfillsSucceeded = false;
                  console.warn('[checkin reconciliation] backfill threw for', d, e);
                }
              }
              // Only retire the legacy key once every date it held is confirmed backfilled —
              // if any backfill failed (e.g. connection dropped mid-reconciliation), keep the
              // legacy key so the next load can retry, rather than silently dropping
              // unconfirmed local data.
              if (allBackfillsSucceeded) {
                await AsyncStorage.multiRemove(['ms_action_done_dates', 'ms_action_done_today']).catch(() => {});
              }
            } else if (legacyRaw != null) {
              // Nothing to reconcile — server already has everything the legacy key held (or
              // the key held nothing). Safe to retire immediately.
              await AsyncStorage.multiRemove(['ms_action_done_dates', 'ms_action_done_today']).catch(() => {});
            }

            setCheckinDatesState(map);
            await writeJSON(checkinCacheKey(user.id), map);
          }
        } catch (e) {
          console.log('[DEBUG symptom]', 'identity-change remote fetch Promise.all catch fired:', e);
          console.warn('Background sync failed (non-blocking):', e);
        }
      }
      setLoading(false);
    })();
  }, [user?.id, authLoading]);

  const saveCraving = useCallback(async (entry: Omit<CravingEntry, 'id' | 'created_at'>) => {
    const uid = user?.id || 'anonymous';
    const newEntry: CravingEntry = { ...entry, id: uuid(), created_at: nowISO() };
    const updated = [newEntry, ...cravings];
    setCravingsState(updated);
    await writeJSON(nsKey(KEYS.cravings, uid), updated);
    try {
      if (user?.id) {
        const cravingPayload = {
          craving_type: entry.craving_type, craving_time: entry.timing, craving_context: entry.context || null,
          mapped_layer: entry.mapped_layer, mechanism: entry.mechanism, tier: entry.tier, confidence: entry.confidence || null,
        };
        const result = await cravingApi.save(cravingPayload);
        // Reconcile the client-generated temp id with the real Supabase id, so later
        // updateCraving/deleteCraving calls (which use this id) target a row that actually
        // exists remotely instead of silently matching nothing.
        const realId = Array.isArray(result) && result.length > 0 ? result[0]?.id : null;
        if (realId) {
          const reconciled = updated.map(c => c.id === newEntry.id ? { ...c, id: realId } : c);
          setCravingsState(reconciled);
          await writeJSON(nsKey(KEYS.cravings, uid), reconciled);
        } else {
          console.warn('[saveCraving] Supabase save returned no usable row/id — keeping local temp id:', result);
        }
      }
    } catch (e) {
      console.warn('Craving sync failed (kept locally):', e);
    }
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

  const logReportDownload = useCallback(async (reportType: string = 'pdf_report') => {
    try {
      if (user?.id) {
        await reportDownloadsApi.log(reportType);
      }
    } catch (e) { console.warn('Report download log failed:', e); }
  }, [user?.id]);

  const logCheckin = useCallback(async (assignedActionId: string | null, date?: string): Promise<boolean> => {
    console.log('[DEBUG checkin] logCheckin called — user.id:', user?.id, 'assignedActionId:', assignedActionId, 'date:', date);
    if (!user?.id) { console.log('[DEBUG checkin] logCheckin SKIPPED — no user.id at call time'); return false; }
    const uid = user.id;
    try {
      const result = await checkinApi.markDone(assignedActionId, date);
      console.log('[DEBUG checkin] checkinApi.markDone raw result:', result);
      // sbFetch never throws on a non-2xx response — it returns the PostgREST error body as
      // normal resolved data (only console.warn's internally). This function previously
      // awaited the call and discarded the result without checking it, so a real write
      // failure (RLS rejection, missing grant, constraint violation) was silently dropped
      // here even though sbFetch's own warning still printed. Same result-checking pattern
      // saveScore/saveCraving/deleteCraving already use.
      if (isCheckinErrorResponse(result)) {
        console.warn('[logCheckin] Supabase write failed:', result);
        return false;
      }
      if (!Array.isArray(result) || result.length === 0) {
        console.warn('[logCheckin] Supabase write returned no row (unexpected for return=representation):', result);
        return false;
      }
      // Write-back: update the shared checkinDates immediately so Home, the Insights Hub
      // habit card, and the Streak Calendar all reflect this the instant any one of them
      // calls logCheckin — no AsyncStorage roundtrip, no relying on a screen remount to pick
      // up a change made elsewhere (2026-08-13 streak consolidation).
      const targetDate = date || todayKey();
      setCheckinDatesState(prev => {
        const next = { ...prev, [targetDate]: true };
        writeJSON(checkinCacheKey(uid), next);
        return next;
      });
      return true;
    } catch (e) {
      console.warn('[logCheckin] threw:', e);
      return false;
    }
  }, [user?.id]);

  // Undo — Streak Calendar's "Done, tap to undo" within the 2-day edit window. Same
  // result-checking discipline as logCheckin above, not a swallowed try/catch.
  const logCheckinUndo = useCallback(async (date: string): Promise<boolean> => {
    console.log('[DEBUG checkin] logCheckinUndo called — user.id:', user?.id, 'date:', date);
    if (!user?.id) { console.log('[DEBUG checkin] logCheckinUndo SKIPPED — no user.id at call time'); return false; }
    const uid = user.id;
    try {
      const result = await checkinApi.markUndone(date);
      console.log('[DEBUG checkin] checkinApi.markUndone raw result:', result);
      if (isCheckinErrorResponse(result)) {
        console.warn('[logCheckinUndo] Supabase write failed:', result);
        return false;
      }
      if (!Array.isArray(result) || result.length === 0) {
        console.warn('[logCheckinUndo] Supabase write matched no row:', result);
        return false;
      }
      setCheckinDatesState(prev => {
        const next = { ...prev };
        delete next[date];
        writeJSON(checkinCacheKey(uid), next);
        return next;
      });
      return true;
    } catch (e) {
      console.warn('[logCheckinUndo] threw:', e);
      return false;
    }
  }, [user?.id]);

  const streak = useMemo(
    () => computeStreak(Object.keys(checkinDates).filter(d => checkinDates[d])),
    [checkinDates]
  );

  const refreshCheckins = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await checkinApi.listSince(daysAgoKey(CHECKIN_LOOKBACK_DAYS));
      if (Array.isArray(rows)) {
        const map: Record<string, boolean> = {};
        rows.forEach(r => { if (r.completed) map[r.date] = true; });
        setCheckinDatesState(map);
        await writeJSON(checkinCacheKey(user.id), map);
      }
    } catch (e) { console.warn('refreshCheckins failed (kept local):', e); }
  }, [user?.id]);

  const updateCraving = useCallback(async (id: string, updates: Partial<Omit<CravingEntry, 'id' | 'created_at'>>) => {
    const uid = user?.id || 'anonymous';
    if (user?.id) {
      try {
        // updates uses the app-facing CravingEntry field names (timing/context) — translate
        // to the real app_cravings columns (craving_time/craving_context) before sending.
        const { timing, context, ...restUpdates } = updates;
        const cravingUpdatePayload: any = { ...restUpdates };
        if (timing !== undefined) cravingUpdatePayload.craving_time = timing;
        if (context !== undefined) cravingUpdatePayload.craving_context = context;
        const result = await cravingApi.update(id, cravingUpdatePayload);
        // A PATCH matching zero rows still returns a successful HTTP response — with
        // Prefer: return=representation this comes back as an empty array, indistinguishable
        // from success unless checked explicitly. Same handling as deleteCraving: don't
        // reflect a change locally that didn't actually happen server-side.
        const updatedCount = Array.isArray(result) ? result.length : 0;
        if (updatedCount === 0) {
          console.warn('[updateCraving] Remote update matched no rows — not applying locally, id:', id);
          return;
        }
      } catch (e) {
        console.warn('[updateCraving] Remote update failed — not applying locally, id:', id, e);
        return;
      }
    }
    const updated = cravings.map(c => c.id === id ? { ...c, ...updates } : c);
    setCravingsState(updated);
    await writeJSON(nsKey(KEYS.cravings, uid), updated);
  }, [cravings, user?.id]);

  const deleteCraving = useCallback(async (id: string) => {
    const uid = user?.id || 'anonymous';
    if (user?.id) {
      try {
        const result = await cravingApi.delete(id);
        const deletedCount = Array.isArray(result) ? result.length : 0;
        if (deletedCount === 0) {
          console.warn('[deleteCraving] Remote delete matched no rows — not removing locally, id:', id);
          return;
        }
      } catch (e) {
        console.warn('[deleteCraving] Remote delete failed — not removing locally, id:', id, e);
        return;
      }
    }
    const updated = cravings.filter(c => c.id !== id);
    setCravingsState(updated);
    await writeJSON(nsKey(KEYS.cravings, uid), updated);
  }, [cravings, user?.id]);

  const refreshCravings = useCallback(async () => {
    const uid = user?.id || 'anonymous';
    // Always load from AsyncStorage first (instant, offline-friendly)
    try {
      const local = await readJSONMigrated<CravingEntry[]>(nsKey(KEYS.cravings, uid), KEYS.cravings, []);
      if (local.length > 0) setCravingsState(local);
    } catch (e) { /* ignore */ }

    // Then try Supabase (background sync) — but MERGE, don't overwrite local
    if (!user?.id) return;
    try {
      const remote = await cravingApi.list(user.id);
      if (Array.isArray(remote) && remote.length > 0) {
        const remoteMapped: CravingEntry[] = remote.map((row: any) => ({
          id: row.id, craving_type: row.craving_type, timing: row.craving_time,
          context: row.craving_context, mapped_layer: row.mapped_layer, mechanism: row.mechanism,
          tier: row.tier, confidence: row.confidence, created_at: row.created_at,
        }));
        // Merge: keep local entries that don't have a remote counterpart (by id — created_at
        // compared a client nowISO() against a server-side timestamp, which could differ by
        // precision/round-trip and let the same craving survive as two entries).
        const remoteIds = new Set(remoteMapped.map(r => r.id));
        const localOnly = (await readJSONMigrated<CravingEntry[]>(nsKey(KEYS.cravings, uid), KEYS.cravings, [])).filter(l => !remoteIds.has(l.id));
        const merged = [...remoteMapped, ...localOnly].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setCravingsState(merged);
        await writeJSON(nsKey(KEYS.cravings, uid), merged);
      }
    } catch (e) { console.warn('refreshCravings failed (kept local):', e); }
  }, [user?.id]);

  const setSymptoms = useCallback(async (list: SymptomEntry[]) => {
    const uid = user?.id || 'anonymous';
    setSymptomsState(list);
    await writeJSON(nsKey(KEYS.symptoms, uid), list);
    AsyncStorage.getItem(nsKey(KEYS.symptoms, uid)).then(v => console.log('[DEBUG symptom] local AsyncStorage read-back after setSymptoms write — key present:', v != null, 'entries written:', list.length));
    try {
      if (user?.id) {
        const symptomPayload = { symptoms: list };
        console.log('[DEBUG symptom] payload sent to profileApi.updateFields:', symptomPayload);
        const result = await profileApi.updateFields(user.id, symptomPayload);
        console.log('[DEBUG symptom] raw response from profileApi.updateFields:', result);
      }
    } catch (e) {
      console.log('[DEBUG symptom] error branch fired in setSymptoms:', e);
      console.warn('Symptoms sync failed:', e);
    }
  }, [user?.id]);

  const setGoals = useCallback(async (list: string[]) => {
    const uid = user?.id || 'anonymous';
    setGoalsState(list);
    await writeJSON(nsKey(KEYS.goals, uid), list);
    try { if (user?.id) await profileApi.updateFields(user.id, { goals: list }); } catch (e) { console.warn('Goals sync failed:', e); }
  }, [user?.id]);

  const setFatDeposition = useCallback(async (id: string) => {
    const uid = user?.id || 'anonymous';
    setFatDepositionState(id);
    await AsyncStorage.setItem(nsKey(KEYS.fatDeposition, uid), id);
    try { if (user?.id) await profileApi.updateFields(user.id, { fat_deposition: id }); } catch (e) { console.warn('FatDeposition sync failed:', e); }
  }, [user?.id]);

  const setBaseline = useCallback(async (data: BaselineEntry, identityOverride?: { id: string }) => {
    const uid = identityOverride?.id || user?.id || 'anonymous';
    setBaselineState(data);
    await writeJSON(nsKey(KEYS.baseline, uid), data);
    try { if (uid !== 'anonymous') await profileApi.updateFields(uid, { baseline: data }); } catch (e) { console.warn('Baseline sync failed:', e); }
  }, [user?.id]);

  const setConditions = useCallback(async (data: string[], identityOverride?: { id: string }) => {
    const uid = identityOverride?.id || user?.id || 'anonymous';
    setConditionsState(data);
    await writeJSON(nsKey(KEYS.conditions, uid), data);
    try { if (uid !== 'anonymous') await profileApi.updateFields(uid, { conditions: data }); } catch (e) { console.warn('Conditions sync failed:', e); }
  }, [user?.id]);

  const saveProfile = useCallback(async (data: any, identityOverride?: { id: string; email?: string | null }) => {
    // identityOverride exists because this context's own `user` (from its own useAuth() call)
    // can still be null for a render or two right after a fresh signUp() resolves elsewhere —
    // AppDataContext is a separate component tree and hasn't necessarily re-rendered with the
    // new session yet by the time a caller (OnboardingScreen) invokes this. Falling back to
    // `user` unchanged for every other (non-signup) call site.
    const identity = identityOverride ?? (user ? { id: user.id, email: user.email } : null);
    if (!identity) { console.warn('[saveProfile] BAILED — no user available (context or override) at call time. data was:', data); return; }
    console.log('[saveProfile] upserting for user.id:', identity.id, 'email:', identity.email, 'data:', data);
    try {
      const result = await profileApi.upsert({ id: identity.id, email: identity.email, ...data });
      console.log('[saveProfile] upsert result:', result);
      // Identity doesn't change on a fresh onboarding save, so the identity-change effect
      // above won't refire to pick this up — set it immediately so Home/Profile reflect
      // a just-onboarded name without needing a re-sign-in. Also cached, so a later offline
      // load doesn't fall back to the 'Friend' placeholder for a name that was already set.
      if (data.full_name) { setFullNameState(data.full_name); await AsyncStorage.setItem(nsKey(KEYS.fullName, identity.id), data.full_name); }
    } catch (e) { console.warn('[saveProfile] upsert THREW:', e); }
  }, [user]);

  const refreshScoreHistory = useCallback(async () => {
    if (!user?.id) return;
    logScoreTrace('refreshScoreHistory:entry', summarizeScores(scoreHistoryRef.current));
    try {
      // .catch(() => null), same convention as the identity-effect's score fetch (2026-08-19)
      // — a rejected fetch must stay distinguishable from a genuine empty array so it's never
      // mistaken for "the server confirmed zero scores." This function already failed closed
      // correctly before this change (a thrown rejection skipped the merge entirely via the
      // outer catch), so behavior is unchanged here — this just makes the distinction explicit
      // and logged, instead of relying on the throw/catch shape to keep it safe.
      const remote = await scoreApi.list(user.id).catch(() => null);
      if (Array.isArray(remote)) {
        const mapped: ScoreHistoryEntry[] = remote.map((row: any) => ({
          id: row.id,
          date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          created_at: row.created_at,
          total_score: row.total_score,
          layer1: row.layer1, layer2: row.layer2, layer3: row.layer3,
          layer4: row.layer4, layer5: row.layer5,
          dominant_pattern: row.dominant_pattern, rcs: row.rcs,
          answers: row.answers || null,
          cascade_risk: row.cascade_risk ?? null,
          dominant_layer: row.dominant_layer ?? null,
        }));
        // Same protection as the identity-change effect's remote fetch (2026-08-14): don't let
        // this overwrite silently discard a not-yet-synced 'local-' entry — reconcile/retry it
        // and merge, instead of replacing scoreHistory with server-only data.
        const pendingLocalScores = scoreHistoryRef.current.filter(e => e.id.startsWith('local-'));
        const reconciledLocal = await syncPendingLocalScores(pendingLocalScores, scoreSavePostedIdsRef.current);
        const merged = [...mapped, ...reconciledLocal].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setScoreHistory(merged);
        await writeJSON(nsKey(KEYS.scoreHistory, user.id), merged);
        logScoreTrace('refreshScoreHistory:merged-and-wrote', summarizeScores(merged));
      } else if (remote !== null) {
        console.warn('[refreshScoreHistory] scoreApi.list resolved with a non-array, non-null response — leaving cached history untouched:', remote);
        logScoreTrace('refreshScoreHistory:skip-non-array-response', {});
      } else {
        logScoreTrace('refreshScoreHistory:skip-fetch-failed', summarizeScores(scoreHistoryRef.current));
      }
    } catch (e) { console.warn('refreshScoreHistory failed:', e); logScoreTrace('refreshScoreHistory:threw', { error: String(e) }); }
  }, [user?.id]);

  const saveScore = useCallback(async (data: any) => {
    let currentUser = user;
    if (!currentUser) {
      try { currentUser = await (await import('../config/supabase')).auth.getSession(); } catch { /* ignore */ }
    }
    const uid = currentUser?.id || 'anonymous';
    // LOCAL BACKUP: Always save to AsyncStorage first. Captures every field the online-save
    // payload carries (2026-08-14) — previously answers/time_spent_seconds/engagement_grade/
    // dominant_pattern_confidence were dropped here, so a score created offline and later
    // retried via syncPendingLocalScores synced an incomplete record even on success.
    const localEntry: ScoreHistoryEntry = {
      id: 'local-' + Date.now(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      created_at: new Date().toISOString(),
      total_score: data.total_score,
      layer1: data.layer1, layer2: data.layer2, layer3: data.layer3,
      layer4: data.layer4, layer5: data.layer5,
      dominant_pattern: data.dominant_pattern, rcs: data.rcs,
      cascade_risk: data.cascade_risk ?? null,
      dominant_layer: data.dominant_layer ?? null,
      answers: data.answers ?? null,
      time_spent_seconds: data.time_spent_seconds ?? null,
      engagement_grade: data.engagement_grade ?? null,
      dominant_pattern_confidence: data.dominant_pattern_confidence ?? null,
    };
    const updatedHistory = [localEntry, ...scoreHistory];
    logScoreTrace('saveScore:pre-write', { uid, scoreHistoryLengthBefore: scoreHistory.length, ...summarizeScores(updatedHistory) });
    setScoreHistory(updatedHistory);
    await writeJSON(nsKey(KEYS.scoreHistory, uid), updatedHistory);
    logScoreTrace('saveScore:post-write-confirmed', summarizeScores(updatedHistory));
    if (!currentUser) {
      console.warn('[saveScore] No user session — score not saved to Supabase (kept locally only)');
      return;
    }
    try {
      // Marked BEFORE the POST fires, not after it resolves — refreshScoreHistory() below is
      // called synchronously once this succeeds, and syncPendingLocalScores must already see
      // this id as posted by the time it runs, not race it. See scoreSavePostedIdsRef's
      // declaration for the duplicate-save mechanism this closes.
      scoreSavePostedIdsRef.current.add(localEntry.id);
      const result = await scoreApi.save(data);
      if (result && (result.code || result.error) && !Array.isArray(result)) {
        console.warn('[saveScore] Supabase save returned error:', result);
        // Didn't actually succeed — un-guard so a later sync pass (e.g. on reconnect) can
        // still legitimately retry this entry instead of it being skipped forever.
        scoreSavePostedIdsRef.current.delete(localEntry.id);
      } else {
        console.log('[saveScore] Supabase save succeeded — refreshing history');
        refreshScoreHistory();
      }
    } catch (e) {
      console.warn('[saveScore] save failed:', e);
      scoreSavePostedIdsRef.current.delete(localEntry.id);
    }
  }, [user, scoreHistory, refreshScoreHistory]);

  const setMiniQuizAnswers = useCallback(async (layerId: number, answers: number[]) => {
    const uid = user?.id || 'anonymous';
    const updated = { ...miniQuiz, [layerId]: answers };
    setMiniQuizState(updated);
    await writeJSON(nsKey(KEYS.miniQuiz, uid), updated);
    try { if (user?.id) await profileApi.updateFields(user.id, { mini_quiz: updated }); } catch (e) { console.warn('Mini-quiz sync failed:', e); }
  }, [miniQuiz, user?.id]);

  const setLastQuizAnswers = useCallback((answers: { layer: number; q: number; selected: number[]; score: number }[]) => {
    const uid = user?.id || 'anonymous';
    setLastQuizAnswersState(answers);
    writeJSON(nsKey(KEYS.lastQuizAnswers, uid), answers);
  }, [user?.id]);

  return (
    <DataContext.Provider value={{
      hasScore, fullName, scoreHistory, refreshScoreHistory, saveProfile, saveScore,
      cravings, saveCraving, updateCraving, saveNpsRating, logReportDownload, logCheckin, logCheckinUndo, checkinDates, streak, refreshCheckins, deleteCraving, refreshCravings, symptoms, setSymptoms, goals, setGoals,
      fatDeposition, setFatDeposition, baseline, setBaseline, conditions, setConditions,
      miniQuiz, setMiniQuizAnswers, lastQuizAnswers, setLastQuizAnswers, dismissedNotifIds, markNotifDismissed, loading,
    }}>
      {children}
    </DataContext.Provider>
  );
}
export function useAppData() { return useContext(DataContext); }
