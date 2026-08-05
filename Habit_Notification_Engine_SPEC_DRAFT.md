# Habit + Notification Engine — SPEC (Draft)

Status: **Approved (2026-08-05) — ready for build**
Phase: Part of **Phase 1** (Longitudinal daily/periodic micro-input engine + push
notifications, built together per 2026-08-04 roadmap decision)
Related: `app_checkins` (new table), Signal Accumulator, Longitudinal Unified
Narrative System

---

## 1. Purpose

Two goals, addressed by one system:

1. **Habit formation** — "Today's 1%" gives the user one concrete, layer-specific
   micro-action per day, tied to their current dominant layer, with a single-tap
   check-in.
2. **Return-to-app** — bring users back without becoming a generic engagement
   app. The lever is **personal specificity**, not notification volume. This
   system should never try to out-frequency Instagram/fitness-influencer content
   — it wins by being the only thing that knows this specific user's actual
   pattern.

---

## 2. "Today's 1%" — Habit Mechanic

- One micro-action assigned per day, based on current dominant layer
  (e.g. L3 → 10-min post-meal walk; L2 → parasympathetic breathing).
- **v1.0: one fixed action per layer, no rotation.** Action changes only when
  dominant layer changes (at the 14-day retest).
- **Known gap, explicitly deferred to v1.1:** system doesn't yet distinguish
  "dominant" vs. "active" layer for action assignment. Not in scope now.
- Check-in = single tap marking the day's action done. This tap *is* the
  check-in — no separate logging step.
- **Message-copy variants:** since the underlying action can stay the same for
  up to 2 weeks, the *wrapper sentence* around the reminder should rotate
  through 5–8 copy variants (round-robin or random) so daily language doesn't
  read as robotic repetition. The action itself does not need to vary — only
  how it's described.
- **Copy must motivate, not just instruct.** "Do your walk" is a task label,
  not a reason to act — low conversion by design. Each variant should be a
  short 1-2 line message that gives the *why* (the mechanism/benefit behind
  the action) alongside the nudge, e.g. "A short walk after eating helps
  smooth out your blood sugar swing — worth the 10 minutes." Keep it as short
  as competing fitness-app copy (this is explicitly the register to match —
  short, crisp, not a lecture).
- **Clinical-language discipline applies to this copy too.** Any claim about
  what the action *does* physiologically must use "may" language, consistent
  with the rest of the product — no bare causal claims ("lowers your glucose
  spike by 30%") without a hedge, even in a short push-notification string.
  This is easy to lose sight of in short-form copy; it still applies.
- **Anchor to an existing daily moment** in copy where possible (e.g. "after
  lunch, tap this") rather than a floating, context-free reminder — this is
  standard cue→routine→reward habit design and reduces friction.

## 3. Streak & Weekly Adherence — Two Separate Numbers

- **Streak counter:** resets to zero only after a gap of **more than 2 days**
  (matches existing 2-day backfill limit — a user can miss 1–2 days and still
  recover the streak).
- **Weekly adherence:** independent, rolling count — "completed 3 of the last
  7 days" — shown regardless of streak status. Prevents one missed day from
  making a whole week of real effort look like failure.
- **Tone on streak reset: neutral or gently encouraging, never punitive.**
  No guilt copy, no "you're falling behind," no shaming. A broken streak is
  not necessarily worth a notification at all — silence is an acceptable,
  arguably preferable, response.

## 4. Points-Available Framing — Clinical Language Correction

- Display: `points available = 100 − current score` (e.g. score 45 → "up to
  55 points may become available").
- **Required phrasing discipline:** must NOT state a guaranteed outcome or
  fixed timeline ("34 points in 8-12 weeks" is not permitted — no data
  currently supports that as a predictable, linear claim).
- **Correct pattern** (matches existing PDF report copy): *"Up to [X] points
  may become available as you address your current symptoms."* No promised
  rate, no guaranteed timeline. Consistent with "may" language rule and
  Hypothesis-to-Lab Validation Loop sequencing — outcome claims wait for real
  correlation data.

## 5. Data Model — `app_checkins` (new table)

Minimum fields (to be finalized with Amit before migration):
- `user_id`
- `date`
- `assigned_action_id` (which layer-action was shown that day)
- `completed` (bool)
- `completed_at` (timestamp, for backfill-window validation)
- `backfilled` (bool — was this logged retroactively within the 2-day window)

Also needed: a small **notification log table** (see §7) — separate concern,
but same phase of work.

---

## 6. Notification Tiering — Push vs. In-App

**Core principle:** most of what was originally proposed as push notifications
belongs in-app instead. Push is reserved for time-sensitive or
action-required items only. Everything educational or discovery-oriented
surfaces inside the app, seen only when the user opens it anyway.

| Item | Tier | Trigger / cadence |
|---|---|---|
| Today's 1% pending | **Push** | Once daily, evening cutoff, only if not yet completed |
| Streak milestone (day 3, 7, 14...) | **Push** | Event-based, on threshold crossed |
| Retest window closing | **Push** | ~1–2 days before 14-day cycle ends |
| Stale symptom/craving/medical-condition data | **Push, capped** | Only if unchanged 14+ days; max ~once/2 weeks |
| New article/video matched to layer | **In-app** | Batched "new for you" surface on Home, not per-item push |
| Score-band explainer ("what 70+ means") | **In-app** | One-time, first time user reaches that band |
| Points-available explainer | **In-app** | Shown inline next to the number itself |
| Case-study match ("someone with your pattern...") | **In-app / soft nudge** | Periodic, not push — see §8 |

**Cutoff time: 8:30pm IST.** Confirmed by Amit.

## 7. Daily Governor — Preventing Stacking

Multiple push candidates can be eligible on the same day (check-in pending +
stale data + retest window, etc). Rule: **max 1 push per day**, selected by
priority.

**Proposed priority order (needs Amit confirmation — business judgment, not
engineering):**
1. Retest window closing
2. Streak milestone
3. Check-in reminder
4. Stale-data prompt

**Tracking requirement:** every notification sent should log `type`,
`sent_at`, and `tapped_at` (or null). This is what makes "which notifications
actually bring people back" answerable with real data after a few weeks,
rather than guessed at indefinitely.

---

## 8. Return-to-App Mechanisms (beyond habit reminders)

Framing: the win condition is **personal specificity that generic fitness
content can't replicate** — not competing on notification volume.

1. **Insight-teaser nudges** — surface a genuine change in the user's own
   data ("Your gut-brain signal shifted since last week") rather than a task
   reminder. Curiosity about their own pattern, not an obligation.
2. **Case-study matching as a pull mechanism** — periodically surface one new
   matched real case ("someone with your pattern just shared their update"),
   not just as static PDF/report content. In-app, not push.
3. **Habit-stacking in copy** — anchor the daily reminder to an existing
   routine moment rather than a floating prompt (see §2).
4. **Variable home screen, within user-chosen preferences** — the existing
   home-screen customization feature (user picks preferred content types)
   stays as the outer boundary. The system rotates *which* item within that
   chosen set is shown, so the screen isn't static, without ever overriding
   what the user selected. Rotation ≠ override.

**Explicitly avoided:** guilt-based copy, streak-shaming, competitive/
comparison pressure ("others are ahead of you"). Cuts against both the
non-aggressive design goal and general user-wellbeing practice.

**Honest caveat:** notification/return-mechanism design alone won't solve
retention if the underlying content (articles, case studies) isn't good
enough to want to come back for. Content-engagement tracking (§9) is what
tells us, with real data, which of these mechanisms are actually working.

---

## 9. Dependency: Content-Engagement Tracking

The batched "new for you" surface (§6) and case-study nudges (§8.2) both
depend on knowing which articles/videos/cases a user has already seen and
which they engage with. This is the same event-logging pipeline already
flagged for Phase 1 (piggybacking on the check-in/notification build) —
not a separate project, but worth sequencing so the event pipeline exists
before these features need it.

---

## 10. Open Decisions — ALL RESOLVED (2026-08-05)

1. **Daily push cutoff hour: 8:30pm IST.** Confirmed.
2. **Priority order confirmed:** retest window closing → streak milestone →
   check-in reminder → stale-data prompt.
3. **Micro-action library: ship v1.0 with 1 action/layer, as-is.** No content
   expansion required before launch. Engineering requirement: assigned action
   stored as a foreign key to an `actions` table (not hardcoded), so future
   library growth (v1.1 rotation/variety) is a content addition, not a
   rebuild.
4. **"New for you" content pool: 14-day lookback**, matching the existing
   retest-cycle cadence. Always respects home-screen customization — rotation
   happens only within content types the user has selected, never overrides.
5. **Notification-log schema finalized:**
   ```
   notification_log
   - id
   - user_id
   - type          (enum: checkin_reminder | streak_milestone | retest_reminder | stale_data_prompt)
   - sent_at
   - tapped_at     (nullable)
   - metadata      (optional jsonb — e.g. which streak day, which layer action)
   ```

**Spec status: approved, ready for implementation.** Next step is handing this
to Cursor/Claude Code for build, followed by EAS device testing.

---

## 11. Explicitly Out of Scope (v1.1+)

- Active-layer (not just dominant-layer) action assignment (§2).
- Per-user personalized send-time (requires historical check-in behavior data
  not yet available — building the send/open logging now is what enables this
  later, not a launch requirement).
- Action rotation/variety beyond copy-variant wrapping (§2).
- Micro-action library expansion beyond 1 action/layer (§10.3).
- **Longitudinal weekly and monthly data views** — confirmed by Amit as v1.1
  scope, separate from this spec. This document covers the daily check-in/
  notification layer only; weekly/monthly rollup views are a distinct
  deliverable, not folded into this build. Flagged here for visibility, not
  scoped into current work per the "new ideas go to the registry, not
  unprompted active scope" rule.
