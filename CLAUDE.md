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
