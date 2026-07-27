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
8. **Never run `git commit` (or `git push`) on Amit's behalf.** He reviews and commits all
   changes himself. Editing files and staging changes for his review is fine; committing is
   not, until he explicitly says otherwise in this file or in a session.

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

### 2026-07-27 — Day 1 spec: Part A shipped, Part B (payment flow) built, live-tested, and fixed end to end

**Part A — Session token refresh: committed and confirmed working on a real device.**
- Audit found `sbFetch`'s 401/JWT-expired detection and `auth.refreshToken()` were
  already built and correct — closed two real gaps instead of rebuilding: (1) a failed
  refresh (refresh token itself expired) now signs the user out and drops them to login,
  via a new `setOnSessionExpired` hook in `src/config/supabase.ts` that `AuthContext`
  registers into; (2) concurrent 401s (e.g. the `Promise.all` in `AppDataContext` loading
  scores/cravings/profile together on app resume) now share one in-flight refresh call
  instead of each firing its own — avoids Supabase's refresh-token rotation invalidating
  the second/third concurrent attempt.

**Part B — Real payment flow (WhatsApp/Razorpay → webhook → membership flip): built,
live-tested via `wrangler tail` against real test payments, confirmed working end to end.**
- Found the deployed Cloudflare Worker was already far more complete than the spec
  assumed (Amit supplied the real source): signature verification, idempotent
  confirm-by-booking and confirm-by-email paths, and membership date-anchoring logic
  all already existed. Worker source checked into the repo for the first time:
  `workers/metabolic-payment-verify.js` (previously lived only in the Cloudflare
  dashboard, no local copy existed) — along with `workers/wrangler.toml`, added after an
  ad-hoc `wrangler deploy` (no config file) silently overwrote live settings
  (`compatibility_date`, `observability`, `preview_urls`) that weren't part of the
  intended change. Always deploy this Worker via `wrangler deploy --config
  workers/wrangler.toml` from here on, never bare flags.
- Fixed: webhook only ever checked `payment.notes?.email`, which nothing sets in the
  manual-link flow (fixed, reused links can't carry a per-client note) — falls back to
  `payment.email`, the field Razorpay populates from "collect email at checkout."
- Fixed: `plan_type` resolution only read `payment.notes?.plan_type`, which works for
  Razorpay Standard Links but not Payment Pages (no notes field in that dashboard UI) —
  added `planTypeFromAmount()` fallback matching the payment's exact amount against the
  two known fixed prices (₹3,499 / ₹24,990) when notes are absent.
- Fixed: email matching was exact-match/case-sensitive — now uses `ilike` (with `%`/`_`/`\`
  escaped first, so a literal underscore in an email isn't misread as a wildcard).
- Unmatched/failed payment matches used to only `console.warn`; now persisted to
  `unmatched_payments` (migration: `create_unmatched_payments.sql`).
- **Found via live testing, not by inspection — two layered `service_role` permission
  gaps** that made real payments silently fail to match even with a correct, existing
  email: `unmatched_payments` and `app_profiles` both lacked base table-level GRANTs for
  `service_role` (RLS bypass ≠ table privileges — separate layers). A temporary debug
  log in `confirmMembershipByEmail` (added, used, then removed once diagnosed) surfaced
  the real Postgres error, which `supabaseFetch`'s error handling had been silently
  misreading as "zero rows found." Fixed via `grant_service_role_table_access.sql` —
  grants `service_role` full access project-wide and sets it as the default for future
  tables, so this class of bug can't recur silently.
- `App.tsx`'s "Message Amit to Enroll" WhatsApp deep link now pre-fills the user's
  registered email + program name + price (previously sent neither).
- Removed dead, insecure `TEST_ONLY_confirmBooking` / `TEST_ONLY_confirmProgramUpgrade`
  functions from `src/config/supabase.ts` (client-callable, no payment check, superseded
  by the real Worker webhook).
- **`app_membership` RLS gap, found while auditing the above — confirmed and fixed.**
  It had client-writable `INSERT`/`UPDATE` policies (scoped to `auth.uid() = user_id`),
  leftover from the deleted `TEST_ONLY_*` functions — any signed-in user could set their
  own membership to `status: 'paid'` directly via the REST API, no payment check.
  Confirmed via grep across `App.tsx`/`AppDataContext.tsx`/`supabase.ts` that nothing
  legitimate writes to that table client-side (only `SELECT` and the DPDP
  self-deletion `DELETE`) before dropping both policies. Migration:
  `lock_down_app_membership_writes.sql`. **Amit ran this migration during the session.**

**All four migrations from today (`create_unmatched_payments.sql`,
`lock_down_app_membership_writes.sql`, `grant_service_role_table_access.sql`) and the
final Worker deploy were run/confirmed by Amit this session — Part B is live.**

**Auth bug — failed email/password login was silently navigating into the app
instead of showing an error. Root cause found and fixed, not yet live-tested.**
- Started from a real device report: signing out of a Google account and into a
  different one via email/password showed stale data and a blank profile. Traced
  through several red herrings before finding the real cause — each ruled out with
  actual evidence, not assumption:
  - **Not a React/AuthContext race condition.** `OnboardingScreen.handleComplete` is a
    user-driven submit at the end of a 4-step form (`App.tsx:649-679`), not a mount-time
    effect — there's no plausible window for a `setUser` update to still be unflushed by
    the time it fires.
  - **Not a stale `guest@example.com` fallback** (`LoginScreen.handleSignIn`'s
    `email || 'guest@example.com'` default) — confirmed no such row exists in
    `app_profiles`. That fallback is still real and still a latent footgun, just not
    this bug — worth fixing separately later.
  - **Not a provider-nesting or dual-identity-source bug** — confirmed `AppDataProvider`
    is correctly nested inside `AuthProvider` (`App.tsx:6724-6736`) and reads `user`
    exclusively via the same `useAuth()` hook, no independent AsyncStorage read.
  - Real root cause, found via a temporary raw-response log in `auth.signIn`: the test
    credentials used in one reproduction were genuinely wrong, and Supabase correctly
    rejected them with 400 `invalid_credentials` — but `auth.signIn` (`supabase.ts`) read
    the error from `data.error`, a field Supabase's auth error responses don't actually
    use (real fields are `msg`/`error_code`, or `error_description` on some endpoints).
    So a real rejection came back as `{user: undefined, error: null}` — indistinguishable
    from a benign no-op — and `LoginScreen.handleSignIn`'s existing `if (error) ... else
    routeAfterAuth()` gate (already correct, symmetric with the Google path) had no real
    signal to check, so it always fell through and navigated forward on a failed login.
- **Fixed:** `auth.signIn` now gates on `res.ok` (the actual success/failure signal)
  and extracts `data.msg`/`data.error_description`/`data.error_code` into the returned
  error. No separate access-control fix was needed — the navigation gate was already
  correct, it just never had accurate data to gate on.
- All temporary debug logging added during the investigation (`signIn`,
  `signInWithGoogle`, `signUp` in `AuthContext.tsx`; render + identity-check logs in
  `AppDataContext.tsx`; the raw-response log in `auth.signIn`) was removed — confirmed
  via a full-repo grep for `DEBUG` (zero matches) and `git diff` showing both context
  files fully clean (net-zero change). `tsc --noEmit` passes on all three touched files;
  pre-existing unrelated type errors elsewhere in `App.tsx` (Image prop types, a craving
  tier union) were left alone as out of scope.
- **Not yet live-tested** — Amit needs to reproduce both a wrong-password attempt (should
  now show an error, not navigate) and a correct login for an existing onboarded account
  (should go straight to home, not onboarding) before this is considered confirmed.
- Side effect of this investigation: connected a Supabase MCP server
  (`claude mcp add --transport http supabase ...&read_only=true`) so future sessions can
  query the DB directly instead of round-tripping SQL through Amit. Registered correctly
  under the repo root, but **authentication was never completed** (`claude mcp list`
  showed "Needs authentication" and no clear non-interactive way to finish it was found
  this session) — next session should either complete the OAuth step or fall back to the
  manual SQL-paste workflow as before.

**Same-shape bug found on the Google path, fixed.** Cancelling the Google consent
screen (closing it instead of approving) also navigated into onboarding with no
session at all — worse than the email/password case, since no credentials were
validated whatsoever. Root cause: `expo-auth-session`'s `promptAsync()` can resolve
with 5 result types (`success`/`error`/`cancel`/`dismiss`/`locked`), but
`signInWithGoogle` (`AuthContext.tsx`) only distinguished 2 — anything that wasn't
`'success'` or `'error'` returned `{ error: null }`, which `handleGoogle`'s
`if (error) ... else routeAfterAuth()` gate read as "proceed." **Fixed:**
`signInWithGoogle` now returns `{ error: null, cancelled: true }` for
cancel/dismiss/locked, and `handleGoogle` checks `cancelled` first and returns
immediately — stays on login, no navigation, no error shown. Not yet live-tested.

**Audited the rest of the codebase for the same bug shape** (a result with 3+
possible outcomes, only 2 branched on, unhandled case falls into the *permissive*
branch) — two passes, both requested explicitly rather than assumed complete:
- **App-side:** checked push-notification permissions (`Notifications.getPermissionsAsync`/
  `requestPermissionsAsync`, 3-state `granted`/`denied`/`undetermined`), `myMembership.status`
  checks, `QuestionType`, `Share.share()`, and `AuthSession.exchangeCodeAsync`. All fail
  *closed* correctly (unrecognized state → treated as not-granted/not-paid, never as
  success) — no other instances found.
- **Payment Worker side — found a real one.** Of three near-identical `app_membership`
  write blocks in `metabolic-payment-verify.js`, two (`confirmMembershipByEmail`, the
  `isUpgrade` branch of `confirmBookingAndMembership`) checked their write result and
  failed closed; the fresh-booking branch (the *most common* path — a normal first
  purchase) didn't check it at all and unconditionally returned `{ ok: true }`. A booking
  could be marked `'confirmed'` while the membership flip silently failed, reported as
  full success — and worse, the idempotency guard right above it (`if booking already
  confirmed, treat as done`) would then permanently mask the gap on any retry, since it
  assumes a confirmed booking always means membership was already granted. Separately,
  `handleWebhook` only logged `confirmBookingAndMembership` failures via `console.warn`,
  never `logPaymentIssue` — inconsistent with the other two branches, so even correctly
  *detected* failures (booking not found, patch failed) were invisible outside the
  ephemeral Cloudflare log once the webhook returned. **Fixed and deployed:** the
  fresh-booking branch now checks its membership write the same way the other two do;
  `handleWebhook` now calls `logPaymentIssue` on any `confirmBookingAndMembership`
  failure, not just email-match failures.

**Still open / next session:**
- Confirm both Razorpay Payment Links/Pages have "collect email at checkout" enabled
  (prerequisite for the email-matching path regardless of notes vs. amount-fallback).
- The amount-based `plan_type` fallback (for Payment Pages) hasn't itself been
  live-tested yet — only the notes-based Standard Link path was exercised this session.
  Worth one more test payment via an actual Payment Page before trusting it in production.
- Switch Razorpay from test mode to live mode + point the Worker at the live webhook
  secret, per the spec's own test-before-live sequencing — not done yet.
- Neither auth fix (email/password error surfacing, Google cancel handling) has been
  live-tested yet — both need reproducing before considered done.
- The `email || 'guest@example.com'` / `password || 'password'` fallback in
  `LoginScreen.handleSignIn` (`App.tsx:344`) is still there — a blank field silently
  signs into a hardcoded demo account instead of showing a validation error. Not fixed
  this session (ruled out as the cause of the bug above, but still a real latent issue).
- Supabase MCP server needs its auth step finished, or should be removed if not worth
  the friction.
- Carried over from 2026-07-25 (still open): schema-drift check script, baseline
  architecture decision (JSONB blob vs flat columns), height/weight in onboarding +
  push notifications for symptoms/cravings.

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
- No git-commit-on-behalf-of-Amit — formalized as Process rule #8. He reviews and commits
  manually until he explicitly changes that.
