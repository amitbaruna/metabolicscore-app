# Metabolic Score™ — Mobile App

A premium React Native + Expo app for **Dr. Amit Baruna** — a 14-question Metabolic Score™ diagnostic, 5 Layers education hub, score tracking, and 1:1 booking.

Built to match the cinematic dark-premium feel of [amitbaruna.com](https://amitbaruna.com).

---

## Quick Start

```bash
cd metabolic-score-app
npm install
npx expo start
```

Then scan the QR code with **Expo Go** (free on App Store / Play Store).

### Requirements
- Node 18+
- Expo Go app on your phone (iOS or Android)
- That's it. No Xcode, no Android Studio, no simulators.

---

## What's Included

### 8 Core Screens
| # | Screen | Purpose |
|---|--------|---------|
| 1 | **Splash** | Animated logo + brand intro |
| 2 | **Login / Signup** | Email + password, Google sign-in (demo mode for now) |
| 3 | **Onboarding** | 6-step: age → gender → height → weight → symptoms → conditions/meds |
| 4 | **Home** | Latest score hero, progress chart, quick actions, featured layer |
| 5 | **Score Tool** | 14-question diagnostic with sliders + chips, auto-advance |
| 6 | **Results** | Animated score reveal, 5 Layer breakdown, personalised tips |
| 7 | **Layers Hub** | Browse all 5 Layers with score badges |
| 8 | **Layer Detail** | Why it matters, signs, practices, deep-dive articles |
| + | **Profile** | Stats, history chart, health profile, settings |
| + | **Booking** | Calendly webview + Razorpay-ready plan cards |

### 5 Layers of Metabolic Health
1. **Sleep Architecture** — duration, quality, consistency
2. **Stress Resilience** — cortisol rhythm, recovery practices
3. **Gut Health** — bowel regularity, diversity, fibre
4. **Movement & Fuel** — steps, strength, NEAT, sedentary time
5. **Nervous System** — HRV, sympathetic dominance, recovery

Each layer gets 2-3 questions in the diagnostic. Total score: 0-100 with tier (Critical / Developing / Building / Optimising / Thriving).

---

## Demo Mode (Default)

The app ships in **DEMO MODE** — fully functional, all data stored locally via AsyncStorage.

✅ Sign up / sign in (any email + password works)
✅ Take the 14-question diagnostic
✅ See your score, tier, and layer breakdown
✅ View progress chart over time
✅ Browse all 5 Layers with rich content
✅ Book a call via Calendly webview
✅ All data persists between app launches

---

## Going Live with Supabase

When you're ready to sync across devices:

### 1. Get your Supabase keys
- Go to [supabase.com](https://supabase.com) → your project → **Settings → API**
- Copy the **Project URL** and **anon public key**

### 2. Add them to the app
```bash
cp .env.example .env
```
Then edit `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Create the database tables
Run this SQL in your Supabase SQL Editor:

```sql
-- Profiles table
create table profiles (
  id uuid references auth.users primary key,
  email text,
  full_name text,
  age int,
  gender text,
  height_cm numeric,
  weight_kg numeric,
  symptoms text[],
  conditions text[],
  medications text[],
  onboarded boolean default false,
  created_at timestamptz default now()
);

-- Scores table
create table scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  total int not null,
  layers jsonb not null,
  answers jsonb,
  tier text,
  created_at timestamptz default now()
);

-- RLS policies
alter table profiles enable row level security;
alter table scores enable row level security;

create policy "Users can CRUD own profile"
  on profiles for all using (auth.uid() = id);

create policy "Users can CRUD own scores"
  on scores for all using (auth.uid() = user_id);
```

### 4. Restart the app
```bash
npx expo start -c
```
The app will detect the env vars and switch from DEMO MODE to live mode automatically.

---

## Wiring Real Google Sign-In

The Google button currently works in demo mode (creates a mock Google user). To wire real Google OAuth:

1. Create a Google Cloud project → OAuth consent screen → credentials
2. Add your Client ID to `app.json` under `expo.android.googleServices` and `expo.ios.googleServices`
3. Configure Supabase → Auth → Providers → Google with the same Client ID + Secret
4. Replace `signInWithGoogle` in `src/context/AuthContext.tsx` with the real `expo-auth-session` flow (code skeleton already in place)

---

## Wiring Razorpay (Future Booking System)

The **Booking** screen already has plan cards and Razorpay branding. To enable native checkout:

1. `npm install razorpay-react-native-sdk` (requires Expo prebuild / dev client — not Expo Go compatible)
2. Replace the `Alert.alert` in `PlansTab` with `Razorpay.open(paymentOptions)`
3. Verify the payment signature on your backend, then create the appointment row in Supabase

The current build keeps the UI ready and falls back to Calendly in the meantime.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | React Native + Expo SDK 51 | Cross-platform, Expo Go compatible, no native build needed for MVP |
| Language | TypeScript | Type safety across screens & data |
| Navigation | React Navigation v6 (native stack + bottom tabs) | Battle-tested, flexible |
| Backend | Supabase (Postgres + Auth) | Free tier, scales, real-time if needed |
| State | React Context (Auth + AppData) | Minimal boilerplate, no Redux needed at this scale |
| Storage | AsyncStorage (demo mode) / Supabase (live) | Auto-fallback via `api` wrapper |
| Charts | react-native-svg | Lightweight, no native deps, Expo Go safe |
| Styling | StyleSheet + LinearGradient | Premium feel, no styled-components overhead |
| Icons | @expo/vector-icons (Ionicons) | 1000+ icons, ships with Expo |

---

## Project Structure

```
metabolic-score-app/
├── App.tsx                          # Entry point
├── app.json                         # Expo config (dark, portrait, bundle IDs)
├── package.json
├── .env.example                     # Supabase URL + anon key placeholders
├── tsconfig.json
│
└── src/
    ├── config/
    │   ├── theme.ts                 # Colors, typography, spacing, shadows
    │   ├── constants.ts             # Brand info, LAYERS, Calendly URL, IG link
    │   └── supabase.ts              # Supabase client + DEMO MODE fallback
    │
    ├── context/
    │   ├── AuthContext.tsx          # User state, sign in/up/out
    │   └── AppDataContext.tsx       # Scores + profile state
    │
    ├── navigation/
    │   └── AppNavigator.tsx         # Auth stack / Main stack / Bottom tabs
    │
    ├── components/
    │   ├── Button.tsx               # 4 variants, 3 sizes, loading state
    │   ├── Card.tsx                 # Elevated / glow / padded
    │   ├── Chip.tsx                 # Selectable chip for diagnostic
    │   ├── ProgressBar.tsx          # Themed progress bar
    │   ├── ScoreSlider.tsx          # Custom slider for diagnostic
    │   └── ScoreChart.tsx           # SVG line chart for progress
    │
    ├── data/
    │   ├── questions.ts             # 14 questions + score calculator
    │   └── mockData.ts              # Mock auth/score/profile services
    │
    └── screens/
        ├── Splash.tsx
        ├── Login.tsx
        ├── Signup.tsx
        ├── Onboarding.tsx           # 6-step wizard
        ├── Home.tsx                 # Dashboard
        ├── ScoreTool.tsx            # 14-question diagnostic
        ├── Results.tsx              # Animated score reveal
        ├── LayersHub.tsx            # 5 Layers browse
        ├── LayerDetail.tsx          # Layer deep-dive
        ├── Profile.tsx              # Stats, history, settings
        └── Booking.tsx              # Calendly + Razorpay-ready plans
```

---

## Customising the Brand

All brand strings live in **`src/config/constants.ts`**:

```ts
export const BRAND = {
  name: 'Metabolic Score',
  tagline: 'Decode your metabolism. Transform your health.',
  doctorName: 'Dr. Amit Baruna',
  email: 'hello@amitbaruna.com',
  website: 'https://amitbaruna.com',
  instagram: 'https://www.instagram.com/amitbaruna/?hl=en',
  instagramHandle: '@amitbaruna',
  calendly: 'https://calendly.com/amit-baruna/transformation-blueprint-call',
  razorpayEnabled: false,
  razorpayKeyId: '',
};
```

Change colors in **`src/config/theme.ts`**.

---

## Updating the 14 Diagnostic Questions

Edit **`src/data/questions.ts`**. Each question has:
- `id` — unique number
- `layer` — which of the 5 Layers it scores
- `type` — `slider` or `chips`
- `title`, `subtitle` — what the user sees
- Slider: `min`, `max`, `minLabel`, `maxLabel`, `unit`
- Chips: `options` array with `{ label, value }` (0-100)

The score calculator handles inversion automatically for "lower is better" questions (e.g., stress level, sedentary hours).

---

## Building for App Store / Play Store

When you're ready to ship:

1. **Add app icons & splash image** to `/assets/` (1024×1024 icon, 1242×2436 splash)
2. **Update `app.json`** with real bundle IDs (already set: `com.amitbaruna.metabolicscore`)
3. **Install EAS CLI**: `npm install -g eas-cli`
4. **Build**:
   ```bash
   eas build --platform ios --profile production
   eas build --platform android --profile production
   ```
5. **Submit**:
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

Apple Developer account ($99/year) and Google Play Console ($25 one-time) required.

---

## Cost Summary

| Item | Cost | Status |
|------|------|--------|
| Expo / React Native | Free | ✅ Ready |
| Supabase | Free (500MB DB, 50k MAU) | ✅ When you add keys |
| Google Play Console | $25 one-time | When ready |
| Apple Developer | $99/year | When ready |
| Razorpay | 2% per transaction | When ready |
| This codebase | Free | ✅ Done |

---

## Next Iteration Ideas

- Push notifications (expo-notifications) — daily reminders, weekly score check-ins
- Achievements / streaks — gamify consistency
- Apple Health / Google Fit sync — auto-pull sleep, steps, HRV
- AI coach chat — personalised Q&A based on user's latest score
- Group challenges — cohort-based transformations
- Recipe library — filterable by layer (e.g., "sleep-promoting dinners")

---

Built for **Dr. Amit Baruna** · [amitbaruna.com](https://amitbaruna.com) · [@amitbaruna](https://www.instagram.com/amitbaruna/?hl=en)
