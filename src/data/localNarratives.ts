// LOCAL NARRATIVE ENGINE — generates N1/N2/N3 without Claude API ($0.12 → $0)
import type { ScoreResult, HistoryEntry } from './metabolicEngine';

export type LocalN1 = { brief: string };
export type LocalN2 = { narrative: string };
export type LocalN3 = { title: string; body: string };
export type LocalNarratives = { n1: LocalN1; n2: LocalN2; n3: LocalN3 };

type UserData = {
  gender: string; age: string; conditions: string[];
  sleepScore: number; stressScore: number; gutScore: number;
};

const LAYER_NAMES = ['Circadian Authority', 'Neurochemical Safety', 'Metabolic Signaling', 'Gut–Brain Axis', 'Identity Physiology'];
// Plain-language versions, used only inside cascade explanation text so an ordinary person
// understands it immediately — the official names stay visible everywhere else (node labels,
// legend, badges), nothing about the actual framework terminology changes anywhere but here.
export const LAYER_PLAIN = ['your body clock', 'your stress response system', 'how your body manages energy', 'your gut-brain connection', 'your mindset and self-image'];
// Short form of the same five, for tight spaces (graph nodes, badges) where the full phrase
// above won't fit — same plain-language spirit, just compressed to one or two words.
export const LAYER_PLAIN_SHORT = ['Sleep', 'Stress', 'Energy', 'Gut', 'Mindset'];

const N1_OPENERS: Record<string, string[]> = {
  'Strong Readiness': ['Your body retains strong biological readiness to respond to change.', 'Your recovery systems are largely intact — your body is primed for adaptation.', 'You have strong metabolic reserves to draw on.'],
  'Good Readiness': ['Your body has good readiness to change.', 'Your recovery capacity is solid, with some strain present.', 'You have adequate adaptive reserves to work with.'],
  'Moderate': ['Your body retains some adaptive capacity.', 'Your recovery systems are partially compromised but still functional.', 'You have moderate readiness — results are possible but may be slower than expected.'],
  'Compromised': ['Your body may be spending more energy on protection than on adaptation.', 'Your recovery capacity is compromised — your system is in defense mode.', 'Your body is allocating resources toward survival rather than transformation.'],
  'Severely Compromised': ['Your body appears to be allocating most of its resources toward survival and protection.', 'Your recovery systems are severely compromised — your body is in deep defense mode.', 'Your adaptive capacity is significantly depleted — your body is prioritizing survival over change.'],
};

const N1_PATTERNS: Record<string, string> = {
  'System-Wide Adaptation Deficit': 'The strain is system-wide — multiple layers are underperforming simultaneously, which means isolated interventions won\'t be enough.',
  'Recovery Deficit': 'Your recovery systems are depleted — without addressing this first, diet and training changes may under-deliver.',
  'Nervous System Overload': 'Your nervous system is locked in protective mode — this is suppressing every other system downstream.',
  'Fuel Regulation Bottleneck': 'Your body struggles to efficiently produce and use energy — the metabolic engine is bottlenecked.',
  'Metabolic Resistance Pattern': 'Your body is actively resisting metabolic change — effort alone may not break through this pattern.',
  'Circadian Disruption Pattern': 'Your body clock is misaligned — this single issue is cascading into every other system.',
  'Gut-Brain Load': 'Your gut-brain axis is under significant strain — this is affecting mood, energy, and cravings simultaneously.',
  'Behavioral Recovery Gap': 'Your body has capacity but your behaviors aren\'t supporting recovery — this is a pattern gap, not a system failure.',
  'Single System Bottleneck': 'One layer is the primary blocker — addressing it directly may unlock progress across the board.',
};

const N1_CLOSERS: string[] = [
  'The right intervention, applied to the right layer, may work faster than you expect.',
  'Targeted action on your weakest layer may create a cascade of improvement.',
  'Once the primary bottleneck is addressed, your other systems may naturally stabilize.',
  'The path forward is specific — not more effort, but better-directed effort.',
];

function generateN1(result: ScoreResult, _userData: UserData): LocalN1 {
  const rcsLabel = result.rcsInfo.label;
  const openers = N1_OPENERS[rcsLabel] || N1_OPENERS['Moderate'];
  const opener = openers[Math.floor(Math.random() * openers.length)];
  const patternLine = N1_PATTERNS[result.patternEngine.dominant_pattern] || N1_PATTERNS['Single System Bottleneck'];
  const closer = N1_CLOSERS[Math.floor(Math.random() * N1_CLOSERS.length)];
  const weakestName = LAYER_NAMES[result.dominantLayer - 1];
  return { brief: `${opener} ${patternLine} Your primary bottleneck is ${weakestName} — focusing here first may unlock the most progress. ${closer}` };
}

const N2_LAYER_INTROS: Record<number, string[]> = {
  1: ['Your circadian system is the root bottleneck.', 'Layer 1 — your sleep architecture — is where the breakdown starts.', 'Your body clock is misaligned, and everything downstream is paying the price.'],
  2: ['Your nervous system is locked in protective mode.', 'Layer 2 — your neurochemical safety — is compromised.', 'Your stress response system is stuck in fight-or-flight.'],
  3: ['Your metabolic signaling is dysfunctional.', 'Layer 3 — your blood sugar regulation — is the primary issue.', 'Your body\'s energy production and utilization is impaired.'],
  4: ['Your gut-brain axis is under significant strain.', 'Layer 4 — your digestive system — is compromised.', 'Your gut health is driving inflammation and neurotransmitter imbalance.'],
  5: ['Your identity physiology is working against you.', 'Layer 5 — your mindset-body connection — is the deepest blocker.', 'Your self-image patterns are sabotaging your physiological progress.'],
};

const N2_HIDDEN_INDEX: Record<string, string> = {
  'Severe Load': 'Your Stress Load Index is critically elevated — cortisol is breaking down muscle, storing visceral fat, and suppressing thyroid conversion.',
  'High Load': 'Your Stress Load Index is high — sustained stress hormone activity is directly interfering with recovery and fat loss.',
  'Moderate Load': 'Your Stress Load Index is moderate — stress is a contributing factor but not the primary driver.',
  'Low Load': 'Your Stress Load Index is low — stress is well-managed.',
  'Severely Compromised': 'Your Behavioral Resilience Index is severely compromised — your behaviors aren\'t supporting recovery.',
  'Fragile': 'Your Behavioral Resilience Index is fragile — small setbacks derail you for days.',
  'Moderate': 'Your Behavioral Resilience Index is moderate — you recover from setbacks but with effort.',
  'Strong': 'Your Behavioral Resilience Index is strong — your behaviors support consistent recovery.',
  'Severe Instability': 'Your Glucose Stability Index shows severe instability — blood sugar swings are driving energy crashes and cravings.',
  'Moderate Instability': 'Your Glucose Stability Index shows moderate instability — post-meal crashes are affecting your energy.',
  'Mild Instability': 'Your Glucose Stability Index shows mild instability — minor blood sugar fluctuations present.',
  'Stable': 'Your Glucose Stability Index is stable — blood sugar regulation is working well.',
  'System-Wide Load': 'Your System-Wide Load Index shows strain across multiple layers — this is a complex pattern requiring sequenced intervention.',
  'High Complexity': 'Your pattern shows high complexity — multiple systems are underperforming simultaneously.',
  'Multi-System': 'Your pattern spans multiple systems — a phased approach may work better than trying to fix everything at once.',
  'Localized': 'Your pattern is localized to one system — this is actually good news, as targeted intervention may resolve it faster.',
};

const N2_CASCADES: Record<string, string> = {
  'L1 Circadian failure': 'When Layer 1 (circadian) fails, cortisol elevates, which suppresses serotonin and destabilizes Layer 2 (neurochemical).',
  'L2 Neurochemical compromised': 'When Layer 2 (neurochemical) is compromised, it drives Layer 4 (gut-brain) dysfunction — 90% of serotonin is produced in the gut.',
  'L3 + L4 feedback loop': 'Insulin resistance (L3) and gut inflammation (L4) create a feedback loop — each makes the other worse.',
  'L4 Gut-Brain severely compromised': 'A compromised gut-brain axis directly affects mood, energy, and cravings via the vagus nerve.',
  'L1 Circadian disruption': 'Circadian disruption cascades into both gut health and identity patterns — your body loses its rhythmic anchor.',
};

function generateN2(result: ScoreResult, _userData: UserData): LocalN2 {
  const layerIntros = N2_LAYER_INTROS[result.dominantLayer] || N2_LAYER_INTROS[2];
  const intro = layerIntros[Math.floor(Math.random() * layerIntros.length)];
  const hl = result.hl;
  const indices = [
    { class: hl.sliClass }, { class: hl.briClass },
    { class: hl.gsiClass }, { class: hl.syliClass },
  ];
  const severityOrder = ['Severe', 'High', 'Moderate', 'Mild', 'Fragile', 'Compromised', 'Instability', 'Multi-System', 'Complexity', 'Localized', 'Low', 'Strong', 'Stable'];
  const sortedIndices = indices.sort((a, b) => {
    const aSev = severityOrder.findIndex(s => a.class.includes(s));
    const bSev = severityOrder.findIndex(s => b.class.includes(s));
    return (aSev === -1 ? 99 : aSev) - (bSev === -1 ? 99 : bSev);
  });
  const mostSevereIndex = sortedIndices[0];
  const indexLine = N2_HIDDEN_INDEX[mostSevereIndex.class] || N2_HIDDEN_INDEX['Moderate'];
  const cascadeStr = result.cascadeRisk;
  let cascadeLine = '';
  if (!cascadeStr.includes('No immediate cascade')) {
    const cascades = cascadeStr.split('|').map(s => s.trim()).filter(Boolean);
    for (const c of cascades) {
      for (const key of Object.keys(N2_CASCADES)) {
        if (c.startsWith(key)) { cascadeLine = N2_CASCADES[key]; break; }
      }
      if (cascadeLine) break;
    }
  }
  let symptomLine = '';
  const layerQs = result.history.filter(h => h.layer === result.dominantLayer);
  if (layerQs.length > 0) {
    const worst = layerQs.sort((a, b) => a.score - b.score)[0];
    if (worst.score <= 4) symptomLine = ` This is why your effort alone hasn't produced results — your body is spending energy on protection, not adaptation.`;
  }
  let narrative = `${intro} ${indexLine}`;
  if (cascadeLine) narrative += ` ${cascadeLine}`;
  if (symptomLine) narrative += symptomLine;
  return { narrative };
}

const N3_TITLES: Record<number, string[]> = {
  1: ['Start with your sleep, not your diet', 'Fix your body clock first', 'Anchor your circadian rhythm'],
  2: ['Calm your nervous system before changing your diet', 'Start with safety, not willpower', 'Shift out of fight-or-flight first'],
  3: ['Stabilize your blood sugar before cutting calories', 'Fix your metabolic signaling first', 'Start with glucose regulation'],
  4: ['Heal your gut before adding supplements', 'Start with your microbiome', 'Address gut inflammation first'],
  5: ['Shift your identity before changing your habits', 'Start with how you see yourself', 'Rewrite your body story first'],
};

const N3_PRACTICES: Record<number, { title: string; outcome: string }> = {
  1: { title: '10 minutes of direct sunlight within 30 minutes of waking', outcome: 'anchors your circadian rhythm and triggers earlier melatonin that night' },
  2: { title: '5 minutes of box breathing daily (inhale 4, hold 4, exhale 4, hold 4)', outcome: 'drops cortisol by 20% within two weeks and shifts you into parasympathetic' },
  3: { title: 'a 10-minute walk after your largest meal', outcome: 'lowers your post-meal glucose spike by 30% and stabilizes energy' },
  4: { title: '30 different plant foods per week', outcome: 'is the single biggest predictor of microbiome diversity and reduces gut inflammation' },
  5: { title: 'writing and reading aloud a daily identity statement', outcome: 'rewires your self-image at the neurological level and improves consistency' },
};

const N3_TIMELINES: Record<string, string> = {
  'Strong Readiness': 'You may see measurable change within 4-6 weeks.',
  'Good Readiness': 'Meaningful progress may be possible within 6-8 weeks.',
  'Moderate': 'Results may be possible within 8-10 weeks, but may be slower until recovery systems are supported.',
  'Compromised': 'Progress may be slower — often 10-14 weeks, but changes may compound once your body feels safe.',
  'Severely Compromised': 'Recovery may take 12-16 weeks — your body likely needs to rebuild its adaptive capacity before it can transform.',
};

function generateN3(result: ScoreResult, _userData: UserData): LocalN3 {
  const titles = N3_TITLES[result.dominantLayer] || N3_TITLES[2];
  const title = titles[Math.floor(Math.random() * titles.length)];
  const practice = N3_PRACTICES[result.dominantLayer] || N3_PRACTICES[2];
  const timeline = N3_TIMELINES[result.rcsInfo.label] || N3_TIMELINES['Moderate'];
  return { title, body: `${practice.title} ${practice.outcome}. Once your body starts feeling safe, your existing nutrition and training may start working better. ${timeline} Don't add more — add this one thing first.` };
}

export function generateLocalNarratives(result: ScoreResult, userData: UserData): LocalNarratives {
  return { n1: generateN1(result, userData), n2: generateN2(result, userData), n3: generateN3(result, userData) };
}

export function generateLocalN1(result: ScoreResult, userData: UserData): string {
  return generateN1(result, userData).brief;
}

export function generateLocalN2(result: ScoreResult, userData: UserData, _history?: HistoryEntry[], _questions?: any[]): string {
  return generateN2(result, userData).narrative;
}

export function generateLocalN3(result: ScoreResult, userData: UserData): { title: string; body: string } {
  return generateN3(result, userData);
}

export function shouldUseClaudeFallback(result: ScoreResult): boolean {
  const activeLayers = [1, 2, 3, 4, 5].filter(i => result.sc[i] < 10).length;
  const cascadeCount = result.cascadeRisk.includes('No immediate cascade') ? 0 : result.cascadeRisk.split('|').filter(Boolean).length;
  return activeLayers >= 4 && cascadeCount >= 4;
}

export type DominoEffect = {
  cascade: string;
  userLanguage: string;
  rootLayer: number;
  action: string;
  actionOutcome: string;
  totalCascades: number;
} | null;

const DOMINO_ACTIONS: Record<number, { action: string; outcome: string }> = {
  1: {
    action: 'Get 10 minutes of direct sunlight within 30 minutes of waking',
    outcome: 'may reset your cortisol curve and start stabilizing every downstream layer that depends on your circadian rhythm',
  },
  2: {
    action: 'Do 5 minutes of box breathing daily (inhale 4, hold 4, exhale 4, hold 4)',
    outcome: 'may lower cortisol and shift your nervous system out of fight-or-flight, which could reduce strain on multiple downstream systems',
  },
  3: {
    action: 'Take a 20-minute walk after your largest meal',
    outcome: 'may lower your post-meal glucose spike and reduce the insulin resistance that could be driving the cascade',
  },
  4: {
    action: 'Eat one meal today without screens — chew slowly and pay attention to each bite',
    outcome: 'may reduce gut inflammation and improve the vagus nerve signaling that connects your gut to your brain',
  },
  5: {
    action: 'Write and read aloud a daily identity statement that affirms your capacity to change',
    outcome: 'may begin rewiring the self-image patterns that could be reinforcing physiological stress',
  },
};

const CASCADE_USER_LANG: [RegExp, (root: string, others: string[]) => string][] = [
  [/L1.*failure.*→.*L2/i,
    (root, others) => `Your ${root} may be pulling down ${others[0] || 'your stress response system'}. When your body clock misfires, cortisol probably stays elevated — this may suppress serotonin and keep your stress response on high alert.`],
  [/L2.*compromised.*→.*L4/i,
    (root, others) => `Your ${root} may be weakening ${others[0] || 'your gut-brain connection'}. Since 90% of serotonin is produced in the gut, stress strain may directly translate to digestive and mood issues.`],
  [/L3.*\+.*L4.*feedback/i,
    () => `There may be a feedback loop between ${LAYER_PLAIN[2]} and ${LAYER_PLAIN[3]}. Insulin resistance may be driving gut inflammation, and the gut inflammation may make insulin resistance worse — each one probably feeds the other.`],
  [/L4.*severely/i,
    (root) => `${root.charAt(0).toUpperCase() + root.slice(1)} may be under severe strain. A compromised gut-brain connection may directly affect your mood, energy, and cravings through vagus nerve signaling.`],
  [/L1.*disruption.*→.*L4/i,
    (root, others) => `Your ${root} disruption may be reaching ${others[0] || 'your gut-brain connection'}. Your body clock and gut health are closely connected — a misaligned rhythm may worsen digestive strain.`],
  [/L1.*disruption.*→.*L5/i,
    (root, others) => `Your ${root} disruption may be affecting ${others[0] || 'your mindset and self-image'}. When your body loses its rhythmic anchor, behavioral patterns and self-image may start to shift negatively.`],
  [/L2.*overload.*→.*L3/i,
    (root, others) => `Your ${root} may be putting pressure on ${others[0] || 'how your body manages energy'}. Chronic stress hormones may interfere with how your body produces and uses energy.`],
  [/L3.*instability.*→.*L5/i,
    (root, others) => `Instability in ${root} may be influencing ${others[0] || 'your mindset and self-image'}. Blood sugar swings may create mood and motivation dips that reinforce negative self-image patterns.`],
  [/L4.*compromised.*→.*L5/i,
    (root, others) => `Your ${root} may be weakening ${others[0] || 'your mindset and self-image'}. Gut inflammation may affect neurotransmitter production, which may influence how you see yourself and your ability to stay consistent.`],
];

function translateCascadeToUserLang(cascade: string, rootLayer: number): string {
  const layerMatches = cascade.match(/L(\d)/g);
  const layersInvolved = layerMatches
    ? [...new Set(layerMatches.map(m => parseInt(m.slice(1))))]
    : [rootLayer];

  const rootName = LAYER_PLAIN[rootLayer - 1];
  const otherNames = layersInvolved
    .filter(l => l !== rootLayer)
    .map(l => LAYER_PLAIN[l - 1]);

  for (const [pattern, builder] of CASCADE_USER_LANG) {
    if (pattern.test(cascade)) return builder(rootName, otherNames);
  }

  // Fallback: generic cascade language
  if (otherNames.length > 0) {
    return `Your ${rootName} may be cascading into ${otherNames[0]}. When one layer is under strain, it may pull down connected systems — addressing ${rootName} first may help stabilize the others.`;
  }
  return `Your ${rootName} is the root of a cascade pattern. When this layer is under strain, it may pull down connected systems — targeted action here may help break the chain.`;
}

// Ranks raw cascade strings by relevance to the dominant layer: the dominant layer being the
// root cause ranks highest, then the dominant layer as a downstream victim, then feedback loops,
// then everything else in original order. This is the single source of truth for cascade
// priority — both generateDominoEffect and the Metabolic Story visualization use this, so they
// can never disagree about which cascade is "most important."
export function rankCascadeStrings(cascadeRisk: string, dominantLayer: number): string[] {
  if (!cascadeRisk || cascadeRisk.includes('No immediate cascade')) return [];
  const cascades = cascadeRisk.split('|').map(s => s.trim()).filter(Boolean);
  if (cascades.length === 0) return [];
  const ranked = cascades.map((c, i) => {
    let priority = 4; // default: secondary / weakest
    if (c.startsWith(`L${dominantLayer}`)) {
      priority = 1; // dominant IS the root cause
    } else if (c.includes(`L${dominantLayer}`)) {
      priority = 2; // dominant is downstream
    } else if (c.includes('feedback loop')) {
      priority = 3; // feedback loop
    }
    return { cascade: c, priority, originalIdx: i };
  });
  ranked.sort((a, b) => a.priority - b.priority || a.originalIdx - b.originalIdx);
  return ranked.map(r => r.cascade);
}

export function generateDominoEffect(scoreResult: ScoreResult, idx: number): DominoEffect {
  const cascadeStr = scoreResult.cascadeRisk;

  // No cascades → no domino card
  if (!cascadeStr || cascadeStr.includes('No immediate cascade')) {
    return null;
  }

  const rootLayer = scoreResult.dominantLayer;
  const ranked = rankCascadeStrings(cascadeStr, rootLayer);
  if (ranked.length === 0) return null;

  // Pick the cascade at the given rotation index (wraps around)
  const picked = ranked[idx % ranked.length];

  // Translate to user-facing language
  const userLanguage = translateCascadeToUserLang(picked, rootLayer);

  // Action for the root layer
  const layerAction = DOMINO_ACTIONS[rootLayer] || DOMINO_ACTIONS[2];

  return {
    cascade: picked,
    userLanguage,
    rootLayer,
    action: layerAction.action,
    actionOutcome: layerAction.outcome,
    totalCascades: ranked.length,
  };
}

export type WeeklyBrief = { line: string; trend: 'improving' | 'declining' | 'stable' | 'baseline' };

export function generateWeeklyBrief(scoreHistory: { total_score: number; date: string }[]): WeeklyBrief {
  if (scoreHistory.length === 0) return { line: 'Take your first Metabolic Score™ to begin tracking.', trend: 'baseline' };
  if (scoreHistory.length === 1) return { line: `Baseline established at ${scoreHistory[0].total_score}/100. Retake in 2 weeks to see your trajectory.`, trend: 'baseline' };
  const latest = scoreHistory[0].total_score;
  const previous = scoreHistory[1].total_score;
  const delta = latest - previous;
  if (delta > 0) {
    if (delta >= 10) return { line: `Strong improvement — +${delta} points since last assessment. Your interventions are working.`, trend: 'improving' };
    return { line: `Trending up — +${delta} points since last assessment. Keep going.`, trend: 'improving' };
  }
  if (delta < 0) {
    if (delta <= -5) return { line: `Score dropped ${delta} points. Check in with your stress, sleep, and consistency — something shifted.`, trend: 'declining' };
    return { line: `Slight dip (${delta} points). Normal fluctuation — stay the course.`, trend: 'declining' };
  }
  return { line: `Score held steady at ${latest}. If you're applying protocols, consider adjusting your approach.`, trend: 'stable' };
}
