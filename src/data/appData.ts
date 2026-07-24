// Metabolic Score data — questions, layers, conditions, case studies

export const BRAND = {
  name: 'Metabolic Score',
  fullName: 'Amit Baruna',
  title: 'Metabolic Health Coach',
  tagline: 'Find out which of your 5 metabolic layers is blocking your fat loss.',
  instagram: 'https://www.instagram.com/amitbaruna/?hl=en',
  instagramHandle: '@amitbaruna',
  calendly: 'https://calendly.com/amit-baruna/transformation-blueprint-call',
}

// Update monthly — single source of truth, referenced on Home and the Methodology/Specialisation pages.
// Do not hardcode these numbers anywhere else in the app.
export const ABOUT_STATS = {
  years: '9+',
  clients: '4,000+',
  glp1Cases: '350+',
}

export type Layer = { id: number; key: string; name: string; shortName: string; tagline: string; color: string; icon: string; description: string }

export const LAYERS: Layer[] = [
  { id: 1, key: 'circadian', name: 'Circadian Authority', shortName: 'L1 — Circadian', tagline: 'Sleep & recovery', color: '#7C5CFF', icon: 'moon', description: 'Your sleep architecture, circadian rhythm, and recovery capacity. The foundation — every other layer depends on it.' },
  { id: 2, key: 'neurochemical', name: 'Neurochemical Safety', shortName: 'L2 — Neurochemical', tagline: 'Stress & cortisol', color: '#FF6B6B', icon: 'brain', description: 'Your nervous system\'s sense of safety. Chronic stress keeps cortisol elevated, breaks down muscle, stores belly fat.' },
  { id: 3, key: 'metabolic', name: 'Metabolic Signaling', shortName: 'L3 — Metabolic', tagline: 'Energy', color: '#FFB800', icon: 'zap', description: 'How efficiently your body produces and uses energy. Insulin resistance, mitochondrial dysfunction, blood sugar swings.' },
  { id: 4, key: 'gutbrain', name: 'Gut–Brain Axis', shortName: 'L4 — Gut-Brain', tagline: 'Digestion & immunity', color: '#00D9A3', icon: 'gutbrain', description: 'Your gut microbiome regulates 70% of immunity, 90% of serotonin, and influences every craving.' },
  { id: 5, key: 'identity', name: 'Identity Physiology', shortName: 'L5 — Identity', tagline: 'Hormones & identity', color: '#4DA8FF', icon: 'user', description: 'The deepest layer — how your body identity and hormonal patterns shape consistency.' },
]

// === 10 BASE QUESTIONS (from amitbaruna.com) ===
export type Question = { id: number; layer: number; layerName: string; q: string; o: string[] }

export const QUESTIONS: Question[] = [
  { id: 0, layer: 1, layerName: 'Layer 1 — Circadian Authority', q: 'How do you feel when you wake up in the morning?', o: ['I wake up feeling fresh and ready for the day', 'I feel okay but it takes me some time to fully wake up', 'I struggle to wake up and often start the day feeling tired', 'I often wake up tired, sometimes with brain fog or even a headache', 'Exhausted and foggy most mornings — regardless of how long I slept'] },
  { id: 1, layer: 1, layerName: 'Layer 1 — Circadian Authority', q: 'How would you describe your energy levels during the day?', o: ['Consistent and stable throughout', 'Good in the morning, dips a little in the afternoon', 'My energy drops significantly by afternoon, especially after lunch', 'Low energy most of the day — I often feel tired', 'No energy at all — basic tasks feel exhausting'] },
  { id: 2, layer: 2, layerName: 'Layer 2 — Neurochemical Safety', q: 'When life gets stressful, what usually happens to you?', o: ['I stay fairly calm and handle it well', "I feel stressed, but it doesn't affect me too much", 'I become more anxious and find it harder to switch off', 'I feel constantly on edge, even when nothing is wrong', "I feel like I'm always in survival mode and can never truly relax"] },
  { id: 3, layer: 2, layerName: 'Layer 2 — Neurochemical Safety', q: "When you're stressed or overwhelmed, what usually happens with food?", o: ['My eating habits stay pretty much the same', 'I snack a little more, but nothing major', 'I notice more cravings, especially for comfort foods', "I often eat even when I'm not physically hungry", 'Stress makes it very hard to control what or how much I eat'] },
  { id: 4, layer: 3, layerName: 'Layer 3 — Metabolic Signaling', q: 'When you genuinely try to lose weight, what usually happens?', o: ['I lose weight steadily', 'I lose weight but it takes much more effort than it used to', 'I lose a little then plateau — even when I am doing everything right', 'I see almost no change no matter how little I eat', 'I sometimes gain weight even when eating very little'] },
  { id: 5, layer: 3, layerName: 'Layer 3 — Metabolic Signaling', q: 'How do you feel after lunch?', o: ['Fine — satisfied and energetic', 'Slightly tired but manageable', 'Sleepy or foggy — I struggle to focus', 'Bloated, sleepy, tired and sometimes hungry again', 'My energy completely crashes after eating'] },
  { id: 6, layer: 4, layerName: 'Layer 4 — Gut–Brain Axis', q: 'How would you describe your digestion?', o: ['My digestion feels normal and rarely causes problems', 'I occasionally experience bloating or discomfort', 'I regularly experience bloating, gas or stomach discomfort', 'My digestive issues are frequent and affect how I feel most days', 'My gut feels sensitive to almost everything I eat'] },
  { id: 7, layer: 4, layerName: 'Layer 4 — Gut–Brain Axis', q: 'How clear does your mind feel on a typical day?', o: ['My mind feels clear, focused and sharp', 'I occasionally lose focus but usually think clearly', 'I often feel foggy or unfocused — it comes and goes through the day', 'Struggling to concentrate most of the time', "Constant fog — I can't remember things or think straight"] },
  { id: 8, layer: 5, layerName: 'Layer 5 — Identity Physiology', q: 'When you try to improve your health, what usually happens?', o: ['I stay consistent and usually see good results', 'I have setbacks, but I get back on track', 'I start well, but always seem to lose consistency', "I've tried so many things — nothing seems to work for me", 'No matter what I try, I always end up back where I started'] },
  { id: 9, layer: 5, layerName: 'Layer 5 — Identity Physiology', q: "How do you feel about your body's ability to change?", o: ['My body responds well when I make healthy changes', 'Progress can be slow, but I usually see results', 'I have to work really hard to see even little changes', "I barely lose weight even when I'm doing everything right", 'I genuinely feel like my body is working against me'] },
]

// === 30 ADAPTIVE QUESTIONS (6 per layer) ===
export const ADAPTIVE_BANK: Record<number, { q: string; o: string[]; disc: number }[]> = {
  1: [
    { q: 'What time do you naturally start feeling sleepy at night?', o: ['Before 10 PM — consistently', '10–11 PM, fairly consistently', '11 PM–12 AM, varies a lot', 'After 12 AM most nights', 'I rarely feel naturally sleepy — I have to force it'], disc: 0.78 },
    { q: 'Do you wake up during the night and struggle to fall back asleep?', o: ['Rarely or never', 'Occasionally, but I fall back asleep quickly', 'A few times a week, takes a while to settle', 'Most nights, and it takes 20+ minutes', 'Most nights, and I often stay awake for an hour or more'], disc: 0.74 },
    { q: 'How does bright light or screen use late at night affect you?', o: ['No noticeable effect on my sleep', 'Slightly harder to fall asleep after screens', 'Noticeably delays when I feel sleepy', 'Screens keep me wired for hours afterward', "I can't wind down at all if I've been on a screen"], disc: 0.68 },
    { q: 'How consistent is your sleep and wake time across the week?', o: ['Same time every day, weekdays and weekends', 'Mostly consistent, small shifts on weekends', 'Weekends are 1–2 hours later than weekdays', 'Weekends are 3+ hours off from weekdays', 'No real pattern — it changes constantly'], disc: 0.81 },
    { q: 'Do you feel like you need an alarm to wake up, even after enough sleep?', o: ['I usually wake naturally before my alarm', 'I wake close to my alarm, feeling ready', 'I need the alarm and feel groggy for a while', 'I need multiple alarms to actually get up', "I feel like I'm being dragged out of sleep every day"], disc: 0.71 },
    { q: 'How do weekends affect your sleep pattern compared to weekdays?', o: ['No real difference — same routine', 'I sleep in slightly, feel fine', 'I sleep in a lot, and it throws off Monday', 'I need weekends to "catch up" on sleep debt', 'I never feel caught up, no matter how much I sleep in'], disc: 0.66 },
  ],
  2: [
    { q: 'How often do you feel "wired but tired" — mentally alert but physically exhausted?', o: ['Rarely', 'Occasionally, usually after a stressful day', 'A few times a week', 'Most days', 'Almost every evening'], disc: 0.80 },
    { q: 'When something unexpected happens, how long does it take you to feel calm again?', o: ['A few minutes', 'Within the hour', 'Most of the day', 'It lingers into the next day', 'It stays with me for days'], disc: 0.76 },
    { q: 'Do you find yourself unable to switch off even during downtime?', o: ['No, I relax easily', 'Sometimes, but I can usually settle', 'Often — my mind keeps running', 'Most of the time, even when trying to rest', "Constantly — I don't remember what \"switched off\" feels like"], disc: 0.73 },
    { q: 'How does your body react physically when you\'re under pressure?', o: ['Barely any physical reaction', 'Mild — slightly faster heartbeat', 'Noticeable — tight chest or shoulders', 'Strong — racing heart, shallow breathing', 'Overwhelming — I feel it take over my whole body'], disc: 0.70 },
    { q: 'Do you feel like you\'re bracing for something to go wrong, even when things are fine?', o: ['No, I feel generally at ease', 'Rarely', 'Sometimes, without a clear reason', 'Often, even on calm days', 'Almost constantly'], disc: 0.72 },
    { q: 'How much do you rely on caffeine, sugar, or stimulation to get through the day?', o: ['Not really, my energy is steady', 'A little, mostly for enjoyment', 'I need it to function normally by midday', 'I need multiple hits throughout the day', "I can't get through the day without it"], disc: 0.65 },
  ],
  3: [
    { q: "After a normal night's sleep, how does your body respond to a carb-heavy meal?", o: ['Steady energy, no issue', 'Slight dip but recovers quickly', 'Noticeable crash 1–2 hours later', 'Major crash with brain fog', 'I feel unwell or shaky regardless of how I slept'], disc: 0.79 },
    { q: 'Do you get shaky, irritable, or foggy if you delay a meal?', o: ['No, I can go hours without noticing', 'A little hungry, nothing more', 'Noticeably irritable if I go too long', 'Shaky and foggy within a couple hours', 'I feel unwell very quickly if I delay eating'], disc: 0.77 },
    { q: 'How often do you experience an energy crash 2–3 hours after eating?', o: ['Rarely', 'Occasionally, after heavy meals', 'A few times a week', 'Most days', 'Every single day, regardless of what I eat'], disc: 0.75 },
    { q: "Have you noticed skin changes like dark patches or skin tags around your neck or underarms?", o: ['No', "A little, not something I've worried about", 'Yes, mild and gradually noticeable', 'Yes, fairly visible', "Yes, and it's been getting more pronounced"], disc: 0.69 },
    { q: 'How does your body respond to intense exercise?', o: ['Recovers quickly, feels good after', 'Slightly tired but fine by next day', 'Takes a day or two to fully recover', 'Wipes me out for several days', 'Leaves me feeling worse, not better'], disc: 0.64 },
    { q: 'Do you crave sugar or carbs specifically, more than feeling generally hungry?', o: ['Not really', 'Occasionally, especially when stressed', 'Regularly, especially in the afternoon', 'Strong cravings most days', 'Intense cravings that feel hard to control'], disc: 0.72 },
  ],
  4: [
    { q: 'How does your digestion respond to stress specifically?', o: ['No real connection that I notice', 'Mild — slight discomfort sometimes', 'Noticeable — stress clearly upsets my gut', 'Strong — stress reliably triggers issues', 'Severe — stress makes my gut symptoms much worse'], disc: 0.74 },
    { q: 'Have you taken antibiotics multiple times in the past 2 years?', o: ['No, not at all', 'Once', 'Twice', 'Three or more times', 'Frequently, for recurring issues'], disc: 0.60 },
    { q: 'Do you notice bloating that gets worse as the day goes on?', o: ['No noticeable bloating', 'Mild, occasional bloating', 'Regular bloating by evening', 'Significant bloating most days by afternoon', 'Severe bloating that affects how my clothes fit daily'], disc: 0.76 },
    { q: "How does your mood change around your digestive symptoms?", o: ["No connection I've noticed", 'Slightly irritable when uncomfortable', 'Noticeably low mood when symptoms flare', 'Mood clearly tracks with gut symptoms', 'My gut symptoms and mood feel completely linked'], disc: 0.68 },
    { q: "Do certain foods trigger noticeable discomfort, even ones that didn't used to?", o: ['No, my tolerance is stable', 'A few specific foods, nothing new', 'More foods bother me than they used to', 'Many previously fine foods now cause issues', 'My reactions feel unpredictable and are getting worse'], disc: 0.71 },
    { q: 'How regular is your digestion?', o: ['Very regular — same pattern daily', 'Mostly regular, occasional variation', 'Unpredictable a few times a week', 'Unpredictable most of the time', 'No consistent pattern at all'], disc: 0.66 },
  ],
  5: [
    { q: 'When you start a new health routine, how long before you typically lose consistency?', o: ['I usually stick with it long-term', 'A few months, then it fades', 'A few weeks, then I drop off', 'Under two weeks, most of the time', 'I struggle to get past the first few days'], disc: 0.77 },
    { q: "Do you feel like your body doesn't respond even when you're doing everything right?", o: ['No, effort generally pays off', 'Occasionally, but mostly things work', 'Fairly often — results feel disconnected from effort', 'Most of the time — I try hard, nothing changes', 'Constantly — it feels like my body is working against me'], disc: 0.80 },
    { q: 'How do you talk to yourself when you slip up on a health goal?', o: ["I'm understanding with myself", 'Mildly frustrated, then I move on', 'Fairly critical of myself', 'Quite harsh — I dwell on it', 'Very harsh — it derails me for days'], disc: 0.65 },
    { q: 'Do you find yourself giving up before you even see if something worked?', o: ['No, I usually give things a fair try', 'Occasionally, if it feels like too much effort', 'Sometimes, especially if I don\'t see quick results', 'Often — I expect it not to work', 'Almost always — I assume it won\'t work before I start'], disc: 0.73 },
    { q: 'How much does social pressure affect your health choices?', o: ['Not much, I stay on my own path', 'A little, in social settings', 'Fairly often — I go along with others', 'Quite a lot — it derails my plans regularly', 'Heavily — I rarely follow through around others'], disc: 0.62 },
    { q: 'Do you feel like effort and results are disconnected for you specifically?', o: ['No, they track reasonably well', 'Sometimes, but mostly make sense', 'Often — I put in real effort for little payoff', 'Most of the time', 'Almost always — it feels fundamentally broken'], disc: 0.75 },
  ],
}

// === CONDITIONS (gender-specific) ===
export const CONDITIONS_FEMALE = ['Type 2 Diabetes or Pre-diabetes', 'PCOS / PCOD / Hormonal Metabolic Syndrome', 'Thyroid condition', 'Hypertension', 'On GLP-1 medication (Ozempic / Mounjaro / Wegovy)', 'Anxiety or Depression', 'Sleep Disorder / Insomnia', 'No known condition', 'Prefer not to say']
export const CONDITIONS_MALE = ['Type 2 Diabetes or Pre-diabetes', 'Thyroid condition', 'Hypertension', 'On GLP-1 medication (Ozempic / Mounjaro / Wegovy)', 'Anxiety or Depression', 'Sleep Disorder / Insomnia', 'No known condition', 'Prefer not to say']

// === CYCLE OPTIONS (females only) ===
export const CYCLES_BY_AGE: Record<string, string[]> = {
  '18–25': ['Regular cycles (every 21–35 days)', 'Irregular cycles (unpredictable)', 'Painful periods (cramps, heavy flow)', 'On birth control / hormonal contraception', 'Amenorrhea (no periods for 3+ months)'],
  '26–35': ['Regular cycles (every 21–35 days)', 'Irregular cycles (unpredictable)', 'Painful periods (cramps, heavy flow)', 'On birth control / hormonal contraception', 'Amenorrhea (no periods for 3+ months)', 'Recently postpartum or breastfeeding'],
  '36–45': ['Regular cycles (every 21–35 days)', 'Irregular cycles (unpredictable)', 'Heavy or painful periods', 'On birth control / hormonal contraception', 'Perimenopause symptoms (hot flashes, mood changes)', 'Amenorrhea (no periods for 3+ months)'],
  '46–55': ['Still having regular cycles', 'Irregular cycles (perimenopause)', 'Hot flashes or night sweats', 'In menopause (no periods 12+ months)', 'On HRT (hormone replacement therapy)'],
  '55+': ['In menopause', 'On HRT (hormone replacement therapy)', 'Post-menopause (no HRT)', 'Prefer not to say'],
}

// === CASE STUDIES ===
export type CaseStudy = { id: number; tags: string[]; hook: string; story: string; result: string; layer: string; reel: string; gradient: string; photo: string; stats: { num: string; label: string }[] }

export const CASE_STUDIES: CaseStudy[] = [
  { id: 1, tags: ['Type 2 Diabetes'], hook: '"3.5 years on Metformin. HbA1c still at 11.8."', story: "Complete medication dependence with zero real metabolic improvement. The root cause wasn't the diabetes — it was muscle loss, poor sleep, and no meal optimisation quietly driving insulin resistance deeper every month. We introduced strength training 5x per week, restructured his meals, and implemented sleep protocols. HbA1c dropped from 11.8 to 6.9.", result: 'HbA1c 11.8 → 6.9 · 4–5 kg muscle gained · Medication on reduction path', layer: 'Primary layer: Metabolic Signaling (Layer 3)', reel: 'https://www.instagram.com/p/DRvEBhWk1BV/', gradient: 'linear-gradient(135deg, #FFB800, #FF6B6B)', photo: require('../assets/cases/case1.png'), stats: [{ num: '34', label: 'Age' }, { num: '8kg', label: 'Fat Lost' }, { num: '4–5kg', label: 'Muscle' }] },
  { id: 2, tags: ['Type 2 Diabetes', 'Stress & Cortisol', 'High Inflammation'], hook: '"Pre-diabetic. Fatty liver. Anxiety. Depression. All at once."', story: "This wasn't a weight problem. It was a multi-system collapse. A corporate professional running on stress, inflammation, and broken sleep. We focused on lowering inflammation, improving sleep quality, and making her body feel safe again. Within 10 weeks, she went from struggling to walk to walking 45 minutes pain-free.", result: '6 kg lost · Pain-free movement · Diabetes, cholesterol & inflammation improved', layer: 'Primary layer: Neurochemical Safety (Layer 2)', reel: 'https://www.instagram.com/p/DR9qoQ1j028/', gradient: 'linear-gradient(135deg, #FF6B6B, #D42B2B)', photo: require('../assets/cases/case2.png'), stats: [{ num: '42', label: 'Age' }, { num: '10wk', label: 'Duration' }, { num: '6kg', label: 'Lost' }] },
  { id: 3, tags: ['Perimenopause', 'GLP-1 Non-Responder', 'Stress & Cortisol'], hook: '"Training for 5–6 years. On GLP-1 for 8 weeks. Body refused to move."', story: "Years of pushing harder had locked her nervous system into permanent fight-or-flight mode. GLP-1 medication, intense training, calorie restriction — none of it worked because her body didn't feel safe enough to release fat. We stopped the exercise, increased sleep, added purposeful walks. What didn't happen in 5–6 years happened in 8 weeks.", result: 'Fat loss resumed in 8 weeks · Metabolic permission restored · GLP-1 now working', layer: 'Primary layer: Neurochemical Safety (Layer 2)', reel: 'https://www.instagram.com/p/DSPw4Wvj3oC/', gradient: 'linear-gradient(135deg, #7C5CFF, #4DA8FF)', photo: require('../assets/cases/case3.png'), stats: [{ num: '52', label: 'Age' }, { num: '6kg', label: 'Lost' }, { num: '2.5mo', label: 'Duration' }] },
  { id: 4, tags: ['Type 2 Diabetes', 'Stress & Cortisol', 'High Inflammation'], hook: '"Eating less. Taking medication. Still getting worse — for 6 years."', story: "A college professor working 12-hour days — brain fog, chronic fatigue, hypertension, and diabetes that kept worsening despite medication. Six years of doing what her doctors said. The problem wasn't compliance — it was that the root cause had never been identified. What didn't change in 6 years changed in 100 days.", result: 'HbA1c 10.8 → 5.5 · 9 kg lost · Brain fog cleared · Energy restored', layer: 'Primary layers: Circadian + Metabolic Signaling (Layers 1 + 3)', reel: 'https://www.instagram.com/reel/DSksIvFj0na/', gradient: 'linear-gradient(135deg, #4DA8FF, #00D9A3)', photo: require('../assets/cases/case4.png'), stats: [{ num: '100d', label: 'Duration' }, { num: '9kg', label: 'Lost' }, { num: '10.8→5.5', label: 'HbA1c' }] },
  { id: 5, tags: ['Type 2 Diabetes'], hook: '"Active. Walking more. Eating less. Still diabetic at 94 kg."', story: "Army background. Disciplined. Active. Doing everything a diabetic is told to do. Still getting worse. It wasn't a motivation problem. It was a regulation problem. We never focused on weight loss. We focused on rebuilding his system — strength training 5x per week, protected recovery, and sleep protocols. The fat loss was a byproduct.", result: 'HbA1c 8.2 → 6.1 · 12 kg lost · Medication reduced · Strength transformed', layer: 'Primary layer: Metabolic Signaling (Layer 3)', reel: 'https://www.instagram.com/reel/DTF0NphD8YJ/', gradient: 'linear-gradient(135deg, #FFB800, #D42B2B)', photo: require('../assets/cases/case5.png'), stats: [{ num: '4mo', label: 'Duration' }, { num: '12kg', label: 'Lost' }, { num: '8.2→6.1', label: 'HbA1c' }] },
  { id: 6, tags: ['Perimenopause', 'Stress & Cortisol', 'High Inflammation', 'Digestive Distress'], hook: '"The perfect routine for 6–7 years. Still getting worse."', story: "Up at 5am. 1.5 hours of running. Strength training. Doing this religiously for 6–7 years. And every marker was getting worse. Her body was in survival mode — more exercise was accelerating the breakdown. The problem wasn't discipline. It was recovery. Sleep improved from 4h 48m to 7h 22m. Blood pressure normalised. Gut health transformed.", result: 'Sleep 4h 48m → 7h 22m · Blood pressure normal · Gut health restored', layer: 'Primary layers: Circadian + Neurochemical + Gut-Brain (Layers 1 + 2 + 4)', reel: 'https://www.instagram.com/reel/DWZNbWNDw62/', gradient: 'linear-gradient(135deg, #7C5CFF, #FF6B6B)', photo: require('../assets/cases/case6.png'), stats: [{ num: '47', label: 'Age' }, { num: '4h48→7h22', label: 'Sleep' }, { num: '10+yr', label: 'Poor Sleep' }] },
  { id: 7, tags: ['Type 2 Diabetes', 'Insulin Resistance', 'GLP-1 Non-Responder', 'High Inflammation'], hook: '"A doctor who tried everything — including GLP-1. Nothing worked."', story: "She knew medicine better than most. She had tried every protocol. And she still couldn't fix herself. Exhausted through the day, wired at night, waking repeatedly, unable to focus at work — her entire system was struggling. The problem wasn't knowledge. It was that the root cause had never been properly identified. We focused on sleep architecture, nervous system regulation, gut health, and blood sugar stabilisation. In 6 weeks: blood sugar controlled, cravings gone, sleep uninterrupted, full focus restored.", result: '6 kg lost in 6 weeks · Blood sugar controlled · Gut symptoms resolved · Full energy back', layer: 'Primary layers: Neurochemical Safety + Gut–Brain Axis (Layers 2 + 4)', reel: 'https://www.instagram.com/reel/DXZpndxiApl/', gradient: 'linear-gradient(135deg, #FF6B6B, #7C5CFF)', photo: require('../assets/cases/case7.png'), stats: [{ num: '36', label: 'Age' }, { num: '6wk', label: 'Duration' }, { num: '6kg', label: 'Lost' }] },
  { id: 8, tags: ['Type 2 Diabetes', 'Stress & Cortisol'], hook: '"39 years old. Diabetic. Hypertensive. Then sleep apnea hit."', story: "Already managing diabetes and hypertension — then sleep apnea arrived and his entire system collapsed. Choking in his sleep. Zero recovery. His doctor prescribed a CPAP machine. We addressed the root cause instead. Poor recovery, gut dysfunction, chronic stress load — all three were compounding each other. Within 6 weeks: sleep apnea symptoms gone completely, HbA1c dropped from 7.4 to 6.1, and he was walking 8–10 km without difficulty.", result: 'HbA1c 7.4 → 6.1 · 10 kg lost · Sleep apnea gone · Walking 10 km daily', layer: 'Primary layers: Circadian + Neurochemical Safety (Layers 1 + 2)', reel: 'https://www.instagram.com/reel/DX0h2GpPUJQ/', gradient: 'linear-gradient(135deg, #4DA8FF, #D42B2B)', photo: require('../assets/cases/case8.png'), stats: [{ num: '39', label: 'Age' }, { num: '6wk', label: 'Duration' }, { num: '10kg', label: 'Lost' }] },
]

// Case study → layer mapping (for matching)
export const CASE_LAYER_MAP: Record<number, number[]> = {
  1: [3], 2: [2], 3: [2], 4: [1, 3], 5: [3], 6: [1, 2, 4], 7: [2, 4], 8: [1, 2],
}

// === SCREENS ===
export const SCREENS = [
  { id: 'splash', name: 'Splash', group: 'Auth' },
  { id: 'login', name: 'Login', group: 'Auth' },
  { id: 'onboarding', name: 'Onboarding', group: 'Auth' },
  { id: 'home', name: 'Home', group: 'Main' },
  { id: 'score', name: 'Score Tool', group: 'Main' },
  { id: 'results', name: 'Results', group: 'Main' },
  { id: 'layers', name: '5 Layers', group: 'Main' },
  { id: 'layer-detail', name: 'Layer Detail', group: 'Main' },
  { id: 'library', name: 'Library', group: 'Main' },
  { id: 'cases', name: 'Case Studies', group: 'Proof' },
  { id: 'transformations', name: 'Transformations', group: 'Proof' },
  { id: 'cravings', name: 'Cravings Log', group: 'Proof' },
  { id: 'weekly-cravings', name: 'Weekly Summary', group: 'Proof' },
  { id: 'profile', name: 'Profile', group: 'Main' },
  { id: 'customize', name: 'Customize Home', group: 'Proof' },
  { id: 'booking', name: 'Booking', group: 'Main' },
  { id: 'report', name: 'Report Preview', group: 'Proof' },
] as const

export type ScreenId = typeof SCREENS[number]['id']

// === DAILY ACTIONS (for Home Today's 1%) ===
export const DAILY_ACTIONS: Record<number, { title: string; desc: string; time: string }[]> = {
  1: [
    { title: 'Morning sunlight', desc: '10 min direct sunlight within 30 min of waking. Anchors circadian rhythm.', time: '10 min' },
    { title: 'Screen curfew', desc: 'No screens 60 min before bed tonight. Read a book instead.', time: '60 min' },
    { title: 'Consistent wake time', desc: 'Wake at the same time tomorrow — even on weekends. Consistency > duration.', time: 'Tomorrow' },
    { title: 'Magnesium glycinate', desc: '200-400mg 30 min before bed. Deepens sleep architecture.', time: '30 sec' },
  ],
  2: [
    { title: 'Box breathing', desc: 'Inhale 4, hold 4, exhale 4, hold 4. 5 rounds = instant calm.', time: '5 min' },
    { title: 'Cold exposure', desc: 'End your shower with 30-60 sec of cold. Trains vagal tone.', time: '1 min' },
    { title: 'Nature walk', desc: '20 min in green space. Lowers cortisol more than meditation apps.', time: '20 min' },
    { title: '3-line journal', desc: '1 thing grateful for, 1 thing worried about, 1 win from today.', time: '3 min' },
  ],
  3: [
    { title: 'Post-meal walk', desc: '10-20 min walk after your largest meal today. May help reduce glucose spikes by up to 30%.', time: '10 min' },
    { title: 'Protein first', desc: '30g protein within 60 min of waking. Eggs, Greek yogurt, or whey.', time: '5 min' },
    { title: 'Strength training', desc: '30-45 min compound lifts: squats, deadlifts, presses, rows.', time: '45 min' },
    { title: 'No snacking', desc: '3 meals today. Nothing between. Let insulin baseline between meals.', time: 'All day' },
  ],
  4: [
    { title: '30 plants challenge', desc: 'Count different plant foods today. Aim for 30+ this week.', time: 'All day' },
    { title: 'Fermented food', desc: '1 serving: yogurt, kefir, kimchi, sauerkraut, or kombucha.', time: '1 min' },
    { title: 'Chew thoroughly', desc: '20-30 chews per bite. Digestion starts in the mouth.', time: 'All meals' },
    { title: 'Prebiotic fibre', desc: 'Add onions, garlic, leeks, or asparagus to one meal today.', time: '1 meal' },
  ],
  5: [
    { title: 'Identity statement', desc: 'Write: "I am becoming someone who [specific trait]." Read it aloud.', time: '2 min' },
    { title: 'Say no once', desc: 'Decline 1 thing today that doesn\'t serve your future self.', time: '1 min' },
    { title: 'Future self letter', desc: 'Write 3 lines from your 1-year-ahead self to today you.', time: '5 min' },
    { title: 'Values check', desc: 'Tonight: did today align with your core values? Note 1 thing.', time: '3 min' },
  ],
}

export const STREAK = { days: 7, completedToday: false, totalCompleted: 23 }
export const NEXT_ASSESSMENT_DAYS = 11

// === INSIGHTS (Articles for Home + Library) ===
export type ArticleBlock = { type: 'p' | 'callout'; text: string }
export type Insight = { id: number; type: 'ARTICLE' | 'VIDEO'; title: string; category: string; readTime: string; layer: number | null; gradient: string; body?: ArticleBlock[] }

export const INSIGHTS: Insight[] = [
  { id: 1, type: 'VIDEO', title: "Why GLP-1 Alone Won't Fix Your Metabolism", category: 'Metabolic Signaling', readTime: '8 min', layer: 3, gradient: 'linear-gradient(135deg, #FFB800, #FF6B6B)' },
  { id: 2, type: 'VIDEO', title: 'The post-meal walk: may lower glucose for free', category: 'Movement', readTime: '4 min', layer: 3, gradient: 'linear-gradient(135deg, #00D9A3, #4DA8FF)' },

  // ── L1 · Circadian Authority ──
  { id: 10, type: 'ARTICLE', title: 'The 4 stages of sleep — and why you need all of them', category: 'Circadian Authority', readTime: '6 min', layer: 1, gradient: 'linear-gradient(135deg, #7C5CFF, #4DA8FF)', body: [
    { type: 'p', text: "Sleep isn't one thing — it's four distinct stages your body cycles through several times a night, and each one does a different job." },
    { type: 'p', text: "Light sleep is the on-ramp, where body temperature drops and heart rate starts to slow. Deep sleep follows — this is where the physical repair happens: growth hormone release, tissue repair, and the metabolic housekeeping that keeps insulin sensitivity intact." },
    { type: 'callout', text: "Miss enough deep sleep and your body may struggle to regulate blood sugar the next day, even if the total hours look fine on a tracker." },
    { type: 'p', text: "Then REM sleep, where the brain consolidates memory and processes emotional load from the day. Miss enough REM and stress resilience may take the hit — small frustrations start to feel bigger than they are." },
    { type: 'p', text: "Here's the part most people miss: these stages aren't evenly spread across the night. Deep sleep concentrates in the first half, REM in the second half." },
    { type: 'callout', text: 'A night cut short at 5am may cost you disproportionately more REM than one cut short at the start — the timing of the loss matters as much as the total hours.' },
    { type: 'p', text: "This is also why a consistent sleep-wake window may matter more than chasing eight hours on paper. If bedtime swings by two or three hours across the week, the body may spend the first part of some nights just recalibrating instead of moving efficiently through the stages it needs." },
    { type: 'p', text: 'The practical takeaway: protect the window, not just the hours. A consistent wake time — even on weekends — anchors the whole cycle in place.' },
  ] },
  { id: 11, type: 'ARTICLE', title: 'How one bad night destroys your glucose tolerance', category: 'Circadian Authority', readTime: '4 min', layer: 1, gradient: 'linear-gradient(135deg, #4DA8FF, #7C5CFF)', body: [
    { type: 'p', text: "A single night of short or fragmented sleep may do more to blood sugar regulation than most people realize — and the effect can show up the very next day, not weeks later." },
    { type: 'callout', text: 'Even one night of poor sleep may reduce insulin sensitivity enough to measurably shift how the body handles the next meal — a real, same-day metabolic cost, not a vague feeling of tiredness.' },
    { type: 'p', text: "The mechanism may run through the stress-response system: short sleep can elevate cortisol and push the nervous system toward a mild alert state, and elevated cortisol is closely tied to reduced insulin sensitivity. The body may respond to sleep loss as a low-grade stressor, and glucose handling is one of the first systems to reflect that." },
    { type: 'p', text: "This is part of why a single late night before an important day — a big meal, a stressful event, a workout — can feel like it throws everything off, even when nothing else changed. It's not imagination. The system may genuinely be running on a different setting than it was the day before." },
    { type: 'callout', text: "This is also why isolated bad nights matter less than a pattern of them. One rough night is a blip the body can usually recover from. A recurring pattern of short sleep may compound, each night adding to a cumulative load the system doesn't fully clear." },
    { type: 'p', text: "The practical implication isn't to panic over one bad night — it's to notice if bad nights are becoming the pattern rather than the exception, since that's when the metabolic cost may stop being temporary." },
  ] },
  { id: 12, type: 'ARTICLE', title: 'The circadian code: timing matters more than duration', category: 'Circadian Authority', readTime: '8 min', layer: 1, gradient: 'linear-gradient(135deg, #7C5CFF, #00D9A3)', body: [
    { type: 'p', text: "Most sleep advice focuses on a single number: how many hours. Timing — how consistent sleep is relative to a stable daily rhythm — may matter just as much, sometimes more." },
    { type: 'p', text: "Every organ has its own cellular circadian clock, distinct from the brain's master clock. A landmark study fed nocturnal mice during their inactive daytime phase, and the liver clock abandoned its light-driven rhythm entirely, following food timing instead — proof that organs can be pulled out of sync with the brain's clock by eating pattern alone." },
    { type: 'callout', text: 'In a mouse study, calorie-restricted food spread across day and night produced 10% longer life versus unrestricted eating. The identical restriction fed only during the daytime (inactive) phase produced no additional benefit at all. Fed only at night (active phase), the same restriction produced 35% longer life. Same calories, same restriction — the only variable was timing.' },
    { type: 'p', text: "This may explain why shift workers and frequent late-eaters can struggle with metabolic markers even when calorie intake looks reasonable on paper. Digestive organs prepare for food in advance of a habitual mealtime — shifting a meal by two or more hours means digestion isn't ready when food actually arrives that day, and may take roughly a full day to recalibrate." },
    { type: 'callout', text: "A separate human trial found simple 12-hour eating-window advice, with no food-quality guidance at all, produced the same weight loss as standard nutrition advice to reduce processed food — timing alone matched a full dietary intervention." },
    { type: 'p', text: "The most practical lever most people can pull isn't a stricter bedtime — it's a genuinely consistent wake time, seven days a week. Wake time anchors the whole rhythm more reliably than bedtime does." },
  ] },

  // ── L2 · Neurochemical Safety ──
  { id: 13, type: 'ARTICLE', title: "Cortisol: the master hormone you're burning out", category: 'Neurochemical Safety', readTime: '7 min', layer: 2, gradient: 'linear-gradient(135deg, #FF6B6B, #D42B2B)', body: [
    { type: 'p', text: "Cortisol gets treated like a villain, but it isn't one — it's the hormone that gets you out of bed and mobilizes energy under pressure. The problem isn't cortisol existing. It's cortisol never turning off." },
    { type: 'callout', text: 'Cushing\'s disease — a condition of chronically excess cortisol — produces abdominal weight gain in 97% of cases and overall weight gain in 94%, regardless of diet or exercise. Addison\'s disease, the reverse condition (cortisol deficiency), produces weight loss in up to 97% of cases. This is about as clean a natural experiment as exists in endocrinology.' },
    { type: 'p', text: "It's also reversible in a measurable, quantified way: weaning transplant patients off long-term prednisone (synthetic cortisol) produced a 25% drop in insulin, translating to 6% weight loss and 7.7% waist reduction — from lowering cortisol alone, nothing else changed." },
    { type: 'p', text: "The mechanism runs specifically through insulin, not around it. Healthy volunteers given high-dose cortisol showed a 36% insulin increase above baseline. This is why chronic stress and elevated cortisol don't just affect mood — they push the body toward the exact hormonal state that drives fat storage, particularly around the midsection." },
    { type: 'callout', text: 'This is a key reason "eating less and moving more" sometimes doesn\'t move the needle for someone under chronic stress — cortisol is independently raising insulin, and insulin is the more fundamental lever. Addressing the stress load isn\'t a soft add-on to a diet plan; it may be targeting the actual mechanism.' },
    { type: 'p', text: "The goal isn't eliminating stress — that's not realistic. It's giving the nervous system enough repeated evidence that the threat has passed, so cortisol can do its job in the morning and step aside at night, rather than staying elevated around the clock." },
  ] },
  { id: 14, type: 'ARTICLE', title: 'Why belly fat is a stress symptom, not a diet problem', category: 'Neurochemical Safety', readTime: '5 min', layer: 2, gradient: 'linear-gradient(135deg, #D42B2B, #7C5CFF)', body: [
    { type: 'p', text: "Central fat — the kind that accumulates around the midsection specifically — often gets treated as a diet or discipline problem. The endocrinology says otherwise for a meaningful subset of people." },
    { type: 'callout', text: 'Cortisol works specifically by raising insulin: a controlled study found self-perceived stress correlated with cortisol, which correlated with both glucose and insulin increases, which correlated with increased BMI and abdominal obesity specifically — a documented chain, not a loose association.' },
    { type: 'p', text: "This is a key reason two people can eat near-identical diets and see completely different results in the midsection specifically — one may be dealing with a stress-signaling problem the diet itself can't reach, because the mechanism driving fat storage there isn't caloric, it's hormonal." },
    { type: 'p', text: "It also explains a pattern many find confusing: doing everything right — clean eating, regular exercise — and still not seeing the midsection change, sometimes even after fat loss shows up elsewhere first. The stress-insulin pathway doesn't respond to further dietary restriction, because restriction itself can add to the stress load." },
    { type: 'callout', text: "Central fat may function almost as a stress gauge — a visible signal of an invisible internal load. The more useful question usually isn't what am I still eating wrong, it's what has my stress load actually looked like these past few months." },
  ] },
  { id: 15, type: 'ARTICLE', title: 'The vagus nerve: your secret stress weapon', category: 'Neurochemical Safety', readTime: '6 min', layer: 2, gradient: 'linear-gradient(135deg, #FF6B6B, #7C5CFF)', body: [
    { type: 'p', text: "The vagus nerve runs from the brainstem down through the neck, chest, and abdomen — the main pathway of the parasympathetic \"rest and digest\" system. A well-toned vagal response may mean recovering from a stressful moment in minutes; a poorly toned one may mean staying activated for hours after the trigger has passed." },
    { type: 'callout', text: 'Gut bacteria — specific lactobacillus and bifidobacterium strains — synthesize GABA, which reaches the brain via the vagus nerve and dampens the emotional brain, the same target as anti-anxiety medication. This was confirmed causally: mice with a severed vagus nerve lost the anxiety-reducing effect of microbiome changes entirely, proving the vagus itself is the necessary pathway, not just the bloodstream.' },
    { type: 'p', text: "This isn't only an animal finding — liver cirrhosis patients show impaired cognition tied to elevated brain GABA of gut-microbial origin, reversible with treatment, which is real human clinical corroboration of the same gut-to-brain, vagus-mediated pathway." },
    { type: 'p', text: "Slow, extended exhales specifically may activate the vagus nerve more than the inhale does — part of why breathing techniques with a longer exhale than inhale tend to calm the body faster than deep-inhale-focused breathing." },
    { type: 'callout', text: "None of this replaces addressing the actual source of chronic stress. But a body with better vagal tone, and a gut microbiome capable of producing these calming signals, may recover faster from the stress that's unavoidable — a real, trainable lever." },
  ] },

  // ── L3 · Metabolic Signaling ──
  { id: 16, type: 'ARTICLE', title: 'Why muscle is your metabolic insurance policy', category: 'Metabolic Signaling', readTime: '6 min', layer: 3, gradient: 'linear-gradient(135deg, #FFB800, #FF6B6B)', body: [
    { type: 'p', text: "Muscle tissue often gets framed purely as an aesthetic goal. A 10-year study of roughly 4,500 people aged 50+ found otherwise: low muscle strength specifically doubled mortality risk, and low muscle mass carried 40-50% greater mortality risk." },
    { type: 'callout', text: 'Strength may outweigh cardiorespiratory fitness itself: men in the bottom half of fitness but top third of strength had 48% lower mortality than bottom-third-strength peers. Muscle isn\'t a side effect of health — in this data, it\'s one of the more direct predictors of it.' },
    { type: 'p', text: "The metabolic mechanism is specific: during exercise, glucose uptake into muscle can increase up to 100-fold versus rest, through two separate pathways — the familiar insulin-signaled route, and a second, fully insulin-independent pathway where glucose transporters reach the cell surface without insulin involvement at all." },
    { type: 'callout', text: 'This second pathway genuinely bypasses insulin resistance. One illustrative case: a Type 1 diabetic with zero endogenous insulin manages glucose almost entirely via daily 6-10 mile walks, needing only a fraction of otherwise-required insulin — direct evidence that muscle contraction itself, not insulin, can move glucose out of the bloodstream.' },
    { type: 'p', text: "This reframes strength training as more than a body-composition tool. Muscle may function as a metabolic buffer, built during periods of consistency and drawn on during periods when diet, stress, or sleep aren't perfect — genuine insurance against an imperfect week, not just a look." },
  ] },
  { id: 17, type: 'ARTICLE', title: 'The post-meal walk: may lower glucose for free', category: 'Metabolic Signaling', readTime: '4 min', layer: 3, gradient: 'linear-gradient(135deg, #00D9A3, #4DA8FF)', body: [
    { type: 'p', text: "A short walk after eating is one of the simplest, most evidence-backed interventions for blood sugar regulation — and the mechanism is more specific than \"exercise is good for you.\"" },
    { type: 'callout', text: 'During movement, glucose uptake into muscle can increase up to 100-fold versus rest, through a pathway called non-insulin-mediated glucose uptake (NIMGU) — glucose transporters reach the cell surface and pull glucose in without insulin involvement at all. This is a genuine bypass route around insulin resistance, not just a calorie-burn effect.' },
    { type: 'p', text: "This is why light movement — even light contraction from walking, not intense exercise — after a meal may pull glucose out of the bloodstream through a route that doesn't lean on insulin sensitivity at all. For anyone whose system is already working harder than it should to manage blood sugar, that second route matters." },
    { type: 'p', text: "The timing matters more than the intensity. A short walk starting within the first half hour after a meal may blunt the glucose spike far more effectively than the same walk taken two hours later, once the spike has already peaked." },
    { type: 'callout', text: "It also doesn't need to be a formal walk. Pacing during a call, walking to get water, taking the stairs — light movement in that post-meal window may be doing more metabolic work than most people assume, through a mechanism that has nothing to do with calories burned." },
  ] },
  { id: 18, type: 'ARTICLE', title: 'Zone 2 cardio: the most underrated health practice', category: 'Metabolic Signaling', readTime: '7 min', layer: 3, gradient: 'linear-gradient(135deg, #FFB800, #00D9A3)', body: [
    { type: 'p', text: "Zone 2 refers to a specific, moderate exercise intensity — roughly the pace where holding a conversation takes some effort but is still possible. It's slower than most people's instinct for a real workout, which is exactly why it's underrated." },
    { type: 'callout', text: 'A study comparing professional cyclists against sedentary metabolic-syndrome subjects at matched relative intensity found cyclists produced roughly 4x more power while burning primarily fat. The metabolic-syndrome subjects relied almost entirely on glucose from the first pedal stroke — genuinely \"metabolically inflexible,\" unable to access fat as fuel even at low intensity.' },
    { type: 'p', text: "Regular Zone 2 training stimulates mitochondrial biogenesis — literally building more of the cell's energy-producing structures — and this is a reversible process, not fixed decline. It's a specific, trainable lever most people never target directly." },
    { type: 'p', text: "The physiological definition is precise, not vague: Zone 2 is the maximum effort sustainable without lactate accumulating faster than it clears, roughly 1.7-2.0 millimoles. More efficient mitochondria clear lactate faster, which is part of why trained athletes can sustain a harder pace and still be \"in Zone 2.\"" },
    { type: 'callout', text: "A rough, practical marker: if a light conversation isn't possible, the effort is probably past Zone 2. The most underrated part may be volume tolerance — because it's low-fatigue, more of it fits into a week than higher-intensity alternatives, and consistency is usually where the real benefit accumulates." },
  ] },

  // ── L4 · Gut–Brain Axis ──
  { id: 19, type: 'ARTICLE', title: 'The gut-brain axis: why your microbes control your mood', category: 'Gut–Brain Axis', readTime: '6 min', layer: 4, gradient: 'linear-gradient(135deg, #00D9A3, #7C5CFF)', body: [
    { type: 'p', text: "The gut and brain are in constant, two-way communication — not metaphorically, but through an actual physical pathway called the vagus nerve, alongside a steady stream of chemical signals gut microbes help produce." },
    { type: 'callout', text: 'A significant share of the body\'s serotonin — closely tied to mood regulation — is produced in the gut, not the brain, which reframes a lot of what gets written off as "just anxiety" as something that may have a real digestive-health component underneath.' },
    { type: 'p', text: "This is why gut symptoms and mood symptoms so often travel together. Bloating, irregularity, or general digestive discomfort alongside low mood or irritability isn't a coincidence for a lot of people — it may be the same underlying system showing up in two different places at once." },
    { type: 'p', text: "The relationship runs both directions: chronic stress may alter gut motility and microbial balance, and a disrupted gut may in turn affect mood and stress resilience — creating a loop that's hard to interrupt from either side alone." },
    { type: 'callout', text: "This is part of why a purely dietary approach to gut health sometimes underperforms, and a purely mood-focused approach to anxiety sometimes underperforms too — each may be missing half of a system that only responds when addressed as one system." },
    { type: 'p', text: "Diversity of plant foods, fermented foods, and consistent meal timing may support a healthier gut microbial environment, which in turn may support steadier mood regulation over time — a frequently overlooked lever worth taking seriously." },
  ] },
  { id: 20, type: 'ARTICLE', title: '30 plants a week: the diversity rule that changes everything', category: 'Gut–Brain Axis', readTime: '5 min', layer: 4, gradient: 'linear-gradient(135deg, #00D9A3, #4DA8FF)', body: [
    { type: 'p', text: "Gut health advice usually focuses on eliminating things — cutting sugar, cutting gluten, cutting dairy. A different, additive approach may matter just as much: plant diversity." },
    { type: 'callout', text: 'Different plant foods feed different strains of gut bacteria, and a wider variety of plants across a week may support a wider, more resilient microbial community than the same handful of vegetables on repeat — regardless of how "clean" that repeated diet looks on paper.' },
    { type: 'p', text: "Thirty different plants in a week sounds like a lot, but it counts more broadly than most assume — vegetables, fruits, whole grains, legumes, nuts, seeds, even herbs and spices each count as a distinct plant. A single meal with mixed greens, a scattering of seeds, and a couple of vegetables may rack up five or six varieties." },
    { type: 'p', text: "This is a meaningfully different mental model from most dietary advice, which tends to be restrictive by default. Diversity is additive — the goal isn't eating less of anything, it's introducing more variety into what's already on the plate." },
    { type: 'callout', text: "A gut microbiome fed a narrow range of inputs may become a narrow, less adaptable system — more easily thrown off by a disruptive meal, a course of antibiotics, or a stressful week. A more diverse baseline may be more resilient to exactly those disruptions." },
    { type: 'p', text: "Rather than tracking what to avoid this week, the more useful question may be: how many different plants actually made it onto the plate." },
  ] },
  { id: 21, type: 'ARTICLE', title: "SIBO, bloating & why fibre isn't always the answer", category: 'Gut–Brain Axis', readTime: '9 min', layer: 4, gradient: 'linear-gradient(135deg, #7C5CFF, #00D9A3)', body: [
    { type: 'p', text: "The default advice for bloating is almost always 'eat more fibre.' For a genuine subset of people, that advice may make things worse, not better — and understanding why starts with a condition called SIBO: small intestinal bacterial overgrowth." },
    { type: 'p', text: "Normally, most gut bacteria live in the large intestine. In SIBO, bacteria that belong further down the digestive tract may migrate into the small intestine, where they encounter undigested food much earlier in the process — including the fibre that's usually recommended for gut health." },
    { type: 'callout', text: 'For someone with SIBO, more fibre may mean more fermentable material for bacteria already in the wrong place — which can mean more gas, more bloating, and more discomfort, not less. The standard advice may be backwards for this specific pattern.' },
    { type: 'p', text: "This is why 'I eat healthy and still bloat constantly' is a genuinely common and confusing experience — the person may be doing exactly what general gut-health advice recommends, while that advice is working against the specific mechanism actually driving their symptoms." },
    { type: 'p', text: "This isn't a reason to avoid fibre broadly — for most people without SIBO, fibre remains genuinely supportive of gut health. It's a reason chronic, unexplained bloating that doesn't respond to typical dietary cleanup may warrant looking at the mechanism rather than escalating the same approach." },
    { type: 'callout', text: "The practical signal worth paying attention to: bloating that gets worse with more fibre and fermented foods, rather than better, may be pointing at a different mechanism than a simple lack of gut-healthy habits." },
  ] },

  // ── L5 · Identity Physiology ──
  { id: 22, type: 'ARTICLE', title: 'Identity-based habits: why "who" beats "what"', category: 'Identity Physiology', readTime: '5 min', layer: 5, gradient: 'linear-gradient(135deg, #4DA8FF, #FFB800)', body: [
    { type: 'p', text: "Picture a familiar week: up early to get the kids ready, a commute, a full workday, a late meeting some nights, home late, a little time with the kids before bed, and not much left after that. Sleep gets cut short — not by choice, just by what the day demanded." },
    { type: 'callout', text: 'A controlled MRI study found that sleep deprivation causes over 60% amplification in the amygdala\'s reaction to negative triggers. The cause: the normal coupling between the prefrontal cortex — the brain\'s rational, regulatory control center — and the amygdala breaks down. In the researcher\'s own words: too much emotional gas pedal, not enough regulatory brake.' },
    { type: 'p', text: "This is the missing piece in a story a lot of people tell themselves. Running on broken sleep, the day gets fueled by coffee and something sweet — not from weak willpower, but from a brain working with a measurably weaker brake on impulse and craving. The coffee and the sugar aren't the failure. They're a predictable response from a system under a specific, identifiable load." },
    { type: 'p', text: "This is where the identity story usually gets written wrong. A gym membership that didn't stick, a personal trainer who pushed too hard to want to go back — each one becomes evidence in a growing case file: I'm lazy, I have no discipline, I always quit. But someone running a nervous system with a weakened prefrontal brake isn't lacking willpower. They're not being given a fair fight." },
    { type: 'callout', text: 'What often gets missed is who someone believes they are, and that belief may be doing more work than the specific action itself. Someone who thinks of themselves as "someone trying to lose weight" is running a different internal script than someone who thinks of themselves as "someone who trains" — the first is tied to an outcome that hasn\'t happened yet, the second to an identity true the moment the action happens.' },
    { type: 'p', text: "The more useful starting point usually isn't another plan. It's addressing the sleep debt driving the weakened brake in the first place — so the next attempt at building a habit is a fair fight, not a rematch against the same stacked deck." },
  ] },
  { id: 23, type: 'ARTICLE', title: 'The self-fulfilling prophecy of body identity', category: 'Identity Physiology', readTime: '5 min', layer: 5, gradient: 'linear-gradient(135deg, #FFB800, #4DA8FF)', body: [
    { type: 'p', text: "What you repeat often enough becomes a habit. What you repeat as a habit long enough becomes part of how you see yourself. That's the order it usually happens in — and it means the identity someone holds about their body often started as something much more circumstantial than it feels in hindsight." },
    { type: 'p', text: "Take the pattern many people don't even notice they're in: a stretch of poor sleep — a new job, a new baby, a demanding season — leads to stronger coffee just to function, and a reach for something sweet mid-afternoon or after dinner just to keep going. At first, it's a response to a specific week. There's no story attached to it yet." },
    { type: 'callout', text: 'Poor sleep has been shown to increase next-day cravings, raise insulin by up to 40%, and raise cortisol by up to 100% — real, measurable, same-day physiological shifts, not imagined ones. The craving isn\'t random and it isn\'t a character flaw. It\'s a predictable output of a specific hormonal state.' },
    { type: 'p', text: "But if that week becomes a season, and the season becomes a pattern, the coffee and the sugar stop being a response to circumstances and start being read as evidence about identity: I have no self-control. I'm just someone who can't stick to anything. The physiology quietly disappears from the story, and only the behavior — and the self-judgment about it — remains." },
    { type: 'callout', text: 'A belief repeated often enough may shape which choices even register as available in the moment. Someone who has decided they\'re "not a disciplined person" may not consciously notice the small decision points where something different was actually possible — the identity narrows the field of view before a choice is ever made.' },
    { type: 'p', text: "This is why naming the original trigger matters, even years later. The identity someone holds isn't fixed — it was built the same way any habit is: through repetition. Which means it can be rebuilt the same way too, starting from the physiological root rather than another attempt to white-knuckle through the symptom." },
  ] },
  { id: 24, type: 'ARTICLE', title: "Why your body isn't working against you (even when it feels like it)", category: 'Identity Physiology', readTime: '6 min', layer: 5, gradient: 'linear-gradient(135deg, #4DA8FF, #FFB800)', body: [
    { type: 'p', text: "It's a common feeling, especially after a plateau or setback: my body is working against me. It's worth examining that belief directly, because it may be quietly shaping behavior in ways that make things harder, not easier." },
    { type: 'callout', text: "Every mechanism this app tracks — cortisol elevation, disrupted sleep architecture, gut-brain signaling, insulin resistance — is a protective response, not a malfunction. A body holding onto fat under chronic stress isn't broken; it may be responding exactly as a stress-response system is built to respond." },
    { type: 'p', text: "The sleep-deprived brain reaching for sugar isn't a willpower failure either — it's a prefrontal cortex temporarily running with a weaker regulatory brake, a documented, measurable effect, not a character trait. None of these mechanisms are the body working against someone. They're the body doing its job under the specific conditions it's been given." },
    { type: 'p', text: "That reframe matters practically, not just philosophically. Believing the body is an adversary may lead to adversarial strategies — more restriction, more punishment, more overriding of signals — which often triggers more of the same protective response, not less." },
    { type: 'callout', text: "Believing the body is a system responding logically to its inputs may lead somewhere more productive: identifying which specific input is driving the protective response — sleep, stress, an unaddressed physiological load — and changing that input directly, rather than fighting the response itself." },
    { type: 'p', text: "A craving, a plateau, a stubborn area of fat retention, even the identity story someone has told themselves for years — each may be information about what the system currently believes it needs, not evidence of a body sabotaging its owner. The path forward usually isn't more force. It's giving the body different, more consistent information to respond to." },
  ] },
]

// Draft note: all 15 article bodies above are Claude-drafted for structure and clinical-language compliance (may-language throughout, no unsourced stats). Please review and edit for voice-match and fact-check before these go live — they are not pulled from the loop registry, since those source PDFs weren't available this session.

// === TRANSFORMATIONS ===
export type Transformation = { id: number; tags: string[]; stats: { num: string; label: string }[]; result: string; photo: any; featured?: boolean }

export const TRANSFORMATIONS: Transformation[] = [
  { id: 12, tags: ['Type 2 Diabetes'], stats: [{ num: '34', label: 'Age' }, { num: '8kg', label: 'Fat Lost' }, { num: '4–5kg', label: 'Muscle' }], result: 'HbA1c 11.8 → 6.9 · Medication on reduction path · 3.5 years on Metformin with no real improvement — fixed from the root', photo: require('../assets/transformations/ba12.png'), featured: true },
  { id: 13, tags: ['Type 2 Diabetes', 'Stress & Cortisol'], stats: [{ num: '44', label: 'Age' }, { num: '9kg', label: 'Fat Lost' }, { num: '100d', label: 'Duration' }], result: 'HbA1c 10.8 → 5.5 · Brain fog cleared · Energy restored · Eating less and medicating for 6 years — getting worse every year', photo: require('../assets/transformations/ba13.png'), featured: true },
  { id: 4, tags: ['Menopause', 'Sleep Apnea'], stats: [{ num: '53', label: 'Age' }, { num: '24kg', label: 'Fat Lost' }, { num: '8mo', label: 'Duration' }], result: 'CPAP machine removed · Sleep apnea gone completely · No brain fog · No afternoon crash · 500 → 3,000 steps at a stretch', photo: require('../assets/transformations/ba4.png'), featured: true },
  { id: 3, tags: ['Insulin Resistance', 'Postpartum'], stats: [{ num: '35', label: 'Age' }, { num: '6kg', label: 'Fat Lost' }, { num: '6mo', label: 'Duration' }], result: '15 min → 60 min strength training 4x/week · Full physical strength & endurance restored', photo: require('../assets/transformations/ba3.png'), featured: true },
  { id: 16, tags: ['Type 2 Diabetes', 'Insulin Resistance', 'GLP-1 Non-Responder'], stats: [{ num: '36', label: 'Age' }, { num: '6kg', label: 'Fat Lost' }, { num: '6wk', label: 'Duration' }], result: 'Blood sugar controlled · Sleep uninterrupted · Metabolic permission restored · A doctor who tried everything including GLP-1 — nothing worked until the root was fixed', photo: require('../assets/transformations/ba16.png'), featured: true },
  { id: 14, tags: ['Type 2 Diabetes'], stats: [{ num: '32', label: 'Age' }, { num: '12kg', label: 'Fat Lost' }, { num: '4mo', label: 'Duration' }], result: 'HbA1c 8.2 → 6.1 · Medication reduced · Strength transformed · Active, walking more, eating less — still diabetic at 94kg. Not a motivation problem', photo: require('../assets/transformations/ba14.png'), featured: true },
  { id: 5, tags: ['Insulin Resistance', 'High Inflammation'], stats: [{ num: '35', label: 'Age' }, { num: '34kg', label: 'Fat Lost' }, { num: '10mo', label: 'Duration' }], result: 'Energy, sleep & gut health all improved · 10,000 steps daily now effortless', photo: require('../assets/transformations/ba5.png') },
  { id: 15, tags: ['Type 2 Diabetes', 'Stress & Cortisol'], stats: [{ num: '39', label: 'Age' }, { num: '10kg', label: 'Fat Lost' }, { num: '6wk', label: 'Duration' }], result: 'HbA1c 7.4 → 6.1 · Sleep apnea gone · Walking 10km daily · Diabetic, hypertensive, then sleep apnea hit — all three resolved', photo: require('../assets/transformations/ba15.png') },
  { id: 1, tags: ['Insulin Resistance'], stats: [{ num: '47', label: 'Age' }, { num: '9kg', label: 'Fat Lost' }, { num: '3mo', label: 'Duration' }], result: 'Biological age reversed 4.3 years · Energy improved · Brain fog gone · Sleep restored', photo: require('../assets/transformations/ba1.png') },
  { id: 2, tags: ['Menopause'], stats: [{ num: '51', label: 'Age' }, { num: '6.8kg', label: 'Fat Lost' }, { num: '2.5mo', label: 'Duration' }], result: 'Sleep improved · Energy stabilised · 1.1kg muscle gained · Bio age reversed 2.4 years', photo: require('../assets/transformations/ba2.png') },
  { id: 6, tags: ['High Inflammation', 'Insulin Resistance'], stats: [{ num: '33', label: 'Age' }, { num: '6.5kg', label: 'Fat Lost' }, { num: '1mo', label: 'Duration' }], result: 'Inflammation reduced · Below 100kg for the first time in 5+ years', photo: require('../assets/transformations/ba6.jpeg') },
  { id: 7, tags: ['Postpartum'], stats: [{ num: '34', label: 'Age' }, { num: '7kg', label: 'Fat Lost' }, { num: '2.5mo', label: 'Duration' }], result: '10 min → 45 min exercise · 3,000 → 8,000 steps · Strength & endurance rebuilt', photo: require('../assets/transformations/ba7.png') },
  { id: 8, tags: ['Postpartum', 'High Inflammation'], stats: [{ num: '34', label: 'Age' }, { num: '5kg', label: 'Fat Lost' }, { num: '4mo', label: 'Duration' }], result: '15 min restricted → 45 min strength training · Ankylosing spondylitis improved · Energy restored', photo: require('../assets/transformations/ba8.png') },
  { id: 9, tags: ['Type 2 Diabetes'], stats: [{ num: '46', label: 'Age' }, { num: '16kg', label: 'Fat Lost' }, { num: '6mo', label: 'Duration' }], result: 'Zero motivation → 5x/week training · Energy 10/10 · Got promoted · Credited his transformation', photo: require('../assets/transformations/ba9.png') },
  { id: 10, tags: ['Menopause', 'Insulin Resistance'], stats: [{ num: '51', label: 'Age' }, { num: '17kg', label: 'Fat Lost' }, { num: '1yr', label: 'Duration' }], result: 'Completed her first 10km marathon · Brain fog gone · Sleep & gut restored · Full energy returned', photo: require('../assets/transformations/ba10.jpeg') },
  { id: 11, tags: ['Type 2 Diabetes'], stats: [{ num: '39', label: 'Age' }, { num: '12kg', label: 'Fat Lost' }, { num: '2mo', label: 'Duration' }], result: 'HbA1c 8.7 → 6.9 · 0 → 10 full pushups · Blood sugar controlled · Strength rebuilt', photo: require('../assets/transformations/ba11.png') },
]

// === VIDEOS ===
export type Video = { id: number; title: string; category: string; duration: string; layer: number; gradient: string }

export const VIDEOS: Video[] = [
  { id: 1, title: 'Why GLP-1 Alone Won\'t Fix Your Metabolism', category: 'Metabolic Signaling', duration: '8 min', layer: 3, gradient: 'linear-gradient(135deg, #FFB800, #FF6B6B)' },
  { id: 2, title: 'The post-meal walk: may lower glucose for free', category: 'Movement', duration: '4 min', layer: 3, gradient: 'linear-gradient(135deg, #00D9A3, #4DA8FF)' },
  { id: 3, title: 'Box breathing: 5 minutes that may lower cortisol', category: 'Neurochemical Safety', duration: '5 min', layer: 2, gradient: 'linear-gradient(135deg, #FF6B6B, #D42B2B)' },
  { id: 4, title: 'Morning sunlight: the free circadian anchor', category: 'Circadian Authority', duration: '6 min', layer: 1, gradient: 'linear-gradient(135deg, #7C5CFF, #4DA8FF)' },
]

// === CRAVINGS DATA (Corrected v2 — Relational Framework) ===
// Based on "Craving Intelligence Framework v1" — relational timing, not clock time
// Habit vs Signal distinction: immediate post-meal cravings = habit tag, not layer signal
// Rows 6 & 7 held back (weakest evidence tier)

export const CRAVING_TYPES = [
  { id: 'sweet', label: 'Sweet', icon: '🍬' },
  { id: 'salty', label: 'Salty', icon: '🧂' },
  { id: 'carbs', label: 'Carbs', icon: '🍞' },
  { id: 'caffeine', label: 'Caffeine', icon: '☕' },
  { id: 'alcohol', label: 'Alcohol', icon: '🍷' },
]

// Timing relative to last meal (relational, not clock-based)
export const CRAVING_TIMING = [
  { id: 'immediate', label: 'Right after eating (<1hr)', desc: 'Within 30-60 min of finishing a meal' },
  { id: 'delayed', label: 'Delayed (2-4 hrs after meal)', desc: 'Between meals, 2-4 hours after eating' },
  { id: 'independent', label: 'No meal connection', desc: 'Not related to any recent meal' },
  { id: 'pre-sleep', label: 'Gap before sleep (>3hrs after dinner)', desc: 'Long awake window between dinner and sleep' },
  { id: 'on-waking', label: 'Immediately on waking', desc: 'Right when you wake up, whenever that is' },
]

export const CRAVING_CONTEXTS = [
  { id: 'stressed', label: 'Stressed' },
  { id: 'tired', label: 'Tired' },
  { id: 'bored', label: 'Bored' },
  { id: 'after-meals', label: 'After meals' },
  { id: 'hormonal', label: 'Hormonal' },
]

// Rebuilt against Symptom/Craving Layer Crosswalk v2 (Amit-reviewed) — Cravings table.
// The two layer-claiming rules that had no citation (dinner-sleep-gap → L1,
// caffeine-on-waking → L1) were replaced with the crosswalk's actual cited rows.
// "Habit" stays — it's not a clinical claim, it's an explicit "not a metabolic signal"
// disclaimer already used consistently across the cravings UI (quick-log badge, weekly
// summary, edit screen) and doesn't need crosswalk sourcing to be honest.
// Tier ordering per crosswalk: book > author_interview > practitioner
export type CravingMapping = {
  id: number
  pattern: string
  layer: number | null        // primary layer; null = habit tag, no layer signal
  secondaryLayer?: number      // secondary/consequence layer, where the crosswalk specifies one
                                 // NOTE: not yet persisted to Supabase (app_cravings.mapped_layer is
                                 // single-column) — display/mechanism metadata only until a schema
                                 // migration adds a secondary-layer column.
  mechanism: string
  tier: 'book' | 'author_interview' | 'practitioner' | 'habit'
  confidence: string
  citation?: string
}

export const CRAVING_MAPPINGS: CravingMapping[] = [
  {
    id: 1,
    pattern: 'Sweet/carb craving within 30-60 min of eating (daily habit)',
    layer: null,
    mechanism: 'Meal-completion reward conditioning, culturally reinforced (e.g., Indian mithai tradition)',
    tier: 'habit',
    confidence: 'Habit pattern — not a metabolic signal',
  },
  {
    id: 2,
    pattern: 'Sweet/sugar/carb craving 2-4 hrs after eating (afternoon-crash pattern), including "I need something sweet or I can\'t function"',
    layer: 3,
    secondaryLayer: 2,
    mechanism: 'Post-prandial glucose/insulin rebound — the "crash" after a spike, and the felt urgency of needing something sweet to function, are the same well-characterized pattern',
    tier: 'book',
    confidence: 'Strong signal',
    citation: 'L-042 (Glucose Revolution)',
  },
  {
    id: 3,
    pattern: 'Stress-triggered craving for starchy/sugary/salty food specifically',
    layer: 2,
    secondaryLayer: 3,
    mechanism: 'Stress-triggered craving for starchy/sugary/fatty food is a primary neurochemical signal with a metabolic consequence, not a willpower lapse',
    tier: 'book',
    confidence: 'Strong signal',
    citation: 'L-024 (Why Zebras Don\'t Get Ulcers)',
  },
]

// Removed from the old local mapping — no crosswalk row, no citation, and unlike
// "habit" these were actual layer claims (not disclaimed as non-clinical):
// 1. "Sweet/carb craving in the dinner-to-sleep gap → L1" — flagged for Amit: restore
//    as an explicit practitioner-hypothesis-tier entry, or leave dropped.
// 2. "Caffeine craving immediately on waking → L1" — same flag.
//
// Also NOT implemented (crosswalk rows that don't fit the current craving picker's
// type/timing/context fields — need new UI, not built here):
// - "Persistent hunger despite adequate intake" (L3 primary, L4 primary, L-088/L-090) —
//   this isn't a food-type craving; picker has no "general hunger" option.
// - "Pursuit-driven craving that fades once obtained" (L2 primary, L5 secondary, L-054) —
//   describes a behavioral pattern, not a type/timing/context combination the picker captures.

// Function to compute craving mapping from user inputs
export function computeCravingMapping(
  cravingType: string,
  timing: string,
  context: string
): CravingMapping | null {
  // Immediate post-meal = habit (not a signal)
  if (timing === 'immediate') {
    return CRAVING_MAPPINGS[0]
  }

  // Stress-triggered craving takes precedence over timing — primary L2 signal regardless of when
  if (context === 'stressed' && (cravingType === 'sweet' || cravingType === 'carbs' || cravingType === 'salty')) {
    return CRAVING_MAPPINGS[2]
  }

  // Delayed (2-4 hrs) sweet/carb craving, afternoon-crash pattern = L3 primary / L2 secondary
  if (timing === 'delayed' && (cravingType === 'sweet' || cravingType === 'carbs')) {
    return CRAVING_MAPPINGS[1]
  }

  // No crosswalk-approved match — log but don't map (previously mis-mapped to the two
  // uncited L1 rules above; now correctly returns no signal instead of a fabricated one)
  return null
}

// === SYMPTOMS DATA (Expanded with severity) ===
export const SYMPTOMS = [
  'Fatigue', 'Brain fog', 'Poor sleep', 'Bloating', 'Weight gain',
  'Sugar cravings', 'Anxiety', 'Low mood', 'Low libido', 'Joint pain',
  'Headaches', 'Digestive issues', 'Skin issues', 'Hair loss',
  'Afternoon crash', 'Morning tiredness', 'Mood swings', 'Cold hands/feet',
  // New additions
  'Heel pain', 'Swelling in calf muscle', 'Lower back pain', 'Knee pain',
  'Neck stiffness', 'Acid reflux', 'Frequent urination', 'Excessive thirst',
  'Night sweats', 'Cold intolerance', 'Hot flashes', 'Dizziness',
  'Chest tightness', 'Shortness of breath',
]

export const SYMPTOM_SEVERITY = [
  { id: 'mild', label: 'Mild', desc: 'Noticeable but doesn\'t affect daily life', color: '#F59E0B' },
  { id: 'moderate', label: 'Moderate', desc: 'Affects some activities', color: '#FF6B6B' },
  { id: 'severe', label: 'Severe', desc: 'Significantly impacts daily life', color: '#EF4444' },
]

export const SYMPTOM_TIMELINES = [
  { id: 'days', label: 'Last few days' },
  { id: 'recent', label: 'Recently (last few weeks)' },
  { id: 'months', label: 'A few months ago' },
  { id: '6months', label: '6+ months ago' },
  { id: 'year+', label: 'A year+ ago' },
]

// === SYMPTOM → LAYER CROSSWALK (v2, Amit-reviewed) ===
// Source: Symptom_Craving_Layer_Crosswalk_DRAFT (2).md — every row below is transcribed
// verbatim from that document. Do not add rows not present in the source file.
//
// Six symptoms are excluded from layer-mapping by explicit design decision — they are
// medical-referral-pattern signals (cardiac/DVT/diabetes-screening), not layer-scoring input.
export const TRIAGE_EXCLUDED_SYMPTOMS = [
  'Dizziness', 'Chest tightness', 'Shortness of breath',
  'Frequent urination', 'Excessive thirst', 'Swelling in calf muscle',
]

// Distinct from TRIAGE_EXCLUDED_SYMPTOMS — these still get layer-mapped normally (they're real
// Practitioner Hypothesis signals, not excluded). They additionally surface a support resource
// when logged, per Apple's App Store requirement for apps discussing anxiety/mood/stress.
export const MENTAL_HEALTH_SYMPTOMS = ['Anxiety', 'Low mood', 'Mood swings']

export type SymptomMapping = {
  symptomName: string
  layer: number | null
  secondaryLayers?: number[]    // display/mechanism metadata only — see note on CravingMapping
  mechanism: string
  tier: 'book' | 'author_interview' | 'practitioner'
  confidence: string
  citation: string
  needsQualifier?: 'weight_gain' | 'cold_hands_feet' | 'hair_loss'  // see computeSymptomMapping
}

export const SYMPTOM_MAPPINGS: SymptomMapping[] = [
  {
    symptomName: 'Weight gain',
    layer: 3,
    mechanism: 'Weight gain resistant to diet/exercise, with regain worsening on each attempt, is a documented metabolic-adaptation pattern — not a discipline problem',
    tier: 'book', confidence: 'Strong signal', citation: 'L-163, L-173, Entry 29 Part D',
    needsQualifier: 'weight_gain',
  },
  {
    symptomName: 'Cold intolerance',
    layer: 3,
    mechanism: 'Cold intolerance, alongside brittle nails and constipation with normal thyroid labs, points to metabolic rather than thyroid causes',
    tier: 'author_interview', confidence: 'Moderate signal', citation: 'L-338 (Attia/Drive podcast)',
  },
  {
    symptomName: 'Joint pain',
    layer: 3, secondaryLayers: [4],
    mechanism: 'Joint and tendon/ligament pain not otherwise explained is linked to metabolic signaling strain, with a secondary gut-brain axis connection',
    tier: 'book', confidence: 'Strong signal', citation: 'L-290 (Circadian Diabetes Code)',
  },
  {
    symptomName: 'Knee pain',
    layer: 3, secondaryLayers: [4],
    mechanism: 'Treated as a joint-pain presentation — linked to metabolic signaling strain, with a secondary gut-brain axis connection',
    tier: 'book', confidence: 'Strong signal', citation: 'L-290 (Circadian Diabetes Code)',
  },
  {
    symptomName: 'Acid reflux',
    layer: 1, secondaryLayers: [4],
    mechanism: 'Acid reflux tied to fasting or caffeine on an empty stomach reflects circadian misalignment, with the gut as the symptom site',
    tier: 'author_interview', confidence: 'Moderate signal', citation: 'Panda podcast (via NotebookLM cross-check)',
  },
  {
    symptomName: 'Lower back pain',
    layer: 2, secondaryLayers: [4],
    mechanism: 'Chronic anger or fear can lead to sustained muscle tension, showing up as lower back pain',
    tier: 'book', confidence: 'Strong signal', citation: 'L-440 (Body Keeps the Score)',
  },
  {
    symptomName: 'Neck stiffness',
    layer: 2, secondaryLayers: [4],
    mechanism: 'Chronic bracing and hyperarousal — the same mechanism as sustained lower-back tension, extended to the neck',
    tier: 'book', confidence: 'Strong signal', citation: 'Body Keeps the Score (via NotebookLM cross-check)',
  },
  {
    symptomName: 'Hair loss',
    layer: 2,
    mechanism: 'Stress-triggered, patchy hair loss (alopecia areata) — distinct from diffuse thinning tied to severe caloric restriction, which points to L3 instead',
    tier: 'book', confidence: 'Strong signal', citation: 'Sapolsky, Ch.17',
    needsQualifier: 'hair_loss',
  },
  {
    symptomName: 'Heel pain',
    layer: 3, secondaryLayers: [1],
    mechanism: 'In Amit\'s clinical experience, heel pain co-occurring with slow metabolism, poor sleep, inflammatory bloodwork, and persistent fatigue shows up as a recurring pattern — not yet confirmed in any uploaded source, kept visibly separate from book-tier findings',
    tier: 'practitioner', confidence: 'Practitioner observation — tentative', citation: 'Amit\'s direct clinical observation across client base, undated',
  },
  {
    symptomName: 'Brain fog',
    layer: 3,
    mechanism: 'Brain fog is a confirmed, strong metabolic-signaling signal; a circadian connection appears in case data but is not yet book-tier confirmed and is kept as a separate, lower-weight note',
    tier: 'book', confidence: 'Strong signal', citation: 'L-042',
  },
  {
    symptomName: 'Morning tiredness',
    layer: 3, secondaryLayers: [1],
    mechanism: 'Treated as grogginess despite adequate sleep — a metabolic-signaling pattern with a circadian connection',
    tier: 'book', confidence: 'Moderate signal (assumes "despite adequate sleep" — not separately confirmed)', citation: 'L-042',
  },
  {
    symptomName: 'Cold hands/feet',
    layer: 2,
    mechanism: 'Cold hands/feet specifically as part of an acute anxiety-episode prodrome — a narrower, partial match, not a general circulation complaint',
    tier: 'book', confidence: 'Partial match — narrower context than general symptom logging', citation: 'L-144 (Mind-Gut, Ch.2)',
    needsQualifier: 'cold_hands_feet',
  },
  {
    symptomName: 'Night sweats',
    layer: 1, secondaryLayers: [2],
    mechanism: 'Hot flushes and night sweats that worsen under stress or heat connect to both environmental/circadian and stress-response layers',
    tier: 'book', confidence: 'Strong signal', citation: 'Entry 17',
  },
  {
    symptomName: 'Hot flashes',
    layer: 1, secondaryLayers: [2],
    mechanism: 'Hot flushes and night sweats that worsen under stress or heat connect to both environmental/circadian and stress-response layers',
    tier: 'book', confidence: 'Strong signal', citation: 'Entry 17',
  },
  // The following are Amit's direct clinical calls, not sourced from the crosswalk document —
  // Practitioner Hypothesis tier per the standing Tier-Weighting Rule, framed as "in Amit's
  // clinical experience..." and kept visibly separate from book/author-interview tier rows.
  {
    symptomName: 'Fatigue',
    layer: 1, secondaryLayers: [3],
    mechanism: 'In Amit\'s clinical experience, fatigue most often traces back to circadian disruption, with a metabolic-signaling contribution',
    tier: 'practitioner', confidence: 'Practitioner observation', citation: 'Amit\'s direct clinical observation across client base, undated',
  },
  {
    symptomName: 'Poor sleep',
    layer: 1, secondaryLayers: [2, 3],
    mechanism: 'In Amit\'s clinical experience, poor sleep is frequently driven by sympathetic (fight-or-flight) dominance and blood sugar instability, even though sleep disruption itself sits at the circadian layer',
    tier: 'practitioner', confidence: 'Practitioner observation', citation: 'Amit\'s direct clinical observation across client base, undated',
  },
  {
    symptomName: 'Bloating',
    layer: 4, secondaryLayers: [1, 3],
    mechanism: 'In Amit\'s clinical experience, bloating is primarily a gut-brain axis signal, with circadian and metabolic-signaling factors as contributors',
    tier: 'practitioner', confidence: 'Practitioner observation', citation: 'Amit\'s direct clinical observation across client base, undated',
  },
  {
    symptomName: 'Low mood',
    layer: 2, secondaryLayers: [1, 4],
    mechanism: 'In Amit\'s clinical experience, low mood is most often a neurochemical-safety signal, with circadian and gut-brain axis factors contributing',
    tier: 'practitioner', confidence: 'Practitioner observation', citation: 'Amit\'s direct clinical observation across client base, undated',
  },
  {
    symptomName: 'Anxiety',
    layer: 2,
    mechanism: 'In Amit\'s clinical experience, anxiety maps to the neurochemical-safety layer',
    tier: 'practitioner', confidence: 'Practitioner observation', citation: 'Amit\'s direct clinical observation across client base, undated',
  },
  {
    symptomName: 'Digestive issues',
    layer: 4,
    mechanism: 'In Amit\'s clinical experience, general digestive issues map to the gut-brain axis layer',
    tier: 'practitioner', confidence: 'Practitioner observation', citation: 'Amit\'s direct clinical observation across client base, undated',
  },
  {
    symptomName: 'Afternoon crash',
    layer: 3,
    mechanism: 'In Amit\'s clinical experience, the afternoon energy crash maps to the metabolic-signaling layer',
    tier: 'practitioner', confidence: 'Practitioner observation', citation: 'Amit\'s direct clinical observation across client base, undated',
  },
]

// Symptoms logged but with no mapping (crosswalk or practitioner) — not mapped rather than
// guessed. Matches the Signal Accumulator spec's "unscored/unmapped" treatment (§3.4): useful
// for prioritizing future extraction work, never used as a scoring input.
// Low libido, Mood swings (Amit flagged as pending — needs to check).
// "Sugar cravings" also appears in this SYMPTOMS list but is functionally the same signal
// already captured by the separate craving-logging feature — flagged as a product overlap
// worth resolving (not a mapping gap), not fixed here.

// Compute a symptom's layer mapping. Three symptoms need a qualifying answer because the
// crosswalk's actual phrase is more specific than the bare picker label — see needsQualifier.
export function computeSymptomMapping(
  symptomName: string,
  qualifierAnswer?: boolean  // meaning depends on needsQualifier — see call sites
): SymptomMapping | null {
  if (TRIAGE_EXCLUDED_SYMPTOMS.includes(symptomName)) return null // routed to triage flag, not layer scoring

  const base = SYMPTOM_MAPPINGS.find(m => m.symptomName === symptomName)
  if (!base) return null

  if (base.needsQualifier === 'weight_gain') {
    // Qualifier: "Is this resistant to diet/exercise, and getting worse each time you try?"
    return qualifierAnswer ? base : null
  }
  if (base.needsQualifier === 'cold_hands_feet') {
    // Qualifier: "Does this happen specifically during a stress/anxiety episode?"
    return qualifierAnswer ? base : null
  }
  if (base.needsQualifier === 'hair_loss') {
    // Qualifier: "Is it sudden and patchy?" true = L2 (stress-alopecia, as written above);
    // false = diffuse/gradual thinning, which is the caloric-restriction row instead.
    if (qualifierAnswer === false) {
      return {
        ...base,
        layer: 3,
        mechanism: 'Diffuse hair thinning tied to severe caloric restriction points to metabolic signaling strain rather than a stress-alopecia pattern',
        citation: 'Obesity Code, starvation-study material',
      }
    }
    return base
  }

  return base
}

// === DISCLAIMER (from amitbaruna.com) ===
export const DISCLAIMER = "Important: This is not a medical diagnostic. It is a clinical symptom pattern tool designed to help identify which biological layer may need attention — and to guide a deeper conversation. Always consult a qualified physician for any health concerns."

// === GOALS ===
export const GOAL_PRESETS = [
  'Reverse pre-diabetes naturally',
  'Lose belly fat',
  'Improve sleep quality',
  'Reduce stress & anxiety',
  'Improve gut health',
  'Build strength & muscle',
  'Balance hormones naturally',
  'Increase daily energy',
  'Improve mental clarity',
  'Reverse insulin resistance',
]

// === FAT DEPOSITION (Profile only) ===
export const FAT_DEPOSITION_OPTIONS = [
  { id: 'belly', label: 'Belly (apple/visceral)', desc: 'Abdomen, trunk', signal: 'Insulin resistance, cortisol dominance, metabolic syndrome risk' },
  { id: 'hips', label: 'Hips & thighs (pear)', desc: 'Lower body', signal: 'Estrogen-dominant pattern, lower metabolic risk' },
  { id: 'uniform', label: 'All over (uniform)', desc: 'Everywhere', signal: 'Systemic inflammation, possible thyroid involvement' },
  { id: 'upper', label: 'Upper body (face/neck/arms)', desc: 'Face, neck, upper arms', signal: 'Cortisol dominance (Cushing\'s pattern), stress-driven' },
]

// === HOME CUSTOMIZATION ===
export type HomeSection = { id: string; label: string; locked?: boolean; defaultOn: boolean; explanation?: string }

export const HOME_SECTIONS: HomeSection[] = [
  { id: 'score', label: 'Your Score', locked: true, defaultOn: true },
  { id: 'resistance', label: 'Fat Loss Resistance', defaultOn: true, explanation: 'Shows your fat loss resistance percentage and recovery potential. This is your key diagnostic number — it tells you how much your body is protecting vs adapting.' },
  { id: 'metabolic-story', label: 'Metabolic Story', defaultOn: true, explanation: 'The interactive map of how your five layers connect — which cascades are active right now and why. Turning this off removes the visual explanation, not the underlying data.' },
  { id: 'upcoming-call', label: 'Upcoming Call', defaultOn: true, explanation: 'Shows your next scheduled call with Amit right on Home, so you never miss it. Turning this off just hides the reminder card — your booking itself is unaffected.' },
  { id: 'layers', label: 'The 5 Layers', locked: true, defaultOn: true },
  { id: 'daily-focus', label: "Today's 1% Action", defaultOn: true, explanation: 'This is your daily anchor. Without it, the app becomes just information — not transformation. Small daily actions compound into score changes.' },
  { id: 'cravings', label: 'Cravings Quick-Log', defaultOn: true, explanation: 'Cravings are biological signals, not discipline failures. Logging them builds a diagnostic pattern over 5-7 days that reveals which layers are under strain.' },
  { id: 'symptoms', label: 'Current Symptoms', defaultOn: true, explanation: 'Your active symptom timeline — visible at a glance on Home. Removing this hides what your body is telling you between score retests.' },
  { id: 'insights', label: 'Latest Insights', defaultOn: true, explanation: 'Articles and videos matched to your weakest layer. Turning this off removes the learning loop — you\'ll retake your score without understanding why it changed.' },
  { id: 'case-studies', label: 'Case Studies', defaultOn: true, explanation: 'Real transformations matched to your pattern. Proof that your specific bottleneck is solvable. Removing this loses the hope signal.' },
  { id: 'instagram', label: 'Instagram Follow', defaultOn: true },
  { id: 'methodology', label: "Amit's Methodology", defaultOn: true, explanation: "Shows the foundation of this app — Amit's story, credentials, and specialisation. Gives new users context for why this framework exists before they've taken the test." },
  { id: 'data-counter', label: 'Data Contribution', defaultOn: true },
]

export const DEFAULT_HOME_SECTIONS = HOME_SECTIONS.filter(s => s.defaultOn).map(s => s.id)

// === MINI-QUIZ PER LAYER (Phase 2A) ===
export type MiniQuizQuestion = { q: string; o: string[] }

export const MINI_QUIZ: Record<number, MiniQuizQuestion[]> = {
  1: [
    { q: 'What time do you usually get your first direct sunlight exposure?', o: ['Before 9 AM — daily', '9–11 AM most days', 'After 11 AM or rarely direct', 'Almost never direct sunlight'] },
    { q: 'How do you handle screen use before bed?', o: ['Hard cutoff 60 min before bed', 'Night mode only, but still on', 'Sometimes forget', 'No rules — phone till I sleep'] },
    { q: 'How dark is your bedroom?', o: ['Pitch black', 'Slightly lit (charger lights)', 'Streetlight through window', 'TV or lamp on'] },
    { q: 'On weekends, your wake time shifts by…', o: ['Same time as weekdays', '1–2 hours later', '3+ hours later', 'No real pattern'] },
  ],
  2: [
    { q: 'When was your last true "do nothing" day?', o: ['This week', 'This month', 'This year', 'Can\'t remember'] },
    { q: 'How often do you do breathwork, meditation, or stillness practice?', o: ['Daily', 'Few times a week', 'Occasionally', 'Never'] },
    { q: 'How do you typically decompress after work?', o: ['Walk / nature / exercise', 'Family / chat / cook', 'Scroll / watch TV', 'Drink / snack / smoke'] },
    { q: 'When someone criticizes you, your body…', o: ['Barely reacts', 'Brief tension, recovers in minutes', 'Tight chest for hours', 'Stays with me for days'] },
  ],
  3: [
    { q: 'How many days a week do you strength train?', o: ['3+ days', '1–2 days', 'Rarely', 'Never'] },
    { q: 'What does your typical breakfast look like?', o: ['High protein (eggs / yogurt / whey)', 'Light carb (toast / oats)', 'Just coffee or tea', 'I skip breakfast'] },
    { q: 'How often do you walk for 10+ min after a main meal?', o: ['After every main meal', 'Sometimes', 'Rarely', 'Never'] },
    { q: 'Between meals, you…', o: ['Never snack', 'Rarely snack', 'Snack most days', 'Snack constantly'] },
  ],
  4: [
    { q: 'In a typical week, how many different plant foods do you eat?', o: ['30+ (diverse)', '15–30', '5–15', 'Less than 5'] },
    { q: 'How often do you eat fermented foods?', o: ['Daily (yogurt / kefir / kimchi)', 'Few times a week', 'Occasionally', 'Never'] },
    { q: 'How thoroughly do you chew each bite?', o: ['20+ chews per bite', '10–20 chews', 'Quick swallow', 'I don\'t pay attention'] },
    { q: 'How much water do you drink daily?', o: ['3+ liters', '2–3 liters', '1–2 liters', 'Less than 1 liter'] },
  ],
  5: [
    { q: 'When was the last time you said "no" to something that didn\'t serve you?', o: ['This week', 'This month', 'Can\'t recall', 'I never say no'] },
    { q: 'When you slip up on a health goal, how do you talk to yourself?', o: ['Understanding, move on', 'Mild frustration', 'Harsh criticism', 'I derail for days'] },
    { q: 'Do you have a clear 1-year vision for your health?', o: ['Yes, written down', 'Yes, in my head', 'Vaguely', 'No'] },
    { q: 'How often do you compare your body to others?', o: ['Rarely', 'Sometimes', 'Often', 'Constantly'] },
  ],
}

export function getPersonalizedPractices(layerId: number, mainQuizAns: number[], miniQuizAns: number[]): number[] {
  const allAns = [...mainQuizAns, ...miniQuizAns]
  const weaknessCount = allAns.filter(a => a >= 2).length
  if (weaknessCount >= 4) return [0, 1]
  if (weaknessCount >= 2) return [0]
  return [0, 1, 2, 3]
}

export function getPersonalizedSigns(layerId: number, mainQuizAns: number[]): { thriving: string[]; struggling: string[] } {
  const layerQuestions = QUESTIONS.filter(q => q.layer === layerId)
  const thriving: string[] = []
  const struggling: string[] = []
  mainQuizAns.forEach((ansIdx, qIdx) => {
    const q = layerQuestions[qIdx]
    if (!q) return
    const optText = q.o[ansIdx]
    if (!optText) return
    const essence = optText.split(' ').slice(0, 6).join(' ').replace(/[,.]$/, '')
    if (ansIdx <= 1) thriving.push(essence)
    else struggling.push(essence)
  })
  return { thriving, struggling }
}

// === MOCK USER DATA (for Profile) ===
export const USER_SYMPTOMS = [
  { name: 'Brain fog', since: '6+ months ago' },
  { name: 'Afternoon crash', since: 'A few months ago' },
  { name: 'Poor sleep', since: 'A year+ ago' },
  { name: 'Sugar cravings', since: '6+ months ago' },
]

export const USER_CRAVINGS_WEEK = [
  { type: 'sweet', time: 'afternoon', days: 4 },
  { type: 'salty', time: 'evening', days: 3 },
  { type: 'carbs', time: 'late-night', days: 2 },
]

export const USER_GOAL = 'Reverse pre-diabetes naturally'
export const USER_FAT_DEPOSITION = 'belly'
export const ASSESSMENT_COUNT = 1247

// === SCORE HISTORY (Mock data — past assessments) ===
export type DemoScore = {
  id: number;
  date: string;
  totalScore: number;
  layerScores: { l1: number; l2: number; l3: number; l4: number; l5: number };
  pattern: string;
  n1: string;
  n2: string;
  n3: { title: string; body: string };
};

export const DEMO_SCORES: DemoScore[] = [
  {
    id: 1,
    date: 'Mar 14, 2025',
    totalScore: 64,
    layerScores: { l1: 14, l2: 10, l3: 14, l4: 14, l5: 12 },
    pattern: 'Recovery Deficit',
    n1: 'Your nervous system has been locked in a protective state for months. Chronic stress has elevated cortisol, which is directly breaking down muscle tissue, storing visceral fat around your midsection, and suppressing thyroid conversion. This is why effort alone hasn\'t produced results — your body is spending energy on protection, not adaptation.',
    n2: 'Your L2 (Neurochemical Safety) layer is your primary bottleneck. Your body is stuck in fight-or-flight mode — even when nothing stressful is happening. Until this layer is addressed, every other intervention (diet, training, supplements) may under-deliver because your system can\'t absorb the change.',
    n3: {
      title: 'Start with your nervous system, not your diet',
      body: 'Five minutes of box breathing daily may help lower cortisol. Once your body feels safe, your existing nutrition and training may start working better.',
    },
  },
  {
    id: 2,
    date: 'Feb 28, 2025',
    totalScore: 58,
    layerScores: { l1: 12, l2: 8, l3: 12, l4: 14, l5: 12 },
    pattern: 'Recovery Deficit',
    n1: 'Two weeks ago, your score was 58. Your L2 layer was even more suppressed. The pattern was the same — your body was protecting itself against perceived threat. The cortisol-driven belly fat pattern was the visible symptom of an invisible root cause.',
    n2: 'Your dominant layer has been L2 (Neurochemical Safety) for the past two assessments. This consistency is meaningful — it tells us the issue isn\'t a recent spike but a chronic pattern that needs sustained intervention, not quick fixes.',
    n3: {
      title: 'Consistency over intensity',
      body: 'You started daily box breathing and a 20-minute nature walk. The 6-point improvement in two weeks is consistent with what may happen when the nervous system starts to feel safe.',
    },
  },
  {
    id: 3,
    date: 'Feb 14, 2025',
    totalScore: 52,
    layerScores: { l1: 10, l2: 6, l3: 12, l4: 14, l5: 10 },
    pattern: 'Recovery Deficit',
    n1: 'This was your baseline assessment. A score of 52 placed you in the "Significant Dysfunction" band — your body was in survival mode, with L2 (Neurochemical Safety) scoring critically low at 6/20. This was the moment we identified the root cause.',
    n2: 'Three layers were active (score 11 or below): L1 Circadian, L2 Neurochemical, and L5 Identity. The cascade risk was high — when L2 is this low, it may suppress every other layer. Addressing L2 first may help lift the others.',
    n3: {
      title: 'The first step was the smallest',
      body: 'We didn\'t change your diet or training. We added one thing: 5 minutes of box breathing before bed. That\'s it. The body may need to feel safe before it can accept other changes.',
    },
  },
];

// Global state for selected layer (for mockup navigation)
export let selectedLayerId = 1
export function setSelectedLayerId(id: number) { selectedLayerId = id }

// === LAYER DETAIL CONTENT (per layer) ===
export type LayerContent = {
  signs: { good: string[]; bad: string[] }
  practices: { title: string; desc: string }[]
  articles: { title: string; read: string }[]
  videos: { title: string; duration: string }[]
}

export const LAYER_CONTENT: Record<number, LayerContent> = {
  1: { // Circadian Authority
    signs: {
      good: ['Wake without an alarm', 'No afternoon crashes', 'Stable mood', 'Quick recovery from exercise'],
      bad: ['Need caffeine to start day', 'Wake at 3am frequently', 'Snoring or apnea', 'Brain fog by noon'],
    },
    practices: [
      { title: 'Morning sunlight', desc: '10 minutes of direct sunlight within 30 minutes of waking. Anchors your circadian rhythm and triggers earlier melatonin that night.' },
      { title: 'Screen curfew', desc: 'No screens 60 minutes before bed. If you must, use blue light glasses + night mode.' },
      { title: 'Cool + dark', desc: 'Bedroom at 18-20°C, pitch black. Even small light leaks suppress melatonin.' },
      { title: 'Magnesium glycinate', desc: '200-400mg 30 minutes before bed. Most people are deficient; this deepens sleep architecture.' },
    ],
    articles: [
      { title: 'The 4 stages of sleep — and why you need all of them', read: '6 min read' },
      { title: 'How one bad night destroys your glucose tolerance', read: '4 min read' },
      { title: 'The circadian code: timing matters more than duration', read: '8 min read' },
    ],
    videos: [
      { title: 'Morning sunlight: the free circadian anchor', duration: '6 min' },
      { title: 'Why your 3pm crash isn\'t about willpower', duration: '5 min' },
    ],
  },
  2: { // Neurochemical Safety
    signs: {
      good: ['Calm under pressure', 'Quick recovery from stress', 'Stable energy all day', 'Rarely "snap"'],
      bad: ['Belly fat despite diet', 'Wired but tired at night', 'Anxiety / racing thoughts', 'Crave sugar when stressed'],
    },
    practices: [
      { title: 'Box breathing', desc: 'Inhale 4, hold 4, exhale 4, hold 4. 5 minutes daily may help lower cortisol over time.' },
      { title: 'Nature exposure', desc: '20 minutes in green space lowers cortisol more than meditation apps in head-to-head studies.' },
      { title: 'Cold exposure', desc: '30-60 seconds of cold shower. Trains vagal tone and shifts you to parasympathetic.' },
      { title: 'Journaling', desc: '3 lines: 1 thing you\'re grateful for, 1 thing you\'re worried about, 1 win from today.' },
    ],
    articles: [
      { title: 'Cortisol: the master hormone you\'re burning out', read: '7 min read' },
      { title: 'Why belly fat is a stress symptom, not a diet problem', read: '5 min read' },
      { title: 'The vagus nerve: your secret stress weapon', read: '6 min read' },
    ],
    videos: [
      { title: 'Box breathing: 5 minutes that may lower cortisol', duration: '5 min' },
      { title: 'Cold showers: the vagal tone trigger', duration: '4 min' },
    ],
  },
  3: { // Metabolic Signaling
    signs: {
      good: ['Steady energy after meals', 'No sugar cravings', 'Stable weight', 'Good exercise recovery'],
      bad: ['Afternoon energy crash', 'Sugar cravings', 'Weight gain despite diet', 'Skin tags or dark patches'],
    },
    practices: [
      { title: 'Post-meal walk', desc: '10-20 min walk after each main meal. Tends to reduce glucose spikes by up to 30%.' },
      { title: 'Strength train 3x/week', desc: 'Compound lifts: squats, deadlifts, presses, rows. 30-45 minutes is enough.' },
      { title: 'Protein first', desc: '30g protein within 60 min of waking. Eggs, Greek yogurt, or whey.' },
      { title: 'No snacking', desc: '3 meals today. Nothing between. Let insulin baseline between meals.' },
    ],
    articles: [
      { title: 'Why muscle is your metabolic insurance policy', read: '6 min read' },
      { title: 'The post-meal walk: may lower glucose for free', read: '4 min read' },
      { title: 'Zone 2 cardio: the most underrated health practice', read: '7 min read' },
    ],
    videos: [
      { title: 'Why GLP-1 Alone Won\'t Fix Your Metabolism', duration: '8 min' },
      { title: 'The post-meal walk: may lower glucose for free', duration: '4 min' },
    ],
  },
  4: { // Gut-Brain Axis
    signs: {
      good: ['1-3 formed bowel movements daily', 'No bloating after meals', 'Diverse cravings (not just sugar)', 'Clear skin'],
      bad: ['Constipation or loose stools', 'Bloating after eating', 'Sugar cravings', 'Bad breath / coated tongue'],
    },
    practices: [
      { title: '30 plants a week', desc: 'The single biggest predictor of microbiome diversity. Count different plants — fruits, veg, herbs, spices, nuts, seeds.' },
      { title: 'Fermented foods daily', desc: 'Yogurt, kefir, kimchi, sauerkraut, kombucha. Aim for 2-3 servings.' },
      { title: 'Prebiotic fibres', desc: 'Onions, garlic, leeks, asparagus, green bananas. These feed the good bugs.' },
      { title: 'Chew your food', desc: 'Digestion starts in the mouth. 20-30 chews per bite reduces bloating dramatically.' },
    ],
    articles: [
      { title: 'The gut-brain axis: why your microbes control your mood', read: '8 min read' },
      { title: '30 plants a week: the diversity rule that changes everything', read: '5 min read' },
      { title: 'SIBO, bloating & why fibre isn\'t always the answer', read: '9 min read' },
    ],
    videos: [
      { title: '30 plants a week: the microbiome diversity rule', duration: '6 min' },
      { title: 'Fermented foods: the gut reset', duration: '5 min' },
    ],
  },
  5: { // Identity Physiology
    signs: {
      good: ['Consistent with habits', 'Self-compassionate', 'Resilient after setbacks', 'Clear sense of self'],
      bad: ['Start-stop pattern', 'Harsh self-talk', 'Give up before seeing results', 'Feel body is "working against" you'],
    },
    practices: [
      { title: 'Identity statement', desc: 'Write: "I am becoming someone who [specific trait]." Read it aloud daily.' },
      { title: 'Say no once', desc: 'Decline 1 thing today that doesn\'t serve your future self.' },
      { title: 'Future self letter', desc: 'Write 3 lines from your 1-year-ahead self to today you.' },
      { title: 'Values check', desc: 'Tonight: did today align with your core values? Note 1 thing.' },
    ],
    articles: [
      { title: 'Identity-based habits: why "who" beats "what"', read: '7 min read' },
      { title: 'The self-fulfilling prophecy of body identity', read: '5 min read' },
      { title: 'Why your body isn\'t working against you (even when it feels like it)', read: '6 min read' },
    ],
    videos: [
      { title: 'Identity shift: the deepest layer', duration: '7 min' },
      { title: 'Why willpower fails (and what works instead)', duration: '5 min' },
    ],
  },
}
