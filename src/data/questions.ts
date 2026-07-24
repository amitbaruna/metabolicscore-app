/**
 * 14-Step Metabolic Score™ Diagnostic
 *
 * Each question maps to one of the 5 Layers.
 * Sliders return a numeric value (0-10), chips return a string that
 * gets normalised to a numeric score by the calculator.
 */

export type QuestionType = 'slider' | 'chips';

export type Question = {
  id: number;
  layer: 'sleep' | 'stress' | 'gut' | 'movement' | 'nervous';
  type: QuestionType;
  title: string;
  subtitle?: string;
  // slider config
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  unit?: string;
  // chips config
  options?: { label: string; value: number }[];
};

export const QUESTIONS: Question[] = [
  // SLEEP (3 questions)
  {
    id: 1,
    layer: 'sleep',
    type: 'slider',
    title: 'How many hours did you sleep last night?',
    subtitle: 'Average over the past week',
    min: 3, max: 10, minLabel: '3h', maxLabel: '10h', unit: 'h',
  },
  {
    id: 2,
    layer: 'sleep',
    type: 'slider',
    title: 'Rate your sleep quality',
    subtitle: '1 = restless, 10 = deep and restorative',
    min: 1, max: 10, minLabel: 'Poor', maxLabel: 'Excellent',
  },
  {
    id: 3,
    layer: 'sleep',
    type: 'chips',
    title: 'How often do you wake up feeling rested?',
    options: [
      { label: 'Never',        value: 0 },
      { label: 'Rarely',       value: 25 },
      { label: 'Sometimes',    value: 50 },
      { label: 'Usually',      value: 75 },
      { label: 'Always',       value: 100 },
    ],
  },

  // STRESS (3 questions)
  {
    id: 4,
    layer: 'stress',
    type: 'slider',
    title: 'On average, how stressed do you feel?',
    subtitle: '1 = calm, 10 = overwhelmed (lower is better — we invert it)',
    min: 1, max: 10, minLabel: 'Calm', maxLabel: 'Overwhelmed',
  },
  {
    id: 5,
    layer: 'stress',
    type: 'chips',
    title: 'How often do you practice stress recovery?',
    subtitle: 'Meditation, breathwork, nature, journaling, etc.',
    options: [
      { label: 'Never',         value: 0 },
      { label: 'Rarely',        value: 25 },
      { label: '1-2x / week',   value: 50 },
      { label: '3-4x / week',   value: 75 },
      { label: 'Daily',         value: 100 },
    ],
  },
  {
    id: 6,
    layer: 'stress',
    type: 'chips',
    title: 'How would you describe your workload stress?',
    options: [
      { label: 'Manageable',    value: 100 },
      { label: 'Sometimes high',value: 75 },
      { label: 'Often high',    value: 50 },
      { label: 'Constantly high', value: 25 },
      { label: 'Burned out',    value: 0 },
    ],
  },

  // GUT (3 questions)
  {
    id: 7,
    layer: 'gut',
    type: 'chips',
    title: 'How regular are your bowel movements?',
    subtitle: 'Ideal is 1-3x daily, formed and easy',
    options: [
      { label: 'Irregular / constipated', value: 0 },
      { label: 'Every 2-3 days',          value: 33 },
      { label: 'Once daily',              value: 66 },
      { label: '1-3x daily, easy',        value: 100 },
    ],
  },
  {
    id: 8,
    layer: 'gut',
    type: 'chips',
    title: 'How often do you experience bloating after meals?',
    options: [
      { label: 'Never',       value: 100 },
      { label: 'Rarely',      value: 75 },
      { label: 'Sometimes',   value: 50 },
      { label: 'Often',       value: 25 },
      { label: 'Always',      value: 0 },
    ],
  },
  {
    id: 9,
    layer: 'gut',
    type: 'slider',
    title: 'How many different plant foods do you eat weekly?',
    subtitle: 'Aim for 30+ for microbiome diversity',
    min: 0, max: 40, minLabel: '0', maxLabel: '40+',
  },

  // MOVEMENT (3 questions)
  {
    id: 10,
    layer: 'movement',
    type: 'slider',
    title: 'Average daily steps over the past week',
    min: 1000, max: 15000, minLabel: '1k', maxLabel: '15k',
  },
  {
    id: 11,
    layer: 'movement',
    type: 'chips',
    title: 'How many strength training sessions per week?',
    options: [
      { label: '0',          value: 0 },
      { label: '1-2',        value: 50 },
      { label: '3-4',        value: 100 },
      { label: '5+',         value: 85 },
    ],
  },
  {
    id: 12,
    layer: 'movement',
    type: 'slider',
    title: 'Hours of sedentary time per day (sitting)',
    subtitle: 'Lower is better',
    min: 1, max: 14, minLabel: '1h', maxLabel: '14h',
  },

  // NERVOUS SYSTEM (2 questions)
  {
    id: 13,
    layer: 'nervous',
    type: 'slider',
    title: 'How would you rate your daily energy levels?',
    subtitle: '1 = exhausted, 10 = vibrant',
    min: 1, max: 10, minLabel: 'Exhausted', maxLabel: 'Vibrant',
  },
  {
    id: 14,
    layer: 'nervous',
    type: 'chips',
    title: 'How often do you feel "wired but tired"?',
    subtitle: 'A classic sign of sympathetic dominance',
    options: [
      { label: 'Never',       value: 100 },
      { label: 'Rarely',      value: 75 },
      { label: 'Sometimes',   value: 50 },
      { label: 'Often',       value: 25 },
      { label: 'Always',      value: 0 },
    ],
  },
];

export const QUESTION_COUNT = QUESTIONS.length;

/**
 * Convert raw answers into a 0-100 score per layer + overall total.
 */
export function calculateScore(answers: Record<number, number | string>) {
  const layerScores: Record<string, { sum: number; count: number }> = {
    sleep: { sum: 0, count: 0 },
    stress: { sum: 0, count: 0 },
    gut: { sum: 0, count: 0 },
    movement: { sum: 0, count: 0 },
    nervous: { sum: 0, count: 0 },
  };

  QUESTIONS.forEach((q) => {
    const raw = answers[q.id];
    if (raw === undefined || raw === null) return;

    let normalised = 0;
    if (q.type === 'slider') {
      const num = typeof raw === 'string' ? parseFloat(raw) : raw;
      const min = q.min ?? 0;
      const max = q.max ?? 10;
      // For "lower is better" questions, invert.
      const lowerIsBetter = ['sleep_hours_inverse', 'sedentary'].includes(q.id as any) ||
        q.title.toLowerCase().includes('sedentary') ||
        q.title.toLowerCase().includes('stressed') ||
        (q.id === 4) || (q.id === 12);

      if (lowerIsBetter) {
        normalised = ((max - num) / (max - min)) * 100;
      } else {
        normalised = ((num - min) / (max - min)) * 100;
      }
    } else if (q.type === 'chips') {
      normalised = typeof raw === 'number' ? raw : parseFloat(raw);
    }

    layerScores[q.layer].sum += Math.max(0, Math.min(100, normalised));
    layerScores[q.layer].count += 1;
  });

  const layers: Record<string, number> = {};
  Object.keys(layerScores).forEach((k) => {
    const { sum, count } = layerScores[k];
    layers[k] = count > 0 ? Math.round(sum / count) : 0;
  });

  // Weighted total — equal weights for v1
  const total = Math.round(
    Object.values(layers).reduce((a, b) => a + b, 0) / Object.values(layers).length
  );

  const tier = getTier(total);

  return { total, layers, tier };
}

export function getTier(score: number) {
  if (score >= 85) return 'Thriving';
  if (score >= 70) return 'Optimising';
  if (score >= 50) return 'Building';
  if (score >= 30) return 'Developing';
  return 'Critical';
}

export function getTierColor(tier: string) {
  switch (tier) {
    case 'Thriving':   return '#00D9A3';
    case 'Optimising': return '#4DA8FF';
    case 'Building':   return '#FFB800';
    case 'Developing': return '#FF8A4D';
    default:           return '#FF4D6D';
  }
}
