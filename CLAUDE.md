# Metabolic Score App — Working Rules

This file is read automatically at the start of every Claude Code session in this repo.
Follow it without being reminded.

## Non-negotiable working rules

1. **Never write, edit, or deploy any code without explicit go-ahead.** Always ask first
   and wait — even for obvious fixes, even mid-task.
2. **Describe planned changes in plain language before implementing.** Show a mockup or
   description for any UI/visual change before touching code.
3. **Batch related changes together** rather than fixing one thing at a time and re-testing
   each in isolation.
4. **Architecture/spec always precedes implementation.** Diagnose and explain the root
   cause before proposing or writing a fix.
5. **Deployment sequence when data is involved:** Supabase migration → Cloudflare Worker →
   HTML/app. Never reversed.
6. **New roadmap/marketing/B2B ideas get flagged for later**, not scoped into active work
   unprompted.
7. **This project uses Claude only — no other AI coding tool.** Do not reference GLM or any
   other implementation partner.

## Clinical language discipline (non-negotiable)

- "May" language only throughout — never diagnostic or directive claims.
- Disease-probability claims (e.g. "52% chance of hypertension") are off-limits until a
  real Hypothesis-to-Lab Validation Loop produces real correlation data.
- Population stats must always include sample size (n) and be framed as "among people who
  sought help despite normal/no clinical diagnosis" — never general-population claims.
- "Clinical depth" = expert-derived heuristic from Amit's judgment, NOT lab-validated data.
  This distinction must never blur in product or physician-facing copy.

## Architecture context

- **Frontend/mobile:** React Native / Expo Go, single monolithic `App.tsx` (~6,700+ lines).
  Screens fully unmount on navigation (switch-based pattern) — re-mounts re-trigger effects,
  a recurring source of duplicate-fire bugs. Watch for this pattern before assuming a fix
  is complete.
- **Backend:** Supabase (Postgres + Auth + Storage), accessed via a hand-rolled `sbFetch`
  wrapper in `src/config/supabase.ts` — NOT the official `@supabase/supabase-js` client.
  This means auth/session refresh, RLS errors, etc. are all manually handled and prone to
  silent failure — verify explicitly, don't assume standard Supabase client behavior.
- **AI routing:** Cloudflare Worker → Claude API for narrative generation.
- **Auth:** Google Sign-In via native `expo-auth-session` id_token exchange (not a redirect
  flow) — requires the Google provider's "Authorized Client IDs" field in Supabase, not just
  "Enabled."
- **State:** `AppDataContext.tsx` holds shared app state (scores, symptoms, cravings, goals,
  conditions, baseline, fat deposition). Local AsyncStorage cache keys are now scoped to the
  signed-in user identity (fixed 2026-07-25) — do not reintroduce global/unscoped cache keys.

## Known, documented failure patterns — assume these until proven otherwise

- **Silent failures are the codebase's signature bug**, not the exception. Save functions
  have historically bailed silently (`if (!user) return`), swallowed errors
  (`catch (e) { /* ignore */ }`), or only `console.warn`'d instead of surfacing to the UI.
  When diagnosing "X isn't saving," check for these patterns first.
- **Schema drift is a recurring, confirmed bug class.** The app has repeatedly sent fields
  to Supabase that don't exist as columns yet (`app_scores.time_spent_seconds`,
  `app_scores.engagement_grade`, `app_cravings.confidence`, `app_cravings.context` — all
  hit this in the same week). Before adding any new field to a save payload, verify the
  column exists via `information_schema.columns` first.
- **Duplicate/disconnected UI logic across screens.** The same feature (e.g. symptom entry,
  medical conditions) is sometimes independently re-implemented in more than one screen
  component, with separate local state that can silently diverge from the real saved value.
  When fixing a bug in one place, grep for whether the same logic exists elsewhere too.
- **Tunnel/dev-server instability (ngrok via `expo start --tunnel`)** produces transient
  network failures that can look identical to real bugs. Always confirm a stable tunnel and
  a full app close/reopen before trusting a test result as clean evidence.

## Source-of-truth rules

- This GitHub repo (`amitbaruna/metabolicscore-app`) is now the single source of truth for
  the app. Do not treat uploaded/pasted file snapshots as authoritative once this repo
  exists — always work from the repo.
- `metabolic-score.html` and `casestudies.html` (separate website repo) are frequently
  stale on GitHub because they're sometimes uploaded directly to Cloudflare Pages,
  bypassing auto-deploy. Always confirm freshness before drawing conclusions from them.
  This does not apply to this app repo.

## Security

- The Supabase key in `src/config/supabase.ts` (`sb_publishable_...`) is a public anon key —
  safe to have client-side, protected by Row Level Security policies, not secrecy.
- The Supabase **service_role** key and the Razorpay **key secret** must NEVER appear in
  this repo, in `App.tsx`, or in any client-side file. They belong only in the Cloudflare
  Worker's environment secrets.
- `.env` and any `.env.*` files are gitignored — keep it that way.

## Session Log

Update this at the end of every session (either with Claude Code or with Claude in
chat) — what got fixed, what's still open. Keep entries short; this is a fast
"where did we leave off" scan, not a full changelog. Newest entry on top.

### 2026-07-25 — Auth root cause fixed, schema drift closed, git/Claude Code set up

**Fixed and confirmed this session:**
- Google Sign-In root cause: Google provider was Disabled in Supabase Auth → Providers.
  Enabled, iOS Client ID added to Authorized Client IDs. Sign-in now works end to end.
- Splash-screen race condition that was silently bouncing users out of onboarding back to
  Home ~1.5s after sign-in (a `useEffect` re-arming on every `user`/`loading` change and
  unconditionally forcing `setScreen("home")`, regardless of current screen). Fixed by
  guarding with `setScreen(prev => prev === 'splash' ? ... : prev)`.
- Cross-account local cache leak: AsyncStorage cache keys (goals, fat deposition, symptoms,
  score history, etc.) were device-wide, not scoped per user — switching Google accounts
  showed stale data from the previous account. Fixed by clearing per-user cache keys
  whenever the signed-in identity changes.
- Profile screen's medical condition + fat deposition editors were using disconnected local
  state that never read or saved to the real value — fixed to read/write through
  `AppDataContext`.
- Symptom entry: severity was optional and "Add" silently no-op'd if incomplete. Now
  required (same as "since"), with a visible flash/highlight cue on missing fields instead
  of a silent no-op.
- Schema drift (recurring bug class): `app_scores` was missing `time_spent_seconds` /
  `engagement_grade`; `app_cravings` was missing `confidence` and `context`. All fixed via
  `ALTER TABLE`. This is the 3rd time this exact bug class has hit — see next session's
  task below.
- Added diagnostic logging (`[Onboarding]`, `[saveProfile]`, `[saveCraving]`,
  `[Supabase ...]`) at prior silent-failure points to make future debugging faster.

**Still open / next session:**
- **Schema-drift check script** (handed to Claude Code directly) — compare every field the
  app sends in save payloads against `information_schema.columns` so missing-column bugs
  are caught before a live device test, not during one.
- **Baseline architecture decision (unresolved):** age/height/weight are currently written
  into a `baseline` JSONB blob on `app_profiles`, not the flat `age`/`height_cm`/`weight_kg`
  columns that already exist on that table. Needs Amit's call on which is source of truth
  before this is touched further.
- **Height/weight in onboarding + push notifications for symptoms/cravings** — Amit raised
  both, not yet fully scoped. Needs a proper spec conversation.
- Confirm `app_cravings` table actually has all fields the app sends (context, confidence,
  mapped_layer, mechanism, tier) — batched `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` was
  provided; confirm it was run.
- No git-commit-on-behalf-of-Amit yet — he reviews and commits manually until he says
  otherwise (see Process rule discussion — not yet added as a numbered rule above, treat as
  standing instruction until formalized).
