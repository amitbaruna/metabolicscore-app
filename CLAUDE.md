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

### 2026-07-29 (cont'd 2) — Craving schema fix + id-reconciliation bug family fixed; all temp debug logs removed (code-complete, NOT yet device-tested)

Continuation of the two entries below, same day. Two connected pieces of work, both found
via the `[DEBUG craving]`/`[DEBUG saveScore]` diagnostics added earlier this session — both
now removed (see cleanup note at the bottom).

**Craving save schema mismatch — `app_cravings` real columns are `craving_time`/
`craving_context`, app was sending `timing`/`context`.** Confirmed via diagnostics this was
causing insert failures (23502 not-null violation) — every craving was lost on logout since
nothing ever reached Supabase. Fixed at the `AppDataContext.tsx` call sites only (not the
`config/supabase.ts` `cravings` API object, which just passes payloads through unchanged):
`saveCraving`'s payload now sends `craving_time`/`craving_context`; `updateCraving`
destructures `timing`/`context` out of its app-facing `updates` param and remaps them for
the API call only (local state keeps the original `CravingEntry` shape); both read-mapping
spots (identity-change fetch, `refreshCravings`) now read `row.craving_time`/
`row.craving_context` back into `.timing`/`.context`. `craving_type`, `mapped_layer`,
`mechanism`, `tier`, `confidence` untouched — those already matched. No DB/schema change.

**Craving id-reconciliation bug family — four connected fixes, one root cause.** A
read-only investigation (requested explicitly, no code touched until findings were
reported) found `saveCraving` assigns a client-generated `uuid()` to the local entry,
sends the payload without an id, and never writes the real Supabase-assigned id back onto
local state — everything else follows from that one gap:
- **`saveCraving`:** now reads the real id off `cravingApi.save`'s returned row
  (`result[0].id`, available because `doFetch` always sends `Prefer: return=representation`
  when there's a body) and patches both state and AsyncStorage with it. If the save fails or
  returns no usable row, the local temp id is left in place and a warning is logged instead
  of silently proceeding as if it succeeded.
- **`refreshCravings`:** merge de-dup key changed from `created_at` (string equality
  between a client `nowISO()` and a server-side timestamp — fragile, could let the same
  craving survive as two entries) to `id`, which is now reliable with the above fix in place.
- **`deleteCraving`:** there was no remote delete at all — `cravingApi` had no `delete`
  method, so "deleting" only ever mutated local state and the Supabase row survived,
  reappearing on the next refresh. Added `cravings.delete(id)` to
  `src/config/supabase.ts` (`DELETE /rest/v1/app_cravings?id=eq.<id>`, with an explicit
  `Prefer: return=representation` header since a bodyless DELETE doesn't get `doFetch`'s
  auto-added one) and wired `deleteCraving` to call it first for signed-in users — local
  state is only removed if the remote delete actually matched a row. Guest/no-session
  behavior (local-only, no remote call) is unchanged.
- **`updateCraving`:** a PATCH matching zero rows still returns a successful HTTP response
  (empty array with `Prefer: return=representation`, not an error) — previously
  indistinguishable from a real update. Now checks the returned array length and logs a
  clear warning on zero matches.

**Known gap, deliberately not fixed this session — carry to next session:**
`updateCraving`'s zero-match case currently only warns; it does **not** roll back the
already-applied local edit. So a user can edit a craving that fails to match remotely (e.g.
one created moments earlier where reconciliation hasn't landed yet) and see the edit
reflected locally while Supabase still has the old value, with only a console warning as
the signal — no user-facing indication. `deleteCraving`'s equivalent case *was* handled
(local removal is gated on remote success) — the same treatment should be applied to
`updateCraving` next session, unless Amit decides a warning-only signal is acceptable for
this path.

**Diagnostic logs added throughout this session have now been fully removed** —
`[DEBUG HomeScreen RENDER]`, `[DEBUG MetabolicStory Home]`, `[DEBUG MetabolicStory
Profile]` (all `App.tsx`), and every `[DEBUG craving]`/`[DEBUG saveScore]` instance in
`AppDataContext.tsx`. `[DEBUG symptom]` logs were deliberately left in place (not part of
this removal request) — still active for a future symptom-path investigation, same
codebase area, not yet done. One line (the identity-change effect's shared error-catch log)
originally tagged both `[DEBUG craving]` and `[DEBUG symptom]` together — kept as a
`[DEBUG symptom]`-only log rather than deleting it outright, since only the craving tag was
asked to be removed and this is the one spot symptom errors in that catch block are still
being surfaced.

`tsc --noEmit`: clean throughout, same 10 pre-existing errors (Image prop types,
craving/insight union types) the whole session, nothing new introduced by any of tonight's
work.

**Not yet device-tested — none of tonight's work.** Next session should live-test, in
order: (1) create a craving, confirm it actually reaches `app_cravings` now (schema fix);
(2) edit and delete a freshly-created craving in the same session, confirm both actually
reach Supabase (id-reconciliation fix — this is the scenario that was silently failing
before); (3) sign out/in and confirm cravings don't duplicate or vanish (refreshCravings
dedup fix); (4) the three display fixes and craving/symptom fixes from the two entries
below, still queued from earlier tonight. Then implement the `updateCraving` rollback gap
noted above. Nothing from tonight has been committed — unstaged, pending Amit's review,
per rule 8.

### 2026-07-29 (cont'd) — Four-fix batch: HomeScreen score card, Home/Profile Metabolic Story fallbacks, Profile weakestLayer, Home shortcut removal (all code-complete, NOT yet device-tested)

Follow-up to the same-day entry below, using the 3 `[DEBUG ...]` logs left in place from
that session to confirm root causes before fixing. All four fixes are `App.tsx` only.

**Fix 1 — HomeScreen score-summary card (the actual "Take your first Metabolic Score" pad
users were seeing) gated on the wrong variable.** Diagnostics proved `showPostTest` itself
was computing correctly (`true`, with real `scoreHistory`) — the bug was a third, separate
conditional nested inside the already-correct `showPostTest === true` branch: the merged
score/resistance card gated its own empty-state text on raw `scoreResult` (`!scoreResult ?
...`), not on `showPostTest`/`hasRealScore`. Since `scoreResult` is in-memory-only and null
after any sign-in without retaking the quiz this session, this card kept showing "Take your
first Metabolic Score" regardless of real persisted history. Fixed: card's tap handler,
visibility gate, and empty-vs-real-content branch now key off `hasRealScore` instead of
`scoreResult`. Added `const band = scoreResult?.band ?? (latestHistory ? getBand(score) :
null);` (reusing the `score`/`latestHistory` fallback locals already sitting above this
card) so the band status/color/label reads have a real fallback instead of only ever
reading `scoreResult?.band?.*`. Left the expanded resistance breakdown
(`generateLocalN1`/`rcsInfo`, needs full quiz-answer data `scoreHistory` doesn't carry)
gated on `scoreResult` only — a genuine data limit, not a bug.

**Fix 2 — Home's Metabolic Story card.** Confirmed via `[DEBUG MetabolicStory Home]`: reads
`scoreResult` directly (correctly null after sign-in), so the card was hiding entirely
whenever real history existed but `scoreResult` didn't. `cascadeRisk` (what the full
interactive `CascadeVisualization` needs) is never persisted to `scoreHistory` — only
`total_score`/`layer1-5`/`dominant_pattern`/`rcs` are — so the full visualization can't be
rebuilt from persisted data. Added a lightweight fallback instead of hiding the card:
when `scoreResult` is null but `scoreHistory[0]` exists, shows `dominant_pattern` as a
headline plus a `layer1-5` breakdown (`X/20` per layer), same header treatment as the real
card. Both null → card still doesn't render (no data at all).

**Fix 3 — Profile's Metabolic Story / `weakestLayer`.** Confirmed via `[DEBUG
MetabolicStory Profile]`: `scoreResult?.dominantLayer` was undefined for a user with real
history, so `weakestLayer` fell back to a **hardcoded** `LAYERS[1]` ("Neurochemical
Safety") while that user's actual persisted `dominant_pattern` said "Circadian Disruption
Pattern" — the app was asserting a specific clinical conclusion the data didn't support.
Fixed: hardcoded fallback removed entirely — `weakestLayer` is now `null` when
`scoreResult?.dominantLayer` is absent (no derived/guessed Layer object either, since a
persisted `dominant_pattern` string isn't a 1:1 substitute for a `LAYERS[]` entry with
`.name`/`.color`). Collapsed subtitle now shows the persisted `dominant_pattern` string
when `weakestLayer` is null, falling to a genuine empty-state message ("Take your first
assessment...") only if neither exists. The expanded "Dominant layer" row (which
structurally needs `weakestLayer.color`, a Layer-object-only property) shows "Not
available" rather than guessing when `weakestLayer` is null. Expanded `CascadeVisualization`
gets the same lightweight `layer1-5` breakdown fallback as Fix 2, for the same
cascadeRisk-isn't-persisted reason.

**Fix 4 — removed redundant Home shortcuts.** Deleted the small top-right "Log →" link
(Cravings Quick-Log header) and "Edit →" link (Current Symptoms header) on `HomeScreen`
only — tapping the cards themselves already routes correctly, so these were redundant.
Cards, their tap behavior, and equivalent controls elsewhere in the app untouched.

**Explicitly not done this batch (by request):** no Supabase schema changes, no persisting
`dominant_layer`/`cascadeRisk` to make the fallbacks richer later — separate future work.
The 3 `[DEBUG ...]` logs are still in the code, kept deliberately for on-device
verification of these fixes — not yet removed.

`tsc --noEmit`: clean after each of the four fixes, same 10 pre-existing errors throughout
(Image prop types, craving/insight union types — unrelated, out of scope).

**Not yet device-tested — none of it.** Next session should live-test, in order: (1) the
account-switch scenarios from the entry below, (2) this batch's HomeScreen score card with
a real multi-history account, (3) Home and Profile Metabolic Story fallback rendering for
an account with history but no fresh `scoreResult`, (4) Profile's "Dominant layer: Not
available" / empty-state text actually appearing correctly instead of erroring, (5) the two
removed Home shortcut links are actually gone and the cards still navigate correctly on tap.
Once confirmed, remove the 3 `[DEBUG ...]` logs in a dedicated cleanup pass (deliberately
not done yet). Nothing from this batch has been committed — unstaged, pending Amit's
review, per rule 8.

### 2026-07-29 — Cross-account stale-data family: Profile "Latest score" stuck, in-memory scoreResult and Clinical Depth toggle not reset on account switch (code done, NOT yet live-tested)

**Investigated read-only first, then fixed once root causes were confirmed** — three
related findings, same root-cause family as the 2026-07-25/28 "flag/prop can drift from
real per-user data" bugs.

**Finding 1 — `scoreResult` is in-memory-only, never reset on identity change.**
`scoreResult` (`App.tsx`, `AppNavigator`) is plain `useState<ScoreResult | null>(null)`
local to `AppNavigator` — not in `AppDataContext`, not persisted, only ever set by
`handleScoreComplete` when a quiz is completed *in that session*. It's passed as a prop
into `HomeScreen`/`ProfileScreen`/etc. `HomeScreen` falls back to `scoreHistory[0]` when
it's null; `ProfileScreen`'s "Latest score" badge did not — `scoreResult?.totalScore ??
'—'`, no fallback. Net effect: sign in without retaking the quiz this session → Profile's
"Latest score" shows `—` regardless of real history, and (worse, pre-fix) a freshly
signed-in account could still be showing the *previous* account's in-memory `scoreResult`
if one was set earlier in the same app session, since nothing ever cleared it on
sign-out/sign-in/account switch.

**Finding 2 — `ms_clinical_depth` is a single fixed AsyncStorage key, device-wide, not
per-user.** Confirms the mechanism suspected-but-unconfirmed on 2026-07-28: the key is a
hardcoded string literal in `ClinicalDepthProvider`, no user id involved — one value per
device, shared across every account signed in on it.

**Finding 3 — the identity-change handler in `AppDataContext.tsx` (the one that logs
"Identity changed... cleared stale local cache") only clears 9 specific AsyncStorage
keys** (cravings, symptoms, goals, fat deposition, baseline, score history, mini quiz,
last quiz answers, conditions). It has no way to reach `scoreResult` (not an AsyncStorage
key, lives in a different component's in-memory state) and never referenced
`ms_clinical_depth` at all — confirmed via grep, zero matches in that file.

**Fixed (all three, one root-cause family):**
- `App.tsx` `AppNavigator`: added `useEffect(() => { setScoreResult(null); }, [user?.id]);`
  — resets the in-memory quiz result on sign-in/sign-out/account switch.
- `App.tsx` `ClinicalDepthProvider`: key changed from fixed `ms_clinical_depth` to
  `` `ms_clinical_depth_${user?.id || 'anonymous'}` ``, re-read on user-id change,
  explicitly defaults to `false` when unset for that user (previously only ever set
  `true`, never explicitly reset to `false`, so a stale `true` could survive an identity
  change). Required moving `ClinicalDepthProvider` inside `AuthProvider` in the provider
  tree (`App.tsx`, `export default function App()`) since it previously sat *outside*
  `AuthProvider` and had no access to `useAuth()`/the current user id — checked that
  nothing else depends on the old ordering before making the swap. **Migration decision:**
  the old fixed `ms_clinical_depth` key is left orphaned, unmigrated — no reliable way to
  know which account it "belonged" to, so each account now starts fresh (off) and sets its
  own preference going forward.
- `App.tsx` `ProfileScreen`: "Latest score" badge now reads `scoreHistory[0]?.total_score
  ?? '—'` instead of `scoreResult?.totalScore ?? '—'` — reads from the persisted,
  correctly per-user-scoped list (already confirmed working via Score History) instead of
  the unscoped in-memory value, so it's correct independent of Finding 1's fix timing too.
- `tsc --noEmit`: no new type errors (same pre-existing Image prop-type and craving/insight
  union errors noted 2026-07-27/28, left alone as out of scope).

Note: 3 temporary debug `console.log`s (`[DEBUG HomeScreen]`, `[DEBUG HomeScreen RENDER]`,
`[DEBUG ProfileScreen]`) were added earlier this session and are **still in the code as of
this entry** — kept intentionally, in active use for the follow-up fixes below. Not removed
yet; see the four-fix batch entry above for current status.

**Not yet live-tested on device.** Needs on-device confirmation of: (1) sign out of one
account, into another — Profile's "Latest score" and the Clinical Depth toggle should both
reflect the *new* account, not the previous one; (2) an account that has never set Clinical
Depth defaults to off (Simple mode); (3) the existing 2026-07-28 HomeScreen pad fix and the
2026-07-27 auth-error-surfacing fixes, still queued from prior sessions and also not yet
confirmed on device.

**Next session:**
- Live-test all of the above on device — nothing from 2026-07-25 onward that touched
  auth/identity/per-account state has been confirmed on a real device yet; this is now a
  growing backlog of code-complete-but-unverified fixes.
- Nothing from this session has been committed — all changes are unstaged edits pending
  Amit's own review and commit, per rule 8.

### 2026-07-28 — Home screen "first score" pad fixed (code done, deployed to dev server, NOT yet confirmed on device — paused for computer restart)

**Bug found on fresh testing:** Home screen's "take your first metabolic score" pad was
showing even with 3 real past tests confirmed in Supabase.

**Root cause, traced before touching code:** `HomeScreen`'s `showPostTest` (`App.tsx`) was
a `useState` initializer — `useState(hasScore || !!scoreResult || scoreHistory.length > 0)`
— evaluated once at mount, never reactive afterward. `LoginScreen.routeAfterAuth` navigates
to `'home'` as soon as its own single `profiles.get()` call resolves, completely
independent of `AppDataContext`'s own remote score fetch (a separate `Promise.all`) —
so `HomeScreen` almost always mounts before real score data has loaded, permanently
capturing `false` into `showPostTest` for that mount. Separately, `hasScore` itself was a
redundant manually-synced flag (`ms_has_score` in AsyncStorage) rather than derived from
real `scoreHistory` — same "flag can drift from real data" pattern as the goals/fat
deposition/conditions bugs fixed 2026-07-25.

**Fixed (code changes made, not yet live-tested on device):**
- `src/context/AppDataContext.tsx`: removed the `ms_has_score` AsyncStorage key entirely
  (read/write/identity-switch-wipe). `hasScore` is now `scoreHistory.length > 0`, derived
  fresh every render, not a separately-tracked `useState`. `saveScore`'s local-backup write
  to `scoreHistory` now runs unconditionally (previously only in the authenticated branch) —
  needed so a guest/no-session score save still flips `hasScore` correctly now that there's
  no separate flag to set.
- `App.tsx` `HomeScreen`: `showPostTest` is now `previewOverride ?? hasRealScore`, where
  `hasRealScore` is recomputed every render from `hasScore || !!scoreResult ||
  scoreHistory.length > 0`. `previewOverride` is a small separate `useState<boolean|null>`
  that preserves the existing dev-only "Preview post-test state" toggle (eye icon /
  underlined link) without it fighting the derived value.
- `tsc --noEmit` run against project config: no new type errors introduced (pre-existing
  unrelated errors — Image prop types, craving `tier` union — left alone, same as noted
  2026-07-27).

**Bug 2 (Clinical Depth Mode not persisting across sign-out/sign-in) — investigated,
deliberately not fixed.** Traced `ClinicalDepthProvider` (`App.tsx`): its `ms_clinical_depth`
AsyncStorage key is global/device-wide, not per-user (unlike the other settings fixed
2026-07-25) — but structurally it sits above `AuthProvider` and never unmounts on
sign-out/sign-in within a session, so on paper it should survive that action. No confirmed
root cause found from static analysis; three candidate mechanisms identified (global vs
per-account key, unawaited `AsyncStorage.setItem` write in `toggleClinicalDepth`, initial
`useState(false)` flash before the async read resolves) but none confirmed. Amit decided
not enough signal to justify further investigation time right now — deferred.

**Deploy status:** No Supabase/Worker changes in this fix (app-side only), so the usual
Supabase → Worker → app sequence doesn't apply here. Started `expo start --tunnel` for
on-device testing — first two attempts failed (stale port 8081 state, then an ngrok
`Cannot read properties of undefined (reading 'body')` transient failure, matching the
documented tunnel instability) — third attempt connected successfully
(`exp://gr8kl-w-amitbaruna-8081.exp.direct`), but the process was killed (computer
shutting down) before Amit could test on device. **Nothing has been confirmed working on
a real device yet.**

**Next session:**
- Restart the dev server (`expo start --tunnel`, may need 2-3 attempts per the known ngrok
  instability) and have Amit confirm on-device: (1) sign out fully, sign back in on the
  account with 3 past tests — pad should not appear, should go straight to real score view;
  (2) guest/no-session score save still flips the pad correctly (code path changed); (3) the
  "Preview post-test state" dev toggle still works.
- Bug 2 (Clinical Depth persistence) remains open/deferred, not scoped into active work.
- Nothing from this session has been committed — all changes are unstaged edits pending
  Amit's own review and commit, per rule 8.

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
