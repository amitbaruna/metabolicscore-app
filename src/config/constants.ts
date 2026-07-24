/**
 * App-wide constants & brand configuration.
 * Swap these values when you have real assets.
 */

export const BRAND = {
  name: 'Metabolic Score',
  tagline: 'Decode your metabolism. Transform your health.',
  doctorName: 'Dr. Amit Baruna',
  doctorTitle: 'Metabolic Health Specialist',
  email: 'hello@amitbaruna.com',
  website: 'https://amitbaruna.com',
  instagram: 'https://www.instagram.com/amitbaruna/?hl=en',
  instagramHandle: '@amitbaruna',
  youtube: 'https://youtube.com/@amitbaruna',
  calendly: 'https://calendly.com/amit-baruna/transformation-blueprint-call',
  // Future: own booking system with Razorpay
  razorpayEnabled: false,
  razorpayKeyId: '',
} as const;

export const LAYERS = [
  {
    id: 1,
    key: 'sleep',
    name: 'Sleep Architecture',
    tagline: 'The foundation of recovery',
    color: '#7C5CFF',
    icon: 'moon',
    description:
      'Deep sleep is when your body repairs tissue, regulates hormones, and consolidates memories. Without adequate sleep architecture, every other metabolic system suffers.',
    pillars: ['Duration', 'Consistency', 'Deep Sleep %', 'REM %', 'Sleep Onset'],
  },
  {
    id: 2,
    key: 'stress',
    name: 'Stress Resilience',
    tagline: 'Master your allostatic load',
    color: '#FF6B6B',
    icon: 'pulse',
    description:
      'Chronic stress keeps cortisol elevated, breaking down muscle, storing belly fat, and deregulating blood sugar. Building stress resilience is non-negotiable for metabolic health.',
    pillars: ['Cortisol Rhythm', 'Recovery Practices', 'Perceived Stress', 'Breath Control'],
  },
  {
    id: 3,
    key: 'gut',
    name: 'Gut Health',
    tagline: 'Your second brain',
    color: '#00D9A3',
    icon: 'leaf',
    description:
      'Your gut microbiome regulates inflammation, immunity, neurotransmitter production, and even cravings. A diverse, fibre-rich diet feeds the microbes that keep you lean and energised.',
    pillars: ['Bowel Regularity', 'Bloating', 'Diversity', 'Fibre Intake', 'Inflammation'],
  },
  {
    id: 4,
    key: 'movement',
    name: 'Movement & Fuel',
    tagline: 'Engine of metabolism',
    color: '#FFB800',
    icon: 'bicycle',
    description:
      'Muscle is metabolically active tissue. The right mix of strength training, NEAT (daily movement), and strategic cardio keeps your metabolic engine humming for decades.',
    pillars: ['Steps/Day', 'Strength Training', 'NEAT', 'Sedentary Time', 'VO2 Capacity'],
  },
  {
    id: 5,
    key: 'nervous',
    name: 'Nervous System',
    tagline: 'Sympathetic vs Parasympathetic',
    color: '#4DA8FF',
    icon: 'wifi',
    description:
      'Most modern humans are stuck in sympathetic dominance (fight-or-flight). Learning to activate the parasympathetic system is the hidden key to fat loss, deep sleep, and lasting energy.',
    pillars: ['HRV', 'Resting HR', 'Breath Rate', 'Sympathetic Load', 'Recovery'],
  },
] as const;

export const NAV_TABS = {
  Home: 'home',
  Score: 'score',
  Layers: 'layers',
  Profile: 'profile',
} as const;
