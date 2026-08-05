# Habit Cycle Engine — SPEC

Status: **Approved (2026-08-05) — ready for implementation**
Extends: `Habit_Notification_Engine_SPEC_DRAFT.md` (this spec assumes that one is
already built and live — token capture, Worker, day-of-cycle content selection)
New UI: 14-day streak calendar page, reached via "View streak calendar →" on
the existing Home Today's 1% card (card itself unchanged)

---

## 1. Why this exists

The original notification spec assumed a "cycle" was just derived math —
`daysSince(latest test date) % 14`. That only works if every cycle starts at
a retest. Testing surfaced a real gap: users who never retest, or who
disengage entirely, have no mechanism to re-enter a fresh cycle, and there's
no visible history of past cycles. This spec makes a cycle a **real, tracked
entity** with a start date, an end date, and a defined way it closes — not
just a rolling calculation.

## 2. Data model — new table: `habit_cycles`

```sql
create table public.habit_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,                          -- null while active
  status text not null default 'active'
    check (status in ('active', 'extended', 'closed_retest', 'closed_reset')),
  extended_at date,                       -- set only if it entered the extended tier
  adherence_count_at_close integer,       -- snapshot at close, for the collapsed history card
  created_at timestamptz not null default now()
);

alter table public.habit_cycles enable row level security;
create policy "cycles_select_own" on public.habit_cycles
  for select using (auth.uid() = user_id);
```

`app_checkins` is unchanged — still date-based, no `cycle_id` needed. Adherence
for any cycle is computed by counting completed `app_checkins` rows whose
`date` falls within that cycle's `[start_date, end_date or today]` range. This
avoids retrofitting every historical checkin with a cycle reference.

**A user has at most one row with `status = 'active'` or `'extended'` at a
time** — enforced at the application level (check before insert), not a DB
constraint, to keep the schema simple.

## 3. Cycle lifecycle — state machine

```
[active] --(retest happens any time)--> [closed_retest]
   |
   | day 14 reached, no retest yet
   v
adherence >= 10 of 14  -->  push retest now  -->  stays [active] until retest closes it
adherence 5-9 of 14    -->  [extended], +7 days, push retest at day 21 regardless
adherence 0-4 of 14    -->  [closed_reset], new [active] cycle starts immediately

[extended] --(day 21 reached, any adherence)--> hard stop, push retest.
   If retest happens: [closed_retest].
   If not: cycle stays [extended] past day 21 — no further auto-extension,
   but also not force-closed without the user's action (see §6 open note).
```

**Day-14 branch, exact thresholds:**

| Adherence (of 14) | Action |
|---|---|
| 10-14 | Push retest now via notification. Cycle stays active/open until retest actually happens. |
| 5-9 | Set `status = 'extended'`, `extended_at = today`, `end_date` pushed 7 days out. Push a "worth 7 more days" notification. |
| 0-4 | Close this cycle (`status = 'closed_reset'`, `end_date = today`, snapshot adherence count). Immediately open a new `active` cycle starting today. Push a fresh-start notification. |

**Day-21 branch (only reached if a cycle is in `extended` status):**
Push retest notification regardless of adherence at that point. No further
extension — this is a hard stop on the *nudging*, not a forced database
close. If the user genuinely never retests past day 21, the cycle just sits
in `extended` with no further automated action until they either retest or
mark a checkin (see §6).

## 4. Where this logic runs

Extends the existing daily Cloudflare Worker (`metabolic-app-notification`),
not a new Worker. Add a new rule evaluated per user, inserted into the
existing priority order:

**Updated priority order:** retest window (existing) → **cycle day-14/21
evaluation (new)** → streak milestone (existing) → check-in reminder (existing)

Reasoning for this position: a cycle boundary event is a bigger deal than a
daily streak milestone or routine check-in nudge, but shouldn't override an
already-scheduled retest-window push if both land the same day (rare, but
possible near day 14).

## 5. Notification copy (new types, added to `notification_log`'s type enum)

New `type` values: `cycle_retest_push`, `cycle_extend_nudge`, `cycle_reset_nudge`

- **`cycle_retest_push`** (day 14, high adherence, and day 21 hard stop): *"14 days of real consistency — worth seeing what actually moved. Ready to retest?"*
- **`cycle_extend_nudge`** (day 14, mid adherence): *"Close, but not quite a full picture yet — 7 more days, then let's retest."*
- **`cycle_reset_nudge`** (day 14, low adherence, new cycle starting): *"A fresh 14 days, starting now. Small and consistent beats starting over — again."*

All three, and the day-21 push, reuse `cycle_retest_push`'s copy for the
day-21 case specifically — no separate fourth copy needed, same message
fits both trigger points (both are "push toward retest now").

## 6. Open behavior note — not a blocker, flagging for awareness

If a cycle sits in `extended` past day 21 with no retest and no further
checkins, nothing currently forces it closed. It will just continue
accumulating checkins indefinitely under the same `habit_cycles` row until
the user does retest. This is an acceptable, deliberately soft edge case —
better than silently deleting someone's progress — but worth knowing it's
not explicitly handled by name, just a natural consequence of the state
machine as specced.

## 7. UI — Streak calendar page updates

**Current cycle** (unchanged from prior mockup): 14-day grid, points-available
card, dynamic motivational message, cycle summary line.

**Dynamic message tiers** (reusing the same adherence count already computed
for the summary line — no new query):
- High (10-14): reinforcing, close to retest-ready tone.
- Mid (5-9): encouraging, "keep going" tone.
- Low (0-4): gentle, non-judgmental, habit-building tone — never guilt-based,
  consistent with existing tone rules elsewhere in this project.

**Past cycles — collapsible history cards**, listed below the current cycle,
most recent first:
- Collapsed state: label ("Streak 1", "Streak 2"...) + end date.
- Expanded (on tap): start date, end date, days followed (from
  `adherence_count_at_close`), and how it closed (retested vs. reset) —
  shown plainly, not as a value judgment.

## 8. Explicitly unchanged / out of scope

- Home's Today's 1% card — no change to its existing Mark as Done behavior.
- Points-available — stays static (`100 − current_score`) for now. Before/
  after comparison, weekly/monthly trend reporting are deferred to the
  longitudinal data phase (Phase 1 roadmap), not this build.
- No browsing into a past cycle's day-by-day calendar — the collapsed/
  expanded card shows summary stats only (start, end, days followed), not a
  full historical 14-day grid.
