// ============================================================
// METABOLIC SCORE™ — CLINICAL ENGINE
// Ported from amitbaruna.com/metabolic-score.html
// This is the real diagnostic intelligence — NOT random/mock.
// ============================================================

// === ANSWER SCORING ===
export const ANS_SCORES = [10, 7, 4, 2, 0]

export const ANSWER_BADGES = [
  { class: 'badge-green', label: 'Noted' },
  { class: 'badge-green', label: 'Mild signal' },
  { class: 'badge-amber', label: 'Worth noting' },
  { class: 'badge-red', label: 'High signal' },
  { class: 'badge-severe', label: 'Key signal' },
]

// === LAYER MAPPING ===
export const LMAP: Record<number, number> = {
  0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5,
}

// === SCORE BANDS ===
export function getBand(score: number) {
  if (score >= 75) return { color: '#22C55E', label: 'Metabolic Load: Balanced', status: 'Well Regulated' }
  if (score >= 50) return { color: '#F59E0B', label: 'Metabolic Load: Moderate', status: 'Early Dysfunction' }
  if (score >= 25) return { color: '#EF4444', label: 'Metabolic Load: Elevated', status: 'Metabolic Friction Present' }
  return { color: '#991B1B', label: 'Metabolic Load: Highly Elevated', status: 'Significant Metabolic Impairment' }
}

// === V3 CONVERSION ===
export function convertScore(raw: number): number {
  if (raw >= 10) return 4
  if (raw >= 7) return 3
  if (raw >= 4) return 2
  if (raw >= 2) return 1
  return 0
}

export function stressSliderConvert(v: number): number {
  if (v <= 2) return 4
  if (v <= 4) return 3
  if (v <= 6) return 2
  if (v <= 8) return 1
  return 0
}

// === TYPES ===
export type HistoryEntry = {
  layer: number
  score: number
  ansIdx: number
  q: number
  selected: number[]
}

export type HiddenLayer = {
  sli: number; sliClass: string
  bri: number; briClass: string
  gsi: number; gsiClass: string
  syli: number; syliClass: string
  sleepAlign: number; stressAlign: number; gutAlign: number; overallAlign: number
}

// === HIDDEN LAYER INDICES ===
export function computeHiddenLayer(
  history: HistoryEntry[], sc: Record<number, number>,
  sleepScore: number, stressScore: number, gutScore: number
): HiddenLayer {
  const c = (n: number) => convertScore(history[n] ? history[n].score : 0)

  const sli = c(2) + c(3) + stressSliderConvert(stressScore)
  let sliClass = 'Severe Load'
  if (sli >= 10) sliClass = 'Low Load'
  else if (sli >= 7) sliClass = 'Moderate Load'
  else if (sli >= 4) sliClass = 'High Load'

  const bri = c(8) + c(9) + c(2)
  let briClass = 'Severely Compromised'
  if (bri >= 10) briClass = 'Strong'
  else if (bri >= 7) briClass = 'Moderate'
  else if (bri >= 4) briClass = 'Fragile'

  const gsi = c(1) + c(4) + c(5)
  let gsiClass = 'Severe Instability'
  if (gsi >= 10) gsiClass = 'Stable'
  else if (gsi >= 7) gsiClass = 'Mild Instability'
  else if (gsi >= 4) gsiClass = 'Moderate Instability'

  const pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]]
  const syli = pairs.filter(([a, b]) =>
    (history[a] ? history[a].score : 0) + (history[b] ? history[b].score : 0) < 10
  ).length
  let syliClass = 'Localized'
  if (syli >= 5) syliClass = 'System-Wide Load'
  else if (syli >= 4) syliClass = 'High Complexity'
  else if (syli >= 2) syliClass = 'Multi-System'

  const sleepAlign = sleepScore - (sc[1] / 2)
  const stressAlign = stressScore - (10 - (sc[2] / 2))
  const gutAlign = gutScore - (sc[4] / 2)
  const overallAlign = (Math.abs(sleepAlign) + Math.abs(stressAlign) + Math.abs(gutAlign)) / 3

  return { sli, sliClass, bri, briClass, gsi, gsiClass, syli, syliClass, sleepAlign, stressAlign, gutAlign, overallAlign }
}

// === RCS ===
export function calcRCS(history: HistoryEntry[]): number {
  const rp = (score: number) => {
    if (score >= 10) return 4
    if (score >= 7) return 3
    if (score >= 4) return 2
    if (score >= 2) return 1
    return 0
  }
  return (
    rp(history[0]?.score || 0) + rp(history[1]?.score || 0) + rp(history[2]?.score || 0) +
    rp(history[5]?.score || 0) + rp(history[7]?.score || 0)
  )
}

export function getRCSInfo(rcs: number) {
  const readyPct = Math.round((rcs / 20) * 100)
  const compPct = 100 - readyPct
  if (rcs >= 16) return { compPct, readyPct, label: 'Strong Readiness', color: '#22C55E', desc: 'Your body retains strong biological readiness to respond to change. The right intervention is likely to work faster than you expect.' }
  if (rcs >= 14) return { compPct, readyPct, label: 'Good Readiness', color: '#22C55E', desc: 'Your body has good readiness to change. Some strain is present but recovery systems remain largely intact.' }
  if (rcs >= 11) return { compPct, readyPct, label: 'Moderate', color: '#F59E0B', desc: 'Your body retains some adaptive capacity. Results are possible but may be slower than expected until recovery systems are supported.' }
  if (rcs >= 6) return { compPct, readyPct, label: 'Compromised', color: '#EF4444', desc: 'Your body may be spending more energy on protection than on adaptation. This directly affects fat loss, energy, consistency and recovery.' }
  return { compPct, readyPct, label: 'Severely Compromised', color: '#991B1B', desc: 'Your body appears to be allocating most of its resources toward survival and protection rather than adaptation.' }
}

// === PATTERN ENGINE ===
export const PATTERN_THRESHOLDS = {
  p1: { syli: 4, rcs: 6 }, p2: { rcs: 7, syli_guard: 4 }, p3: { sli: 3, bri: 6 },
  p4: { gsi: 3, rcs_min: 6 }, p5: { l3: 10, gsi: 6, rcs_lo: 6, rcs_hi: 14 },
  p6: { l1: 10, sleep: 5, rcs: 10 }, p7: { l4: 10, gut: 5 }, p8: { rcs_min: 10, bri: 6 },
  secondary_min_confidence: 50,
}

export type PatternResult = {
  dominant_pattern: string
  dominant_pattern_confidence: number
  dominant_reason: string
  secondary_pattern: string | null
  secondary_pattern_confidence: number | null
}

function sigLow(val: number, thresh: number): number { return val > thresh ? 0 : 1 - (val / (thresh + 1)) }
function sigHigh(val: number, thresh: number, rangeMax: number): number { return val < thresh ? 0 : Math.min(1, (val - thresh + 1) / (rangeMax - thresh + 1)) }
function sigMatch(val: number, targets: number[]): number { return targets.includes(val) ? 1 : 0 }
function sigBand(val: number, lo: number, hi: number): number { return (val >= lo && val <= hi) ? 1 : 0 }
function weightedConf(signals: [number, number][]): number {
  const totalW = signals.reduce((s, [, w]) => s + w, 0)
  return Math.round(signals.reduce((s, [str, w]) => s + str * w, 0) / totalW * 100)
}

export function computePatternEngine(rcs: number, hl: HiddenLayer, lt: Record<number, number>, totalScore: number): PatternResult {
  const T = PATTERN_THRESHOLDS
  const pb = Object.entries(lt).reduce((a, b) => b[1] < a[1] ? b : a)[0] as unknown as number
  const candidates: any[] = []

  if (hl.syli >= T.p1.syli && rcs <= T.p1.rcs) {
    candidates.push({ name: 'System-Wide Adaptation Deficit', conf: weightedConf([[sigHigh(hl.syli, T.p1.syli, 5), 40], [sigLow(rcs, T.p1.rcs), 40], [sigLow(totalScore / 100, 0.30), 20]]), priority: 1, reason: `SYLI ${hl.syli}/5, RCS ${rcs}/20` })
  }
  if (rcs <= T.p2.rcs && hl.syli < T.p2.syli_guard && (pb === 1 || pb === 2)) {
    candidates.push({ name: 'Recovery Deficit', conf: weightedConf([[sigLow(rcs, T.p2.rcs), 45], [sigLow(lt[pb], 10), 35], [sigLow(hl.sli, 6), 20]]), priority: 2, reason: `RCS ${rcs}/20, PB=L${pb}` })
  }
  if (hl.sli <= T.p3.sli && hl.bri <= T.p3.bri) {
    candidates.push({ name: 'Nervous System Overload', conf: weightedConf([[sigLow(hl.sli, T.p3.sli), 35], [sigLow(hl.bri, T.p3.bri), 35], [sigLow(rcs, 10), 20], [sigMatch(pb, [2]), 10]]), priority: 3, reason: `SLI ${hl.sli}/12, BRI ${hl.bri}/12` })
  }
  if (hl.gsi <= T.p4.gsi && rcs > T.p4.rcs_min) {
    candidates.push({ name: 'Fuel Regulation Bottleneck', conf: weightedConf([[sigLow(hl.gsi, T.p4.gsi), 40], [sigHigh(rcs, T.p4.rcs_min, 20), 35], [sigLow(lt[3], 10), 25]]), priority: 4, reason: `GSI ${hl.gsi}/12, RCS ${rcs}/20` })
  }
  if (lt[3] < T.p5.l3 && hl.gsi <= T.p5.gsi && rcs >= T.p5.rcs_lo && rcs <= T.p5.rcs_hi) {
    candidates.push({ name: 'Metabolic Resistance Pattern', conf: weightedConf([[sigLow(lt[3], T.p5.l3), 40], [sigLow(hl.gsi, T.p5.gsi), 35], [sigBand(rcs, T.p5.rcs_lo, T.p5.rcs_hi), 25]]), priority: 5, reason: `L3 ${lt[3]}/20, GSI ${hl.gsi}/12` })
  }
  if (lt[1] < T.p6.l1 && hl.sleepAlign <= T.p6.sleep && rcs <= T.p6.rcs) {
    candidates.push({ name: 'Circadian Disruption Pattern', conf: weightedConf([[sigLow(lt[1], T.p6.l1), 40], [sigLow(hl.sleepAlign, T.p6.sleep), 35], [sigLow(rcs, T.p6.rcs), 25]]), priority: 6, reason: `L1 ${lt[1]}/20, sleep ${hl.sleepAlign}/10` })
  }
  if (lt[4] < T.p7.l4 && hl.gutAlign <= T.p7.gut) {
    candidates.push({ name: 'Gut-Brain Load', conf: weightedConf([[sigLow(lt[4], T.p7.l4), 50], [sigLow(hl.gutAlign, T.p7.gut), 30], [sigLow(rcs, 12), 20]]), priority: 7, reason: `L4 ${lt[4]}/20, gut ${hl.gutAlign}/10` })
  }
  if (rcs >= T.p8.rcs_min && hl.bri <= T.p8.bri) {
    candidates.push({ name: 'Behavioral Recovery Gap', conf: weightedConf([[sigHigh(rcs, T.p8.rcs_min, 20), 40], [sigLow(hl.bri, T.p8.bri), 40], [sigMatch(pb, [5]), 20]]), priority: 8, reason: `RCS ${rcs}/20, BRI ${hl.bri}/12` })
  }

  candidates.sort((a, b) => a.priority - b.priority)
  const dominant = candidates[0] || { name: 'Single System Bottleneck', conf: 50, priority: 9, reason: `L${pb} primary blocker` }
  const secondaryRaw = candidates[1] || null
  const secondary = secondaryRaw && secondaryRaw.conf >= T.secondary_min_confidence ? secondaryRaw : null

  return {
    dominant_pattern: dominant.name,
    dominant_pattern_confidence: dominant.conf,
    dominant_reason: dominant.reason,
    secondary_pattern: secondary ? secondary.name : null,
    secondary_pattern_confidence: secondaryRaw ? secondaryRaw.conf : null,
  }
}

// === DOMINANT LAYER ===
export function pickDominantLayer(
  sc: Record<number, number>,
  hl: HiddenLayer | null,
  cascadeStr: string,
  conditions: string[] = [],
  realSignalHistory: { layer: number; ansIdx: number }[] = []
): { layer: number; tiedFallback: boolean } {
  const scores = [1, 2, 3, 4, 5].map(i => ({ idx: i, score: sc[i] }))
  const minScore = Math.min(...scores.map(s => s.score))
  const tied = scores.filter(s => s.score === minScore)
  if (tied.length === 1) return { layer: tied[0].idx, tiedFallback: false }

  const tieScore = (idx: number) => {
    let score = 0
    if (idx === 2 && hl?.sliClass) {
      if (hl.sliClass === 'Severe Load') score += 3
      else if (hl.sliClass === 'High Load') score += 2
    }
    if (idx === 3 && hl?.gsiClass) {
      if (hl.gsiClass === 'Severe Instability') score += 3
      else if (hl.gsiClass === 'Moderate Instability') score += 2
    }
    const cascadeMatches = (cascadeStr.match(new RegExp('L' + idx, 'g')) || []).length
    score += cascadeMatches
    // Condition corroboration — capped at +1, only ever a tie-breaker between
    // already-tied worst layers, never enough on its own to create a new
    // dominant candidate. Same discipline as the central-obesity/BMI modifier.
    const conditionMatch = conditions.some(c => CONDITION_LAYER_BOOST.some(b => c.toLowerCase().includes(b.match.toLowerCase()) && b.layers.includes(idx)))
    if (conditionMatch) score += 1
    return score
  }
  const ranked = tied.map(t => ({ idx: t.idx, tieScore: tieScore(t.idx) })).sort((a, b) => b.tieScore - a.tieScore)
  const stillTied = ranked.filter(r => r.tieScore === ranked[0].tieScore)
  if (stillTied.length === 1) return { layer: ranked[0].idx, tiedFallback: false }

  // Tier 2: real-signal answer count (base 10 + adaptive follow-ups combined, if available).
  // A layer with more option-3+ ("real signal") answers is the more defensible pick than one
  // resolved by a single slider question — this replaces the old undisclosed stress-slider-only
  // tiebreak with something traceable back to actual quiz answers.
  if (realSignalHistory.length > 0) {
    const realSignalCount = (idx: number) => realSignalHistory.filter(h => h.layer === idx && h.ansIdx >= 2).length
    const byRealSignal = stillTied.map(t => ({ idx: t.idx, count: realSignalCount(t.idx) })).sort((a, b) => b.count - a.count)
    const stillTiedAfterSignal = byRealSignal.filter(r => r.count === byRealSignal[0].count)
    if (stillTiedAfterSignal.length === 1) return { layer: byRealSignal[0].idx, tiedFallback: false }
  }

  // Tier 3: true tie survives every real-signal-based tiebreak — genuinely rare. Falls back to
  // the lower layer number, flagged so this can be tracked and reviewed rather than silently
  // hidden. Not a UX-facing dual-dominant-layer display (that's a v1.1 decision) — just an
  // honest, traceable resolution for an edge case instead of an arbitrary one.
  const fallback = stillTied.sort((a, b) => a.idx - b.idx)[0]
  return { layer: fallback.idx, tiedFallback: true }
}

// === CASCADE RISK ===
// Threshold is <=11 (not <10) as of this update — an 11/20 score is genuinely borderline, not
// "fine." The old <10 cutoff treated 11 and 20 identically (both "not active") while treating
// 9 and 11 as completely different categories, despite being two points apart. <=11 catches
// real, moderate signals that were previously invisible to cascade detection.
export function buildCascadeRisk(sc: Record<number, number>): string {
  const risks: string[] = []
  const [l1, l2, l3, l4, l5] = [sc[1], sc[2], sc[3], sc[4], sc[5]]
  if (l1 <= 11) risks.push('L1 Circadian failure → L2 Neurochemical at high risk (cortisol elevation suppresses serotonin).')
  if (l2 < 8) risks.push('L2 Neurochemical compromised → L4 Gut-Brain at high risk. L5 Identity at medium risk.')
  if (l3 < 8 && l4 <= 11) risks.push('L3 + L4 feedback loop — insulin resistance driving gut inflammation.')
  if (l4 < 8) risks.push('L4 Gut-Brain severely compromised — 90% of serotonin produced in gut.')
  if (l1 <= 11 && l4 <= 11) risks.push('L1 Circadian disruption → L4 Gut-Brain at high risk.')
  if (l1 <= 11 && l5 <= 11) risks.push('L1 Circadian disruption → L5 Identity at high risk.')
  if (l2 <= 11 && l3 <= 11) risks.push('L2 Neurochemical overload → L3 Metabolic at high risk.')
  if (l3 <= 11 && l5 <= 11) risks.push('L3 Metabolic instability → L5 Identity at medium risk.')
  if (l4 <= 11 && l5 <= 11) risks.push('L4 Gut-Brain compromised → L5 Identity at medium risk.')
  if (risks.length === 0) risks.push('No immediate cascade risk detected — single system bottleneck.')
  return risks.join(' | ')
}

// === ADAPTIVE CONFIDENCE ===
function calcIC(scores: number[]): number { const gap = Math.abs(scores[0] - (scores[1] != null ? scores[1] : scores[0])); return Math.max(0.35, 1 - gap / 14) }
function calcSB(selCounts: number[]): number { const a = selCounts.reduce((x, y) => x + y, 0) / Math.max(1, selCounts.length); if (a <= 1.2) return 1.0; if (a <= 2) return 0.85; if (a <= 3) return 0.68; return 0.55 }
function calcPBC(layerScores: number[]): number { const s = [...layerScores].sort((a, b) => a - b); const gap = s[1] - s[0]; if (gap >= 8) return 1.0; if (gap >= 5) return 0.82; if (gap >= 3) return 0.65; if (gap >= 1) return 0.48; return 0.32 }
function calcBPAgg(total100: number): number { const b = [24.5, 49.5, 74.5]; const d = Math.min(...b.map(x => Math.abs(total100 - x))); return Math.min(1, 0.5 + d / 25) }
function calcCAf(nCascades: number): number { if (nCascades <= 1) return 1.0; if (nCascades === 2) return 0.85; if (nCascades === 3) return 0.72; if (nCascades <= 5) return 0.6; return 0.5 }

export function countActiveCascades(sc: Record<number, number>): number {
  const [l1, l2, l3, l4, l5] = [sc[1], sc[2], sc[3], sc[4], sc[5]]
  let n = 0
  if (l1 <= 11) n++; if (l2 < 8) n++; if (l3 < 8 && l4 <= 11) n++; if (l4 < 8) n++
  if (l1 <= 11 && l4 <= 11) n++; if (l1 <= 11 && l5 <= 11) n++; if (l2 <= 11 && l3 <= 11) n++
  if (l3 <= 11 && l5 <= 11) n++; if (l4 <= 11 && l5 <= 11) n++
  return n
}

export type ConfidenceResult = { pct: number; worstLayer: number; secondLayer: number }

export function computeAdaptiveConfidence(historyArr: HistoryEntry[], scObj: Record<number, number>, totalScoreVal: number): ConfidenceResult {
  const layerScores = [1, 2, 3, 4, 5].map(i => scObj[i])
  const q = [1, 2, 3, 4, 5].map(layerNum => {
    const qs = historyArr.filter(h => h.layer === layerNum).map(h => h.score)
    const selCounts = historyArr.filter(h => h.layer === layerNum).map(h => h.selected ? h.selected.length : 1)
    return 0.58 * calcIC(qs.length ? qs : [10]) + 0.42 * calcSB(selCounts.length ? selCounts : [1])
  })
  const sortedIdx = layerScores.map((s, i) => ({ s, i })).sort((a, b) => a.s - b.s)
  const worst = sortedIdx[0].i, second = sortedIdx[1].i
  const w = layerScores.map((_, i) => i === worst ? 2.0 : i === second ? 1.5 : 1.0)
  const base = q.reduce((s, v, i) => s + v * w[i], 0) / w.reduce((a, b) => a + b, 0)
  const pbc = calcPBC(layerScores)
  const gate = 0.65 + 0.35 * pbc
  const bpAgg = calcBPAgg(totalScoreVal)
  const ca = calcCAf(countActiveCascades(scObj))
  const soft = (bpAgg - 0.75) * 0.08 + (ca - 0.75) * 0.08
  let c = base * gate + soft
  c = Math.max(0.30, Math.min(0.97, c))
  return { pct: Math.round(c * 100), worstLayer: worst + 1, secondLayer: second + 1 }
}

export function calcAdaptiveQCount(conf: ConfidenceResult, scObj: Record<number, number>): number {
  if (conf.pct >= 85) return 0
  const activeCount = [1, 2, 3, 4, 5].filter(i => scObj[i] <= 11).length
  if (activeCount >= 2) return 4
  return 2
}

// === CONDITION LAYER BOOST ===
export const CONDITION_LAYER_BOOST = [
  { match: 'Type 2 Diabetes', layers: [3, 4] }, { match: 'Pre-diabetes', layers: [3, 4] },
  { match: 'PCOS', layers: [2, 3, 4] }, { match: 'Thyroid', layers: [1, 3] },
  { match: 'Hypertension', layers: [2] }, { match: 'GLP-1', layers: [3, 4] },
  { match: 'Anxiety', layers: [2, 5] }, { match: 'Depression', layers: [2, 5] },
  { match: 'Sleep Disorder', layers: [1] }, { match: 'Insomnia', layers: [1] },
]

// === FULL SCORE CALCULATION ===
export type ScoreResult = {
  totalScore: number
  sc: Record<number, number>
  history: HistoryEntry[]
  rcs: number
  rcsInfo: ReturnType<typeof getRCSInfo>
  hl: HiddenLayer
  patternEngine: PatternResult
  dominantLayer: number
  dominantLayerTiedFallback: boolean
  confidence: ConfidenceResult
  adaptiveQCount: number
  cascadeRisk: string
  band: ReturnType<typeof getBand>
}

export function calculateScore(
  history: HistoryEntry[], sleepScore: number, stressScore: number, gutScore: number, conditions: string[] = [],
  realSignalHistory: { layer: number; ansIdx: number }[] = []
): ScoreResult {
  const sc: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let totalScore = 0
  history.forEach(h => { sc[h.layer] += h.score; totalScore += h.score })

  const hl = computeHiddenLayer(history, sc, sleepScore, stressScore, gutScore)
  const rcs = calcRCS(history)
  const rcsInfo = getRCSInfo(rcs)
  const cascadeRisk = buildCascadeRisk(sc)
  const patternEngine = computePatternEngine(rcs, hl, sc, totalScore)
  const dominantPick = pickDominantLayer(sc, hl, cascadeRisk, conditions, realSignalHistory.length ? realSignalHistory : history.map(h => ({ layer: h.layer, ansIdx: h.ansIdx })))
  const dominantLayer = dominantPick.layer
  const dominantLayerTiedFallback = dominantPick.tiedFallback
  const confidence = computeAdaptiveConfidence(history, sc, totalScore)
  const adaptiveQCount = calcAdaptiveQCount(confidence, sc)
  const band = getBand(totalScore)

  return { totalScore, sc, history, rcs, rcsInfo, hl, patternEngine, dominantLayer, dominantLayerTiedFallback, confidence, adaptiveQCount, cascadeRisk, band }
}

// === CLAUDE WORKER ===
export const WORKER_URL = 'https://metabolic-narrative.amit-baruna.workers.dev'

export async function fetchNarrative(payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.error) return { success: false, error: data.error }
    return { success: true, data }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function buildReadinessBriefPayload(result: ScoreResult, userData: any) {
  const plainLayerNames: Record<string, string> = {
    Circadian: 'Sleep & body clock', Neurochemical: 'Stress & nervous system',
    Metabolic: 'Blood sugar & energy regulation', 'Gut-Brain': 'Gut health & digestion',
    Identity: 'Mindset & self-image patterns',
  }
  const layerNamesLocal = ['Circadian', 'Neurochemical', 'Metabolic', 'Gut-Brain', 'Identity']
  const weakest = { name: layerNamesLocal[result.dominantLayer - 1], score: result.sc[result.dominantLayer] }
  const activeLayerNames = [1, 2, 3, 4, 5].filter(i => result.sc[i] <= 11).map(i => plainLayerNames[layerNamesLocal[i - 1]])
  return {
    request_type: 'readiness_brief',
    weakest_layer: weakest.name, weakest_score: weakest.score,
    weakest_layer_plain: plainLayerNames[weakest.name],
    active_layers_plain: activeLayerNames,
    resistance_pct: result.rcsInfo.compPct, total_score: result.totalScore,
    dominant_pattern: result.patternEngine.dominant_pattern,
    dominant_pattern_confidence: result.patternEngine.dominant_pattern_confidence,
    sliClass: result.hl.sliClass, briClass: result.hl.briClass,
    syliClass: result.hl.syliClass, gsiClass: result.hl.gsiClass,
    rcsClass: result.rcsInfo.label,
    gender: userData.gender, conditions: userData.conditions || [],
    cascade_risk: result.cascadeRisk,
  }
}

export function buildMainNarrativePayload(result: ScoreResult, history: HistoryEntry[], userData: any, questions: any[]) {
  const layerNames = ['Circadian Authority', 'Neurochemical Safety', 'Metabolic Signaling', 'Gut–Brain Axis', 'Identity Physiology']
  const plainLayerNamesByIdx: Record<number, string> = { 1: 'Sleep & body clock', 2: 'Stress & nervous system', 3: 'Blood sugar & energy regulation', 4: 'Gut health & digestion', 5: 'Mindset & self-image patterns' }
  const sorted = [1, 2, 3, 4, 5].map(i => ({ idx: i, score: result.sc[i] })).sort((a, b) => a.score - b.score)
  const answersPayload = history.map((h, i) => ({ question: questions[i].q, selected: h.selected.map(s => questions[i].o[s]), worstScore: h.score }))
  const activeLayersPlain = [1, 2, 3, 4, 5].filter(i => result.sc[i] <= 11).map(i => plainLayerNamesByIdx[i])
  return {
    request_type: 'main_narrative',
    totalScore: result.totalScore, band: result.band.label,
    layer1: result.sc[1], layer2: result.sc[2], layer3: result.sc[3], layer4: result.sc[4], layer5: result.sc[5],
    dominantLayerIdx: result.dominantLayer, dominantLayerName: layerNames[result.dominantLayer - 1],
    dominantLayerPlain: plainLayerNamesByIdx[result.dominantLayer],
    secondaryLayerIdx: sorted[1]?.idx, secondaryLayerName: layerNames[(sorted[1]?.idx || 1) - 1],
    active_layers_plain: activeLayersPlain, resistance_pct: result.rcsInfo.compPct,
    rcs: result.rcs, rcsClass: result.rcsInfo.label,
    gender: userData.gender, age: userData.age, conditions: userData.conditions || [],
    sleepRating: userData.sleepScore, stressRating: userData.stressScore, gutRating: userData.gutScore,
    answers: answersPayload,
    sli: result.hl.sli, sliClass: result.hl.sliClass, bri: result.hl.bri, briClass: result.hl.briClass,
    gsiClass: result.hl.gsiClass, syli: result.hl.syli, syliClass: result.hl.syliClass,
    dominant_pattern: result.patternEngine.dominant_pattern,
    dominant_pattern_confidence: result.patternEngine.dominant_pattern_confidence,
    secondary_pattern: result.patternEngine.secondary_pattern,
    secondary_pattern_confidence: result.patternEngine.secondary_pattern_confidence,
    cascade_risk: result.cascadeRisk,
  }
}

export function buildWhereToBeginPayload(result: ScoreResult, userData: any) {
  const layerNames = ['Circadian Authority', 'Neurochemical Safety', 'Metabolic Signaling', 'Gut–Brain Axis', 'Identity Physiology']
  const plainLayerNamesByIdx: Record<number, string> = { 1: 'Sleep & body clock', 2: 'Stress & nervous system', 3: 'Blood sugar & energy regulation', 4: 'Gut health & digestion', 5: 'Mindset & self-image patterns' }
  const sorted = [1, 2, 3, 4, 5].map(i => ({ idx: i, score: result.sc[i] })).sort((a, b) => a.score - b.score)
  const secondSorted = sorted.filter(s => s.idx !== result.dominantLayer)
  const activeLayersPlain = [1, 2, 3, 4, 5].filter(i => result.sc[i] <= 11).map(i => plainLayerNamesByIdx[i])
  return {
    request_type: 'where_to_begin',
    weakest_layer: layerNames[result.dominantLayer - 1],
    weakest_score: result.sc[result.dominantLayer],
    weakest_layer_plain: plainLayerNamesByIdx[result.dominantLayer],
    second_layer: secondSorted[0] ? layerNames[secondSorted[0].idx - 1] : '',
    second_score: secondSorted[0] ? secondSorted[0].score : '',
    active_layers_plain: activeLayersPlain,
    resistance_pct: result.rcsInfo.compPct,
    dominant_pattern: result.patternEngine.dominant_pattern,
    dominant_pattern_confidence: result.patternEngine.dominant_pattern_confidence,
    totalScore: result.totalScore, gender: userData.gender,
    sliClass: result.hl.sliClass, briClass: result.hl.briClass,
    rcsClass: result.rcsInfo.label, cascade_risk: result.cascadeRisk,
  }
}
