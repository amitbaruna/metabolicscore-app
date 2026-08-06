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

## Known Issues — Carry Forward (documented, not yet fixed)

Specific open bugs that have been diagnosed but deliberately not fixed yet. Unlike the
failure-pattern list above (bug *classes* to watch for), these are concrete, located
instances — check this list before re-diagnosing something that's already understood.

- **HomeScreen's expanded "Fat Loss Resistance" detail view shows nothing after sign-in
  without retaking the test this session.** `App.tsx`, `HomeScreen`, the score-summary
  card's expanded section (~line 1930, the block using `generateLocalN1`/`rcsInfo`) is
  gated on `scoreResult` only, deliberately — it needs full quiz-answer data that
  `scoreHistory` doesn't persist. Net effect: after sign-in without retaking the test this
  session, tapping the score-summary card still expands correctly, but this inner section
  renders nothing — no error, just empty. Same root pattern as the Home/Profile "Metabolic
  Story" `scoreResult`-vs-`scoreHistory` gap fixed 2026-07-29 (see session log), but this
  specific spot was deliberately left unfixed since there's no persisted data to fall back
  to (not a bug in the fallback logic — a genuine data-availability limit, same as noted in
  the 2026-07-29 entries).
- **Pre-launch audit needed: every other `scoreResult` read for the same gap.** Flagged
  2026-07-30, not yet done. Candidates specifically named: the 5 Layers detail pad, and
  personalized article/video recommendations tied to dominant layer or pattern — but the
  actual audit should be a full grep of every `scoreResult` read in `App.tsx`, confirming
  each either (a) has a `scoreHistory[0]` fallback, or (b) is an intentional, documented
  exception like the one above. Should happen before App Store submission.
- **`ReportScreen`'s "Download PDF Report" button has no `onPress` handler at all.**
  `App.tsx` (~line 6550) — a non-functional placeholder, confirmed via read-only
  investigation 2026-08-01. No PDF has ever actually been generated by it; there's no
  `expo-print` or HTML-template path anywhere in the repo — "PDF export" today is really
  just the in-app `ReportScreen` component itself. Not fixed, flagged for a future session.

## Future Ideas Registry (flagged, not scoped into active work)

Roadmap ideas raised mid-session and deliberately not acted on now, per rule 6. Living list,
not a session-log entry — check here before re-proposing something already captured.

- **Inter-test change attribution (v1.1 idea, flagged 2026-07-30).** When a user retakes
  the assessment, surface what specifically changed between the two tests (which
  questions/layers shifted), not just the total score delta. `scoreHistory` already stores
  full per-question answers, so the raw data exists — this needs comparison/diff logic and
  a narrative layer, not new instrumentation. Pairs naturally with the already-planned
  Adaptive Clarification Loop and Clinical Logic Registry work (referenced by Amit as
  existing planned work outside this repo's own documentation — not detailed here).
- **PDF Real Cases links aren't clickable (flagged 2026-08-03), accepted as a known
  limitation for now.** `expo-print`'s HTML `<a>` tags don't survive PDF conversion —
  confirmed as an inherent limitation of its WKWebView-based print path, not a bug in the
  report's own HTML/CSS. Real fix would need `pdf-lib` post-processing to add actual PDF
  link annotations, including mapping each case row to its rendered coordinates —
  nontrivial, not started. Not worth the implementation risk this close to submission.

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

### 2026-08-08 — Retest-outcome card built (Results screen)

New card, `ResultsScreen`, rendered once right after the score-gauge reveal and
before the Fat Loss Readiness/Layer Breakdown cards — only when the current test
is a genuine retest (real prior `app_scores` data exists).

**Score delta — found and avoided a real race condition before writing any
UI.** `saveScore()` (`AppDataContext.tsx`) optimistically prepends the
just-completed test to `scoreHistory` synchronously, before `ResultsScreen` even
mounts — so by render time `scoreHistory[0]` is already the current test, not
the previous one. Using it as "previous" would have been a timing-dependent
assumption. Instead, `AppNavigator.handleScoreComplete` now captures
`scoreHistory[0]?.total_score` into a new `previousTotalScore` state **before**
calling `saveScore()`, and passes it to `ResultsScreen` as an explicit prop —
deterministic regardless of render/effect timing. Only passed on the live
`scoreResult` path, never the reconstructed-from-history one (viewing an old
result later), which is what makes the card "appears once, only right after a
genuine retest" rather than needing a separate visibility flag.

**Adherence — reused existing APIs, no new endpoints.** Same
`habitCycles.getMine()` / `checkins.listSince()` calls `StreakCalendarScreen`
already uses. Current cycle = active/extended row, falling back to the most
recently closed one (in case the Worker's cron already closed it by the time the
retest landed — the app has no way to know which happened first; the
closed-then-immediately-retested edge case with a brand-new near-zero-adherence
cycle isn't specially handled, wasn't in scope). Adherence count = completed
`app_checkins` bounded by the cycle's own `start_date`/`end_date` — not a
hardcoded 14, so it's correct for both normal (14-day) and extended (21-day)
cycles. `retestWindowDays` (the "N" in "last N days") is derived the same way
from the cycle's real span, per Amit's own catch: the locked copy literally says
"last 14 days," which would read wrong for an extended cycle if hardcoded.

**Branch logic (`buildRetestOutcomeCard`, new pure function near
`computePointsAvailable`)** — adherence gates first (below 10 of the window
makes the delta itself unreliable to read anything into), then delta once
adherence clears that bar: ≥+5 / +1 to +4 / 0 to −4 / ≤−5. All 5 messages are
Amit's exact locked copy (2026-08-08), each with `${adherence}`/`${windowDays}`
substituted in place of the literal "14." Only the two negative/flat-delta,
high-adherence branches (held steady, or regressed) get the "Talk to Amit" CTA,
linking to the same `onNavigate('booking')` flow used everywhere else in the
app — no new booking path.

**Visual:** same rounded-card style as the other Results cards. Delta shown
with an icon+color pair reused from `ProfileScreen`'s existing
"↗/↘ since last" trajectory indicator (`#22C55E` up / `#EF4444` down — matching
established precedent instead of inventing a new negative color), amber
(`colors.amber`, already used elsewhere on this screen) for exactly flat.
Adherence shown as a small pill badge next to the section label.

`npx tsc --noEmit`: still exactly 10 pre-existing errors, confirmed clean.
Nothing committed — staged only, pending Amit's review per rule 8.

### 2026-08-07 — Insights Hub tab + notification bell panel built; Today's 1% card removed from Home then fully restored same session (see correction below); last scoreResult→scoreHistory fallback gap closed

Continuation of the 2026-08-06 session (same overnight run, crossed midnight).

**Correction, same session:** the Today's 1% card removal described below was a
misreading of an ambiguous instruction — Amit's actual intent was only to remove
a genuinely separate, persistent leftover strip *if one existed distinct from the
card itself*. Investigated via direct diff against the last real commit before
touching anything again: no such separate strip existed — the pending state, the
complete state (checkmark/streak/X-dismiss), and the dismissed-to-`null` state
were always one single unit. So per Amit's own fallback instruction, this was a
full restore, not a partial one. Restored, verbatim from the pre-removal code:
`streak`/`actionDone`/`actionDoneFlash` state, the swipe-to-dismiss
(`dismissedToday`/`dismissX`/`dismissPanResponder`), the blink mechanism
(`todaysOneBlinkAnim`/`todaysOneRef`/`triggerTodaysOneBlink`/the
`highlightTodaysOne` effect), the `ms_action_done_dates` load effect,
`markActionDone` (incl. its `[DEBUG checkin]` log, kept for fidelity — not yet
cleaned up), `todayAction`/`actionRow`/`dayIndex`/`actionRevealText`, and the
full JSX card. Also restored: `AppNavigator`'s `goToTodaysOne`/
`highlightTodaysOne`, the `'home'`/`'profile'` prop pass-throughs, both
`HomeScreen` cascade `onWorkOnThis` sites (→ `triggerTodaysOneBlink`), both
`ProfileScreen` cascade sites (→ `onGoToTodaysOne`), and the push-notification
tap listener's `checkin_reminder`/`streak_milestone` routing (→ `goToTodaysOne()`,
reverted from the interim `streak-calendar` redirect). One deliberate net-new
piece, requested explicitly this time rather than assumed: the notification bell
panel's own row-tap handler (`handleSelectNotification`, new this session, not
part of the original pre-removal code) now also calls `triggerTodaysOneBlink()`
for those two types instead of navigating to the Streak Calendar — since the
panel opens from Home already, no navigation is needed, and this keeps the bell
panel and the push listener landing on the same place for the same notification
types. `npx tsc --noEmit`: still exactly 10 pre-existing errors after the full
restore, confirmed clean. The Streak Calendar screen itself, its "View streak
calendar →" link from the restored card, the Insights Hub's own "Today's Habit"
card, and everything else described below (Insights Hub, notification bell panel
build, the `getLayerSignal` fix, the Points Available restyle) are unaffected —
this correction only reverted the strip-removal piece.

**Insights Hub (`InsightsHubScreen`, new) — bottom-nav "Layers" tab renamed
"Insights" (icon → `bulb`).** 4 cards: 5 Layers (icon row, dominant-layer
highlight, taps through to the original full breakdown — kept intact as
`LayersHubScreen`, only its own `BottomNav active` value changed so the Insights
tab stays highlighted), Today's Habit (own `computeStreak()`-derived streak, taps
to the Streak Calendar), Points Available (restyled this session — see below),
Coming Soon placeholder. Has its own empty state pre-first-test.

**Notification bell panel (`NotificationBellPanel`/`NotificationRow`, new) on
Home** — `Modal`-based, reads `notification_log` (client-side `SELECT` only,
never written by the app — see `grant_notification_log_table_access.sql`, same
missing-GRANT bug class hit 3x already 2026-08-06, caught proactively this time).
65% width, top-right anchored, translucent `${colors.card}E6` background (chosen
over real `expo-blur` to avoid a third un-rebuilt native dependency). Per-row X
button, swipe-to-dismiss, "Clear All," 7-day count badge on the bell icon (caps at
"9+"). Tap routes: `checkin_reminder`/`streak_milestone` → Streak Calendar,
`retest_reminder` → score screen.
- **Bug fixed, same root cause as the Streak Calendar grid bug (2026-08-06):**
  panel text invisible / header wrapping — a percentage-width child of an
  absolutely-positioned parent with no definite width (`top:0,right:0`, no
  `left`). Fixed the same way: `top:0,left:0,right:0` on the parent,
  `alignSelf:'flex-end'` on the child.
- `dismissedNotifIds` was resetting on every tab switch — confirmed root cause
  (not hypothesized): this app's screens fully unmount/remount on every
  navigation (documented architecture fact, not new). Fixed by lifting
  `dismissedNotifIds`/`markNotifDismissed` into `AppDataContext` (persists across
  navigation, resets only on identity change like the rest of that context).
- **Still open, not resolved this session:** swipe-to-dismiss still has a
  temporary `[DEBUG notif-swipe]` diagnostic log in `NotificationRow`, pending a
  real device test. A temporary yellow `backgroundColor` diagnostic was also left
  on the empty-state `Text` — outcome not yet confirmed on device. Both need
  removing once verified.

**Today's 1%/streak strip removed from Home entirely** — now redundant with
Insights' own "Today's Habit" card, which routes to the same Streak Calendar
where the actual mark-as-done/streak UI lives (today's grid cell there does the
same completion action the strip's "Mark as Done" button used to). Removed
`HomeScreen`'s pending/complete-state card, swipe-dismiss, blink animation, and
"View streak calendar →" link, plus all its backing state
(`streak`/`actionDone`/`actionDoneFlash`/`dismissedToday`/`todaysOneBlinkAnim`/etc.)
and the dedicated `goToTodaysOne`/`highlightTodaysOne` plumbing that existed only
to jump to and blink that card (`AppNavigator`, `ProfileScreen`, the push-tap
listener, both `HomeScreen` `CascadeVisualization` "Want to work on this?" call
sites). Every former caller now just calls `onNavigate('streak-calendar')`
directly instead — simpler than keeping a dedicated callback alive for a target
that no longer needs special-casing. `ProfileScreen`'s two
`CascadeVisualization` call sites (its own "Want to work on this?" cascade cards)
updated the same way, since they'd been left referencing the now-removed
`onGoToTodaysOne` prop.
- Possible follow-up, not done: `HOME_SECTIONS`/`'daily-focus'` entry (likely
  `src/data/appData.ts`, referenced by `CustomizeHomeScreen`) toggled the now-gone
  strip and is probably orphaned — not cleaned up, wasn't explicitly requested.

**Points Available card (Insights Hub) restyled to match Results screen's "Fat
loss resistance & potential" card exactly** — same rounded card treatment,
green accent color/label row, `+N points... over N weeks` framing, supporting
sentence. Previously had its own different, plainer treatment (2026-08-06's
"Minor follow-up" item, now closed).

**Last fallback-pattern gap closed:** the same `scoreResult ?? scoreHistory[0]`
fallback already applied throughout (Metabolic Score, Metabolic Story, 5 Layers,
Latest Insights, Case Studies, cravings, symptoms) had missed one field —
HomeScreen's `getLayerSignal` (the "Your Signal" quote under 5 Layers, e.g. "I
feel constantly on edge even when nothing is wrong") was still reading only live
`scoreResult.history`, so it went blank after sign-in without retaking the test
this session. Fixed to read `scoreResult?.history ?? latestHistory?.answers`,
consistent with the established pattern rather than a new approach. **Scope
note:** the Insights Hub's own "5 Layers" card doesn't show a per-layer signal
quote at all (more compact design than Home's) — nothing to fix there, the fix
only applied where the field actually exists (Home).

`npx tsc --noEmit`: still exactly 10 pre-existing errors (7 `ImageSourcePropType`,
3 craving/insight union types) after this whole batch — confirmed clean, nothing
new introduced. Nothing committed — staged only, pending Amit's review per rule 8.

### 2026-08-06 — PDF footer bug closed; full push notification engine + habit cycle
engine built, deployed, and device-tested; multiple real production bugs found and
fixed via evidence-based investigation, not guesswork

**Scope note:** this session ran morning through ~3:45am, spanning PDF debugging,
extensive planning/strategy discussion (business trajectory, brand/data/IP moat
sequencing, Cursor vs. Claude Code division of labor), and then a long, iterative
build-test-fix cycle on the notification and habit-cycle systems. Far exceeded the
original 4-6 session estimate for "push notifications" — grew substantially through
the session as real gaps surfaced during actual device testing, not scope creep for
its own sake. Each addition below was a genuine finding, confirmed with evidence
before being fixed.

---

#### 1. PDF footer positioning bug — CLOSED

Root cause confirmed via direct PDF coordinate extraction (not source-reading alone,
which had already failed twice in prior sessions): `translateContent()`'s shift was
still active when the footer's `drawText()` calls executed immediately after it,
double-applying the offset. Fixed by compensating the three footer y-coordinates
(`y - FOOTER_BAND`). Verified via fresh PDF export + coordinate re-extraction —
overlap gone, footer correctly positioned. **Resolved and confirmed, not just
patched.**

#### 2. Push Notification Engine — BUILT, DEPLOYED, DEVICE-CONFIRMED WORKING

**Supabase:**
- New tables: `app_checkins`, `actions`, `notification_log`
- New columns: `app_profiles.expo_push_token`, `app_profiles.push_token_updated_at`
- `actions` table populated: all 5 layers (L1-L5), each with a 7-day teaser/reveal
  content cycle (`copy_variants` as `[{teaser, reveal}, ...]`), locked-copy final
- **Recurring bug class hit 3 times tonight:** tables created with RLS policies but
  missing table-level `GRANT` statements for `authenticated`/`service_role` — same
  root cause as the 2026-07-27 `app_profiles`/`unmatched_payments` incident,
  recurring on every new table created since. Fixed for `app_checkins`, `actions`,
  and (proactively, this time) `habit_cycles`. **Repo migration files exist for
  `actions` (`grant_actions_table_access.sql`) and `habit_cycles`
  (`create_habit_cycles.sql`); `app_checkins`'s grant fix was applied directly in
  Supabase, not via a migration file in the repo — worth adding one so it's not
  the one exception if this class of bug needs auditing again later.**

**Cloudflare Worker (`metabolic-app-notification`):**
- Deployed via Cloudflare dashboard "Edit code" (not wrangler CLI — see Process
  Notes below)
- Cron trigger: `0 15 * * *` (15:00 UTC = 8:30pm IST daily)
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret key, not
  publishable — this distinction caused real confusion mid-session, now correct)
- Logic: retest window (day 9/14) → habit cycle evaluation (new, see §3) → streak
  milestone → check-in reminder, max 1 push/user/day
- **Real bug found and fixed:** `pickCheckinContent()` — the function meant to pull
  personalized day-of-cycle content into push notifications — never actually
  existed in the deployed code, despite a comment implying it did. Every check-in
  reminder was silently sending generic fallback copy. Built for real this session;
  confirmed on-device with correct personalized L3 content in the actual push
  notification.

**App-side (`App.tsx`, `supabase.ts`, `AppDataContext.tsx`):**
- Push token capture wired into `OnboardingScreen.handleComplete` + `ProfileScreen`
  manual toggle (shared function, fixed missing `projectId` in the old version)
- Notification-tap deep-link routing: `checkin_reminder` → `goToTodaysOne()`,
  `retest_reminder` → score screen. Handles both warm/background taps and cold-start
  taps. (`streak_milestone` originally also routed to `goToTodaysOne()` here — corrected
  2026-08-07 to route to the Streak Calendar screen instead, once that screen existed,
  matching the bell panel's own tap routing built the same night.)
- **Bug fixed:** cold-start taps were double-firing routing (both
  `addNotificationResponseReceivedListener` and `getLastNotificationResponseAsync()`
  independently triggered the same action) — deduped via notification identifier.
- **Bug fixed:** `logCheckin`/`checkins.markDone()` write to `app_checkins` was
  silently failing (missing grants, see above) with zero surfaced error — matches
  the exact "console.warn-only, nothing surfaced" pattern already documented
  elsewhere in this codebase.
- **Bug fixed, structural:** `logCheckin`/`logCheckinUndo` returned `Promise<void>`,
  giving callers no way to know if a write actually succeeded — both `HomeScreen`
  and the new `StreakCalendarScreen` were updating local/AsyncStorage state
  optimistically *before* confirming the write. Now return `Promise<boolean>`;
  both callers gate the optimistic update on actual success and show
  `Alert.alert("Couldn't save", ...)` on failure instead of silently proceeding.
  Fixed in both places since they shared the identical gap.

#### 3. Habit Cycle Engine — SPEC'D, BUILT, DEPLOYED, DEVICE-CONFIRMED

New subsystem (`Habit_Cycle_Engine_SPEC.md`, in repo) — makes a "cycle" a real
tracked entity (`habit_cycles` table: start_date, end_date, status) rather than
derived math, so users who never retest have a defined path back to a fresh cycle.

- **State machine:** active → (day 14, no retest) → branches on adherence:
  ≥10/14 = push retest now; 5-9/14 = extend 7 days, push retest at day 21
  regardless; 0-4/14 = close as reset, immediately open a fresh cycle. Day 21 is a
  hard stop on the extended tier — pushes retest either way, no further extension.
- Cycle bootstrap/evaluation **decoupled from push-token possession** (bug found
  and fixed: was only running for push-token holders, meaning anyone who never
  enabled notifications got no cycle data at all — now runs for anyone with a
  completed test; only the actual notification *send* stays token-gated).
- **New Streak Calendar screen** (`StreakCalendarScreen`, reached via "View streak
  calendar →" link on the existing Today's 1% card, which itself is unchanged):
  14-day grid, 4 cell states (done / done-tap-to-undo / missed-tap-to-mark /
  locked), 2-day toggle-editable window in both directions, points-available card,
  dynamic motivational message, cycle summary, collapsible past-cycle history
  cards.
  - **Bug fixed:** grid rendered days sequentially from a fixed visual position
    instead of aligning to real weekday columns — `start_date` always appeared
    under "M" regardless of actual weekday. Fixed with a leading-blanks offset
    based on real weekday calculation.
  - **Bug fixed:** calendar's tap-to-mark passed a hardcoded `null` for
    `assigned_action_id`, violating the column's NOT NULL constraint on every
    attempt (not intermittent). Fixed by computing `dominantLayerId` on this
    screen (mirroring Home's existing fallback chain) and fetching the real
    action row before writing.
  - **Points-available bug fixed:** calendar was computing its own flat
    `100 − score` value, diverging from the Results screen's real, more specific
    calculation ("+34 points may be available over 8-12 weeks," tied to fat loss
    resistance/recovery capacity). Refactored into one shared
    `computePointsAvailable()` function; both screens now show identical
    value and framing. (Minor follow-up still open: card styling doesn't yet
    visually match Results screen's weight/color — see Next Session below.)

#### 4. Process notes — worth remembering going forward

- **All Worker code changes must go through Claude Code + the repo — never pasted
  directly from this chat into Cloudflare's dashboard**, even for a quick fix.
  Doing this mid-session created two silently diverging copies of the same file
  (one live on Cloudflare via manual paste, one in the repo via Claude Code),
  which directly caused the `pickCheckinContent()` confusion in §2 — Claude Code's
  investigation was accurately reporting on the repo's version, which genuinely
  never had that function, while an ad-hoc pasted version briefly live on
  Cloudflare did.
- **`wrangler deploy` is not configured for the notification Worker** in this repo
  — running it from the project root auto-detects and tries to deploy the entire
  Expo app as a static Cloudflare Pages site instead (wrong target entirely).
  Deploys for `metabolic-app-notification` go through the Cloudflare dashboard's
  "Edit code" → paste → Deploy flow until/unless a proper `wrangler.toml` gets set
  up for it specifically.
- When copying Worker code out of a PowerShell terminal for review, long lines get
  silently truncated/wrapped — caused an apparent-but-false "incomplete file"
  scare mid-session. Safer to open the file directly in a text editor, or have it
  uploaded directly, rather than copying from terminal scrollback.

**Scoped for next session (nothing below is started):**

1. **Bell/inbox notification sync** — architecture agreed (reads from
   `notification_log`, no new writes needed), full brief written, never sent/built.
2. **Retest-outcome card** (Results screen) — fully spec'd (5 branches by
   adherence + score delta, all copy finalized), not started. **Built 2026-08-08,
   see that session's entry near the top of this log.**
3. **Completion-UX redesign for "Mark as Done"** — real design gap identified:
   current checkmark-based interaction borrows diagnostic/form-entry visual
   language for what should be a habit-reward moment. Three concrete directions
   agreed, not yet built:
   - Motion/fill animation on completion instead of a static state swap (highest
     leverage, lowest effort)
   - Identity-framed micro-copy at the completion moment specifically (not a
     full rewrite of app language)
   - Milestone completions (day 3/7/14/30) should visually scale in significance,
     not look identical to a routine day
   - Explicitly ruled out: leaderboards, competitive framing, streak-as-guilt —
     stays on the healthy side of habit design, consistent with existing
     non-punitive streak-break copy.
4. **Points-available card styling** on the Streak Calendar — number needs to
   visually match Results screen's weight/color (currently correct value, wrong
   visual treatment).
5. **Known edge case, not urgent:** "today" is computed differently in different
   places relative to the UTC/IST boundary (midnight-5:30am IST window where the
   server's UTC date and the device's local calendar date disagree) — worth a
   consistency review across Worker and app, not causing active problems.
6. **Android** — deliberately deferred entirely; iOS-only testing so far.
7. **Git/documentation hygiene** — tonight's changes need `git add` / commit /
   push (multiple batches were staged but not committed across the session) and
   this summary needs to actually land in CLAUDE.md, not just exist as a draft.
8. **Sentry error tracking — wizard completed successfully** (run manually,
   outside Claude Code, after the wizard proved impossible to drive through
   Claude Code's sandboxed terminal — no real TTY, crashed with
   `ERR_TTY_INIT_FAILED` even with `--non-interactive`; see prior turn's notes if
   this recurs). `Sentry.init()`/`Sentry.wrap()` added to `App.tsx`, `@sentry/
   react-native/expo` config plugin added to `app.json`, `metro.config.js`
   created, `SENTRY_AUTH_TOKEN` correctly isolated to `.env.local`
   (git-ignored, verified via repo-wide grep — not hardcoded anywhere else).
   **Not yet device-tested** — needs a fresh EAS build since it's a new native
   module (same category as `expo-notifications`).
   **Before that first real test — required, not optional:** the wizard's
   default `Sentry.init()` config actively risks capturing personal health
   data, confirmed via diff review, via three separate mechanisms, not just
   one: `sendDefaultPii: true` (IP/cookies/user id), `enableLogs: true` (would
   likely capture this app's existing `console.log` statements, several of
   which already log emails/user ids/symptom data directly — `[saveProfile]`,
   `[DEBUG symptom]`, `[DEBUG checkin]`), and Session Replay
   (`replaysSessionSampleRate`/`mobileReplayIntegration()` — screen-recording
   style, default masking behavior not yet verified against current Sentry
   docs). A `beforeSend` hook to scrub symptoms/scores/quiz answers from
   error payloads must be added and verified before any real event is ever
   sent — not a nice-to-have, a precondition for the first device test.

#### Addendum — Sentry crash reporting set up (PHI-safe), item 8 above now complete

**Sentry error/crash tracking — CONFIGURED, NOT YET DEVICE-TESTED.**

- Set up via the official Sentry wizard (`npx @sentry/wizard@latest -i reactNative`),
  run manually in a real terminal (Claude Code's sandboxed environment can't render
  the wizard's interactive confirm() prompts — hits `ERR_TTY_INIT_FAILED`; this is a
  known environment limitation, not a wizard bug. Worth remembering for any future
  CLI tool requiring interactive prompts).
- Correctly detected as an Expo/EAS managed project — added `@sentry/react-native/expo`
  to `app.json`'s plugin array, did NOT touch native android/ios folders (there are
  none to touch in this managed setup; confirmed live via wizard output: "Detected
  Expo Continuous Native Generation (CNG) setup. Skipping native files patching").
- Auth token written to `.env.local`, confirmed git-ignored — not hardcoded in
  `app.json` (which would ship inside the app bundle, readable at runtime).
- **PHI-scrubbing `beforeSend` hook built and staged** — `scrubSentrySensitiveData()`
  recursively walks the full event payload and redacts any key matching a name list
  (symptoms, conditions, goals, baseline, mini_quiz, all app_scores fields including
  variable names like `sc`/`scoreResult`/`rcsInfo`/`patternEngine`/`cascade_risk`,
  craving fields, email, full_name, expo_push_token) — name-based, not path-based, so
  it survives future refactors rather than needing updates every time internal
  structure changes.
- **Two additional leak points found and closed, beyond the original ask** — both
  bypass `beforeSend` entirely, so neither would have been caught by the scrubber
  above on its own:
  1. `enableLogs` auto-captures every `console.*` call through Sentry's structured
     Logs pipeline, which never touches `beforeSend` at all. Closed via
     `beforeSendLog`, which drops every auto-captured console log outright.
  2. Sentry's separate, older breadcrumb-capture mechanism also records console
     output (as `category: 'console'` breadcrumbs) independent of the Logs
     feature above. Closed via `beforeBreadcrumb`, dropping console breadcrumbs at
     creation — belt-and-suspenders with a matching filter also left in
     `beforeSend`'s own breadcrumb handling.
- **Session Replay: DISABLED for now** (`replaysSessionSampleRate: 0`,
  `replaysOnErrorSampleRate: 0`) — a documented, unresolved masking bug exists on
  Android (sentry-react-native#6122, safe-direction failure mode but unverified fix),
  and this app's screens (Profile, Symptom Tracker, Layers, Home) are unusually
  sensitive. Mask settings (`maskAllText: true`, `maskAllVectors: true`) left
  hard-set in the code for whenever Replay gets re-enabled later, with reasoning
  documented inline — don't need to re-derive this next time.
- **Not yet done:** first real device test. `Sentry.captureException` requires a
  fresh EAS build (native module, same category as `expo-notifications` earlier
  this session) — the dev client currently on-device doesn't have it compiled in.
  The `beforeSend`/`beforeSendLog`/`beforeBreadcrumb` review was completed *before*
  any real event has been sent — no live data has touched Sentry's servers yet,
  which is exactly the right order.

**Next session, in order: build → install → tap the wizard's test button → confirm
in Sentry dashboard → confirm scrubbing actually worked on a real payload (check
that no symptom/score/PII data appears in the captured event).**

---

#### App icon / logo — PARKED, not urgent

Explored several directions tonight (5-layers-as-rings concept, matching the "5
Layers of Metabolic Permission" brand). Landed on: dark background, ring shape
paired with a letter (M or MS), inspired structurally by ZEE5's ring+wordmark
icon — but staying to a single deep monochrome red-to-maroon tone rather than
multiple colors (multi-color felt distracting/less professional on review).

**Real finding from testing at actual app-icon scale (~56px, in a realistic home
screen grid mockup):** the 5-ring detail blurs into a soft glow at that size —
only the deep tone and the letter actually read clearly at true size, not the
ring count itself. This is normal for detailed icons at small scale, not a flaw
specific to this design.

**Open decision for next time:** whether the *tiny app icon* should be a
simplified, bolder 2-3-ring version optimized for legibility at true size, while
the full detailed 5-ring version is reserved for contexts with more room (splash
screen, website header, About page). Also still undecided: "M" alone (cleaner,
more legible small) vs. "MS" (more literal, slightly busier at small size) —
current lean is toward "M" as the primary app icon.

Deliberately not pursued further tonight — parked for a fresh, unhurried design
session rather than rushed at the end of a long night.

### 2026-08-04 (cont'd 2) — Footer positioning still broken on device; root-cause investigation inconclusive, logged honestly rather than guessed

**Confirmed working:** headline font size (14px), `app_report_downloads`
tracking, pdf-lib footer-on-every-page approach structurally sound (footer
and page numbers now appear on every page).

**Root cause investigation, inconclusive — logged honestly, not guessed:**
- Original hypothesis (footer drawn at pre-resize y-coordinates) was checked
  against `@cantoo/pdf-lib`'s actual source and does NOT match documented
  behavior — `setSize()` preserves the page's `y=0` origin, `translateContent()`
  shifts existing content up, so the footer's unchanged `y=16-38` coordinates
  should already land correctly in the new bottom gap. This hypothesis was
  disproven, not confirmed — do not treat it as the cause.
- Two follow-up hypotheses (CropBox/TrimBox clipping on either platform; a
  `@cantoo/pdf-lib` fork deviation from upstream) were both investigated and
  ruled out via direct source inspection of expo-print's native renderers
  (iOS: `ExpoWKViewPrintPDFRenderer.swift`, ends up with MediaBox only, no
  separate CropBox; Android: `PrintDocumentAdapter` with `NO_MARGINS`, same) and
  the fork's changelog (no changes to page-geometry methods).
- Net result: per all available static-code investigation, the footer
  SHOULD be positioned correctly. It is not, confirmed on device. The actual
  cause is unknown — needs either a fresh on-device retest with more precise
  observation of exactly where the blank gap sits relative to the footer
  text/content (e.g. is the gap above the footer, between the footer and the
  last line of real content, or duplicated somewhere — rather than assuming
  it's simply "outside" the blank band), or direct inspection of the
  generated PDF's raw page content stream (not possible without device/PDF-
  inspection tooling in this environment).

**Next session: do not re-guess a root cause from source-reading alone —
this has been tried twice and failed. Get precise on-device visual evidence
first (exact gap position), or extract/share the actual generated PDF's raw
content for direct inspection.**

### 2026-08-04 — About Amit Baruna PDF section + repeating footer built; three visual polish passes; iOS background-drop bug found and fixed in 5 more PDF elements

**About Amit Baruna closing section + repeating footer built** (`App.tsx`,
`buildReportHtml`/new `buildAboutSectionHtml`):
- New `getHeroPhotoBase64()` helper — `Hero.png` moved to
  `src/assets/about/hero.png` (same bundled-asset convention already used by
  `profile.pdf`/`mystory.png`), read via the new `expo-file-system` dependency's
  `File.base64()` API and embedded as a `data:` URI directly into the PDF's HTML.
  Deliberately never referenced by a rendered RN `Image` component — the photo
  must never appear anywhere in the live app itself, only in the exported PDF.
- New coral (`#F5C4B3`) card: circular photo, bio copy, three credential tags
  (`ABOUT_STATS.years`/`ABOUT_STATS.clients` reused rather than hardcoded, plus a
  static "Featured in Indian Express" string) — the report's final numbered
  section, directly above the disclaimer.
- Footer (`<tfoot>`) extended with WhatsApp (+91 98918 28688) and
  metabolicscore.in alongside the existing amitbaruna.com/Instagram line. Added a
  `@page`/`counter(page)` "Page X of Y" rule — flagged from the start as an
  on-device risk, since expo-print's iOS path renders through WKWebView/Safari's
  print engine, which only recently added `@page` margin-box support.

**Three visual polish passes, same session:**
- Section headline (`h2`) size increased 14px→18px; section-to-section vertical
  spacing increased 20px→36px.
- Real Cases rows: since clickable links don't survive PDF export (documented
  limitation), each case now shows its existing `hook` field (a short
  testimonial quote already used elsewhere in the app) as a plain-text
  description under the result/layer text — no new data added.
- One correction mid-session: the top title block (`.brand`/`.title`) was never
  actually touched by any of the above — confirmed via investigation that the
  "reading too large" report was about the section headlines, not the title, so
  no title-size change was made.

**iOS background/background-image bug — found and fixed in the 5 PDF elements
missed when bars/badges/thumbnails were originally converted (2026-08-03):**
- `.header` (main navy header block) and `.band-badge` (dynamic inline
  `style="background:..."` for the score band) — both converted to an SVG
  `<rect>` fill layered behind the actual text via a `position:absolute` SVG +
  `position:relative` content wrapper, keeping the exact same colors (`#0D1B2A`
  navy, `reportData.band.color`). `.band-badge` needed a new
  `buildBandBadgeSvg()` helper since `band.status` text length varies too much
  ("Well Regulated" vs. "Significant Metabolic Impairment") for the existing
  fixed-width `buildBadgeSvg`.
- A follow-up sweep (grepped the whole file for `background:`/`background-image:`)
  found three more instances missed the first pass: `.about-card` (coral),
  `.about-tag` (white pill), `.disclaimer` (light-gray box) — all fixed the same
  way. `.about-tag` needed its own `buildTagSvg()` helper (dynamic-width text
  pill, same estimate-from-character-count approach as the band badge, since no
  real text-metrics API is available in this string-building context).
- `tsc --noEmit` stayed at the same 10 pre-existing, unrelated errors (Image prop
  types, craving/insight union types) after every edit this session — confirmed
  after each change, nothing new introduced.

Nothing in this session was staged or committed — per rule 8, pending Amit's own
review. See the entry directly below: all of the above was confirmed working on
a real device the same day.

### 2026-08-04 (cont'd) — PDF report feature closed out: final device-confirmed pass on today's build, including the About section and all iOS background-fill conversions

**Device-confirmed working, final test passed:**
- About Amit Baruna section (photo, bio, three credential tags, coral card
  background) — confirmed rendering correctly on device.
- Header, band badge, and all other converted background-color elements —
  confirmed correct color now rendering on iOS after the SVG-fill conversion.
- All 5 instances of the CSS background/background-image iOS bug (.header,
  .band-badge, .about-card, .about-tag, .disclaimer) — confirmed fixed and
  verified on real device, not just in source.

**Still not explicitly re-confirmed in this final pass, carry forward if
revisited:**
- Footer repeating on every page (built via thead/tfoot, not explicitly
  re-verified in the final device test).
- "Page X of Y" counter — known risk (CSS counter(page) inside @page margin
  box, unreliable on WKWebView) — not explicitly re-confirmed working or
  broken.
- app_report_downloads tracking row after the GRANT fix — not explicitly
  re-confirmed in the final test.

This closes out the PDF report feature build (download button, cascade
grammar bug, N1 determinism bug, visual redesign, About section, footer, iOS
rendering fixes) as functionally complete for v1.0, with the three items
above worth a quick spot-check next time the PDF is opened, but not
blocking.

### 2026-08-03 — PDF Report export built end-to-end (expo-print + click tracking); Cascade Map added to the PDF; cascade narrative root-layer bug found and fixed at the source

**Device-confirmed:** the N2 "Hidden Mechanism" infinite-loading fix from 2026-08-01
(reconstructScoreResultFromHistory now setting `hl`) is showing correctly on device —
no longer stuck on "Reading your biological pattern...".

**"Download PDF Report" button built (previously a non-functional placeholder, no
onPress handler at all):**
- Added `expo-print` (first-party Expo module, no native-linking risk beyond what
  `expo-dev-client` already requires). Chose it over reusing `react-native-view-shot`
  (zero new deps, but produces an image not a real PDF, and can't cleanly capture a
  scrollable page's full height) and over `react-native-html-to-pdf` (bare native
  module, heavier maintenance lift).
- Click-tracking: new `app_report_downloads` table (migration written, **run manually
  by Amit in Supabase**) — `reportDownloads.log()` in `supabase.ts` →
  `logReportDownload()` in `AppDataContext.tsx`, mirrors the existing `nps` pattern
  exactly (client-writable insert + self-select RLS, silent `console.warn` on failure,
  never blocks the actual PDF generation).
- `buildReportHtml()` (`App.tsx`) — new standalone HTML-template function mirroring
  ReportScreen's on-screen sections 1-6 (Score Summary, Layer Breakdown, N1/N2/N3, Case
  Studies) plus disclaimer/footer, since `expo-print` can't render the RN component tree
  directly. Craving Patterns / Symptom Timeline (sections 7-8) deliberately excluded —
  they're live context data, not part of the report snapshot. Button now: logs the
  download, calls `Print.printToFileAsync({ html })`, then `Sharing.shareAsync` with a
  loading state and error `Alert`.
- **New "Cascade Map" section added to the PDF** (after Layer Breakdown, renumbering
  N1/N2/N3/Case Studies below it) — one static SVG diagram + narrative per detected
  cascade (all of them, not just the top-ranked). Confirmed first via read-only
  investigation that `CascadeVisualization`'s end-state node layout is fully
  deterministic from `cascadeRisk`/`dominantLayer`/`sc` (fixed `NODE_LAYOUT` fractions +
  a pure Bézier `curvePath` formula) — `Animated` only drives cosmetic transitions
  (bounce, glow, line draw-in), never final position/state — so no animation runtime
  was needed to build a static equivalent. `buildCascadeItems` (the cascade
  ranking/narrative logic) was extracted out of `CascadeVisualization`'s `useMemo` into
  a standalone function so the live on-screen view and the new PDF path share one
  source of truth instead of duplicating it. `buildCascadeSvg()` reuses the same
  `NODE_LAYOUT`/`curvePath` math directly.

**Bug found (via the new Cascade Map narratives surfacing it) and fixed —
pre-existing, not introduced today, affected the live app too:**
`generateDominoEffect` (`src/data/localNarratives.ts`) was passing the user's overall
`dominantLayer` into `translateCascadeToUserLang` as if it were the *picked cascade's
own* root layer — correct for ranking (`rankCascadeStrings`) but wrong for translation
whenever the dominant layer is a cascade's downstream victim rather than its cause
(e.g. dominant layer = Metabolic Signaling/L3, but the picked cascade is "L2 → L3" —
root should read as L2, not L3). Produced broken/inverted phrasing like "Your how your
body manages energy may be putting pressure on your stress response system." Fixed by
deriving `rootLayer` from the picked cascade string itself (first `L#` mentioned is
always the actual cause, per every pattern in `buildCascadeRisk`), leaving the ranking
call untouched. Since `buildCascadeItems` is now shared between the on-screen Metabolic
Story and the PDF, this fixes both surfaces at once, at the source.

**Still open — carry forward:**
- The actual PDF button tap (generate → share sheet) has not yet been confirmed on a
  real device — only the N2 fix specifically has been device-tested today. Attempted to
  start `expo start --tunnel` for broader testing but the session moved on to the
  read-only cascade investigation instead; dev server was not left confirmed running.
- Everything else still open from 2026-08-01 (Download PDF Report scope is now built,
  so that item is superseded by this entry; sleepScore/stressScore/gutScore hardcoded
  5/5/5 defaults remain open, unrelated to today's work).

### 2026-08-01 — Fat Loss Resistance banner replaced with plain-language description; N2 "Hidden Mechanism" infinite-loading bug fixed at the shared reconstruction helper

**Also fixed and device-confirmed today:**
- Removed the redundant "Metabolic Signaling may be why fat loss has felt
  stuck..." banner from ResultsScreen (App.tsx:2918-2926) — was hardcoded,
  duplicated N1's actual content. Replaced with a new plain-language
  description ("While your Metabolic Score shows how your body is functioning
  overall — Fat Loss Readiness goes one layer deeper...") in the same position,
  scoped to ResultsScreen only (initially also added to Home's expanded card,
  then deliberately removed from there per follow-up decision — Home should
  only show N1's real narrative, not this framing text). Given visual emphasis
  (tinted background, bolded key phrase) matching the removed banner's original
  styling weight.
- Fixed N2 ("Hidden Mechanism") permanently hanging on "Reading your biological
  pattern..." in the reconstructed-from-history path — root cause was
  reconstructScoreResultFromHistory never setting .hl (hidden layer indices:
  SLI/BRI/GSI/SYLI), so generateLocalN2 threw synchronously on
  result.hl.sliClass being undefined, silently killing the loading state
  permanently. Fixed at the shared helper (added hl via computeHiddenLayer,
  same 5/5/5 sleep/stress/gut defaults already used elsewhere for unpersisted
  values) rather than patching ResultsScreen individually — this also let us
  remove ReportScreen's redundant duplicate computeHiddenLayer call, since it
  now gets hl for free from the shared helper. Fixes this bug class for every
  current and future caller of reconstructScoreResultFromHistory, not just
  this one screen.

**New carry-forward items found today, not yet fixed:**
- ReportScreen's "Download PDF Report" button (App.tsx ~line 6550) has no
  onPress handler at all — confirmed via read-only investigation that no PDF
  generation code (no expo-print, no HTML-template path) exists anywhere in
  the repo. It's a non-functional placeholder; no PDF has ever actually been
  generated by tapping it. Needs either a real implementation or the button
  hidden/disabled until built.
- sleepScore/stressScore/gutScore are hardcoded to 5/5/5 defaults in both the
  live scoreResult path and the reconstructed path (confirmed pre-existing,
  not introduced by today's fixes) — narratives never reflect a user's actual
  answers to these. Worth considering whether these should be persisted per-
  assessment the same way layer1-5 and rcs already are, given the data-moat
  plan depends on accurate longitudinal signals.

**Next session priority order (agreed, not started):**
1. Broken "Download PDF Report" button — likely small once decided (build
   real handler vs. hide until built)
2. Profile name-*editing* scope investigation (today only confirmed display
   works via centralized full_name — no UI exists to change it)
3. activity_level feature design decision (values, collection point, whether
   it feeds scoring — not yet decided)
4. Baseline migration build (age/height/weight flat columns — scoped clean
   2026-07-30, not yet built)
5. Habit streak feature (fully specced 2026-08-01: app_checkins table,
   check-in = "Today's 1%" tap only, 2-day backfill limit, Week 1/Week 2
   display tied to 14-day retest cycle, points-available reframing on tap —
   deliberately deferred as its own session given size)
6. personaltraining9891's Google sign-in hang — still needs live-captured
   terminal output during an actual hang, not diagnosable from memory, cannot
   be forced on demand

### 2026-07-31 — Cascade persistence restored end-to-end (Home, Results, Layers); greeting fixed; baseline/activity_level architecture decisions finalized

**Fixed and device-confirmed today, all committed:**
1. **`cascade_risk`/`dominant_layer` now persist on `app_scores`** — write path in
   `handleScoreComplete`, read path in both `scoreHistory` mapping sites plus `saveScore`'s
   local entry, type additions to `ScoreHistoryEntry`. Restores the real Metabolic Story
   animation (via `reconstructScoreResultFromHistory`) after sign-in without a fresh test —
   previously fell back to only a lightweight summary card.
2. **Score-summary card's "Fat Loss Resistance" expanded section** now works off
   reconstructed data too — needed `patternEngine.dominant_pattern` added to the
   reconstruction helper.
3. **Results screen ("Read full analysis" link) crash fixed** — was throwing
   `TypeError: Cannot read property 'status' of undefined` in the reconstructed-from-history
   path. Fixed by adding `totalScore` and `band` to `reconstructScoreResultFromHistory`'s
   return value, and wiring the results screen's router case to use a reconstructed object
   when live `scoreResult` is null.
4. **Home's 5 Layers swipe pad, Latest Insights, and Case Studies** were silently falling
   back to static/default order (no personalization) in the reconstructed path — fixed by
   wiring the shared `layerScores` variable to fall back to the already-existing
   `fallbackLayerScores` local instead of `{}`. Also wired `getLayerSignal`'s "Your signal"
   quote to the same fallback.
5. **Standalone Layers tab (bottom nav)** had the identical gap — same fix pattern applied
   (`useAppData()` for `scoreHistory`, `dominantLayerId` fallback).
6. **Home's Metabolic Story cascade circles** were showing numeric scores in Clinical Depth
   mode, icons in Simple mode — changed to always show icons in both modes, **on Home
   specifically**. Added an `alwaysShowIcon` prop to `CascadeVisualization`, default off,
   only passed at Home's two call sites — Profile's circles still show numbers in Clinical
   Depth mode, unchanged.
7. **HomeScreen's greeting was hardcoded to "Good morning, Amit"** regardless of actual time
   or signed-in account. Fixed: `full_name` centralized into `AppDataContext` (previously
   fetched independently and duplicated by `ProfileScreen` — that duplicate fetch removed),
   greeting now shows real time-of-day (morning/afternoon/evening) and the actual signed-in
   user's name; avatar initial fixed to match.
8. **`updateCraving` now mirrors `deleteCraving`'s failure handling exactly** — both a
   zero-match PATCH and a thrown exception leave local state untouched rather than silently
   applying an unconfirmed edit.

**Corrected/finalized architecture decisions** (from 2026-07-30, superseding earlier
inaccurate framing):
- `fat_deposition` was already a flat column, never in the `baseline` JSONB — no migration
  needed for it.
- `activity_level` does not exist anywhere in the app — it's a new feature to design
  (values, collection point, whether it feeds scoring), not a migration.
- Confirmed baseline migration scope: just `age`/`height`/`weight` from `BaselineEntry`, one
  writer (`setBaseline`), one reader/editor (`ProfileScreen`'s Baseline row), zero downstream
  dependencies. Low risk, not yet built.
- `BaselineEntry.age` (Profile, free-text) is unrelated to `UserData.age` (scoring-engine
  input, currently hardcoded, never collected from a real question) — same field name,
  different concepts, must not be conflated in future work.

**Still open — carry forward, not yet started:**
- Profile name-*editing* (today only fixed display, via centralized `full_name` — no UI
  exists yet to let a user change their name).
- Profile picture upload — explicitly deferred to v1.1.
- `personaltraining9891`'s Google sign-in intermittently hangs on code exchange — recurring,
  not just a one-off (upgraded from yesterday's "low priority, unreproducible" note). Needs
  live-captured terminal output during an actual hang, not diagnosable from memory — this is
  the priority evidence still missing.
- Pre-launch `scoreResult` audit — HomeScreen and Results screen are now fully covered, but
  ReportScreen and the standalone Library screen were named in the original audit request
  and never actually checked. Still needs doing before App Store submission.
- Baseline migration (age/height/weight flat columns) — scoped, not built.
- `activity_level` feature — needs design decision, not started.
- Score-summary card's expanded Fat Loss Resistance still has no fallback for
  pre-2026-07-30 historical rows (`cascade_risk`/`dominant_layer` null) — shows nothing for
  those, by design, not a bug.

### 2026-07-30 — updateCraving rollback fix device-confirmed; three architecture/product decisions logged; Google 2FA sign-in issue observed (not reproduced); v1.1 idea flagged

**Decisions made (not yet implemented in code):**
1. **Baseline architecture, resolved — scope corrected 2026-07-30 after auditing actual
   `baseline` JSONB usage in detail.** Migration scope is `age`/`height`/`weight` from
   `BaselineEntry` only, becoming flat `age`/`height_cm`/`weight_kg` columns on
   `app_profiles` — closes the open
   architecture question noted 2026-07-25. `age` stored as an exact integer, not banded —
   needed for flexible age-window filtering (e.g. "33–40") at query time. `weight_kg` is
   current-value-only; a full weight-history table is explicitly deferred to a future
   session alongside the planned Longitudinal app architecture work. Migration spec written,
   not yet run. Confirmed low-risk: one writer (`setBaseline`), one
   reader/editor (`ProfileScreen`'s Baseline row), zero downstream dependencies — no scoring
   engine, no reports, nothing else reads these fields.
   - **`fat_deposition` removed from this migration's scope** — it was never in the
     `baseline` JSONB to begin with. It's already its own flat column
     (`profileApi.updateFields(user.id, { fat_deposition: id })`, separate `setFatDeposition`
     function) — nothing to migrate.
   - **`activity_level` removed from this migration's scope** — it doesn't exist anywhere
     in the app currently (confirmed via grep, zero matches). Not a migration of existing
     data; it would be a new feature needing its own design pass (what values, where
     collected, whether it feeds the scoring engine) before any implementation. Tracked
     separately as an unscoped future feature decision, not bundled into the baseline
     column migration.
   - **Distinct from an unrelated same-named field, worth not conflating:**
     `BaselineEntry.age` (this migration's subject — free-text, entered in `ProfileScreen`'s
     Baseline row) is unrelated to `UserData.age` (a separate concept — scoring-engine
     input, currently hardcoded to the literal `'26–35'` everywhere it appears rather than
     collected from any real question). Same field name, different concepts, different code
     paths — future work on either must not conflate them.
2. **Stress-slider tie-break mechanism, confirmed working as designed.**
   `pickDominantLayer` uses SLI/GSI severity + cascade participation to break ties, not
   array order. Decision: do not disclose this mechanism to users — no code changes needed.
3. **Secondary pattern** (`computePatternEngine`'s `secondary_pattern`, gated at 50%
   confidence): decision is no changes for now — revisit once real users are active on the
   app and there's usage data to inform whether surfacing it helps.

**Fixed and device-confirmed:**
- `updateCraving` now mirrors `deleteCraving`'s failure handling exactly (closes the gap
  flagged in the 2026-07-29 (cont'd 2) entry below): both a zero-match PATCH response and a
  thrown exception leave local state and AsyncStorage untouched, returning early with a
  warning log instead of silently applying an edit the server never confirmed. Only a
  genuine successful response falls through to update local state.

**Schema-check finding — not yet investigated further:** the `npm run schema:check` run
this session (2026-07-30) showed `app_scores` already has unused columns for `sli`, `bri`,
`gsi`, `syli`, `secondary_pattern`, `secondary_pattern_confidence`, `dominant_layer`,
`cascade_risk`, `cascade_risks`, `adaptive_questions_asked`/`adaptive_questions_answered`,
`pattern_outcome`, `sleep_rating`, `stress_rating`, `gut_rating`. This likely means the
`cascade_risk`/`dominant_layer` persistence work (to restore the Metabolic Story animation
permanently, rather than the lightweight layer-breakdown fallback shipped 2026-07-29) may
only need app-side write/read wiring, not a new migration — these columns may already exist
from an earlier unfinished attempt. **Before starting that work:** confirm column
types/nullability actually match what's needed — column existence alone doesn't confirm
that.

**Investigated, not fixed — logged for awareness:**
- Google sign-in on `personaltraining9891` (a 2FA-required account) intermittently hangs on
  code exchange (`[Error: authorization grant invalid/expired]`) but resolves on retry with
  no code changes. Suspected: 2FA verification latency causing the auth code to age out
  before exchange completes. Not reproduced on demand — no fix attempted, needs a
  repeatable trigger before further investigation. Low priority unless it recurs frequently
  or blocks real users. Cross-account score isolation was confirmed correct during this same
  test (`personaltraining9891` showed 43, `amit.baruna` showed 29 — no contamination between
  accounts).

**Pre-launch audit item (not started)** — also tracked in Known Issues — Carry Forward
above: Score-summary card's expanded "Fat Loss Resistance" section is deliberately gated on
`scoreResult` only (needs full quiz-answer data `scoreHistory` doesn't persist) — expands
but shows nothing after sign-in without a fresh test, no error. Same root pattern as the
Home/Profile Metabolic Story gap fixed 2026-07-29. Before App Store submission: grep every
`scoreResult` read across the app (5 Layers detail pad, personalized article/video
recommendations) and confirm each has a `scoreHistory[0]` fallback or is an intentional
documented exception like this one.

**v1.1 idea flagged, not scoped into active work** — see Future Ideas Registry above:
inter-test change attribution (surfacing which specific questions/layers shifted between
two assessments, not just the total score delta).

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
