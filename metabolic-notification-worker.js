// metabolic-notification-worker.js
// Deploy to: metabolic-notification.amit-baruna.workers.dev (proposed name — confirm)
// Trigger: Cloudflare Cron Trigger, daily at 15:00 UTC (8:30pm IST)
// Secrets required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (same as payment-verify)
//
// Scope (per Habit_Notification_Engine_SPEC_DRAFT.md, approved 2026-08-05, extended by
// Habit_Cycle_Engine_SPEC.md, approved 2026-08-05):
// - Rule 1: Retest window — day 9 ("opens tomorrow") + day 14 ("recommended"). Score-date
//   based, independent of habit_cycles.
// - Rule 1.5 (new): Habit cycle day-14/21 evaluation — see "HABIT CYCLE EVALUATION" section
//   below. Also owns bootstrapping a user's very first habit_cycles row.
// - Rule 2: Streak milestone (3 / 7 / 14 / 30 days), only evaluated if today's
//   check-in is already completed
// - Rule 3: Check-in reminder, only evaluated if today's check-in is NOT
//   completed
// - Stale-data prompt (symptoms/conditions) — DROPPED from this build.
//   app_profiles.updated_at is a whole-row timestamp, not per-field, so it
//   can't measure this accurately (false negatives on unrelated field
//   changes). Revisit only if/when per-field timestamps are added. Decision:
//   Option B, confirmed 2026-08-05.
//
// Priority order (max 1 push per user per run, per Habit_Cycle_Engine_SPEC.md §4):
// retest window > cycle evaluation > streak milestone > check-in reminder.
// Streak/check-in remain mutually exclusive by construction (streak only fires when today
// IS completed, check-in reminder only when it's NOT) — the cycle rule sits above both,
// using an explicit `if (!chosen)` chain rather than nested if/else so each priority level
// is independently readable.
//
// Fixed 2026-08-06: habit_cycles bootstrap/evaluation used to only run for push-token
// holders, so a user who completed a test but never enabled notifications never got a
// habit_cycles row created at all, and the Streak Calendar screen showed an empty state for
// them indefinitely. Bootstrap/evaluation now runs for anyone with at least one app_scores
// row, independent of push-token possession — only the actual notification SEND stays
// token-gated (see step 1/2 and the main loop in runDailyNotificationJob below).

const RETEST_DAY_TRIGGERS = { 9: 'retest_opens_tomorrow', 14: 'retest_recommended' };
const STREAK_MILESTONES = [3, 7, 14, 30];
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function supabaseFetch(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.body ? 'return=representation' : undefined,
      ...(options.headers || {})
    }
  });
  return res.json();
}

// ── Date helpers (UTC-based day-diff, calendar dates only) ─────────────
function toDateOnly(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function daysBetween(a, b) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toDateOnly(b) - toDateOnly(a)) / MS_PER_DAY);
}
function dateStr(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Rule 1: Retest window ───────────────────────────────────────────────
function checkRetestTrigger(latestScoreCreatedAt, today) {
  if (!latestScoreCreatedAt) return null;
  const daysSince = daysBetween(new Date(latestScoreCreatedAt), today);
  const triggerType = RETEST_DAY_TRIGGERS[daysSince];
  return triggerType || null;
}

// ── Rule 1.5: Habit cycle day-14/21 evaluation (Habit_Cycle_Engine_SPEC.md) ─────────────
function addDays(d, n) {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

// Counts completed app_checkins between startDate and endDate (inclusive), both Date
// objects. Iterates day-by-day against the same checkinsByDate map already built for the
// streak/check-in rules below, rather than a separate per-user query — a cycle never spans
// more than 21 days (the day-21 hard stop), well within the 60-day lookback already fetched.
function countAdherence(checkinsByDate, startDate, endDate) {
  let count = 0;
  const cursor = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  while (cursor <= end) {
    const row = checkinsByDate[dateStr(cursor)];
    if (row && row.completed) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

// Evaluates one user's active/extended habit_cycles row against today. Returns null if no
// day-14/21 boundary is reached today. Deliberately measures the day-21 hard stop from the
// cycle's own `start_date`, NOT `extended_at` — confirmed with Amit 2026-08-06: extension
// always happens at exactly day 14, so day-21-from-start and day-21-from-extension land on
// the same calendar date either way, but start_date is kept as the one unambiguous reference
// point throughout, rather than mixing two different anchors for the same state machine.
function evaluateCycleRule(cycleRow, checkinsByDate, today) {
  const startDate = new Date(cycleRow.start_date);
  const daysSinceStart = daysBetween(startDate, today);

  if (cycleRow.status === 'active' && daysSinceStart === 14) {
    const adherence = countAdherence(checkinsByDate, startDate, today);
    if (adherence >= 10) {
      // 10-14 of 14: push retest now. No DB update — cycle stays active/open until a real
      // retest happens (that transition to closed_retest is driven by a new app_scores row
      // landing, not by this Worker run).
      return { action: 'retest_push', type: 'cycle_retest_push' };
    } else if (adherence >= 5) {
      // 5-9 of 14: extend 7 days out from start_date (= today + 7, since today is day 14 —
      // written as startDate+21 to keep start_date the single reference point).
      return {
        action: 'extend',
        type: 'cycle_extend_nudge',
        update: { status: 'extended', extended_at: dateStr(today), end_date: dateStr(addDays(startDate, 21)) },
      };
    } else {
      // 0-4 of 14: close this cycle as a reset, immediately open a fresh one starting today.
      return {
        action: 'reset',
        type: 'cycle_reset_nudge',
        closeUpdate: { status: 'closed_reset', end_date: dateStr(today), adherence_count_at_close: adherence },
        newCycle: { user_id: cycleRow.user_id, start_date: dateStr(today), status: 'active' },
      };
    }
  }

  if (cycleRow.status === 'extended' && daysSinceStart === 21) {
    // Hard stop — push retest regardless of adherence. No further DB state change; the
    // cycle stays 'extended' until the user actually retests (Habit_Cycle_Engine_SPEC.md §6:
    // deliberately soft edge case, not force-closed by this Worker).
    return { action: 'retest_push', type: 'cycle_retest_push' };
  }

  return null;
}

function cycleRetestCopy() {
  return {
    title: 'Ready to retest?',
    body: '14 days of real consistency — worth seeing what actually moved. Ready to retest?',
  };
}
function cycleExtendCopy() {
  return {
    title: '7 more days',
    body: 'Close, but not quite a full picture yet — 7 more days, then let’s retest.',
  };
}
function cycleResetCopy() {
  return {
    title: 'A fresh start',
    body: 'A fresh 14 days, starting now. Small and consistent beats starting over — again.',
  };
}
const CYCLE_COPY_BY_TYPE = {
  cycle_retest_push: cycleRetestCopy,
  cycle_extend_nudge: cycleExtendCopy,
  cycle_reset_nudge: cycleResetCopy,
};

// ── Rule 2/3 support: streak computation ────────────────────────────────
// Streak = consecutive completed days, walking backward from `today`,
// tolerating gaps of up to 2 missed days without resetting (matches spec
// §3: "resets to zero only after a gap of more than 2 days"). Missed days
// inside a tolerated gap do NOT increment the streak — only actually-
// completed days do.
function computeStreak(checkinsByDate, today) {
  let streak = 0;
  let consecutiveMissed = 0;
  const cursor = new Date(today);

  // Walk backward up to 60 days — well beyond the largest milestone (30),
  // so we never undercount a genuine long streak, but bounded so a very
  // old/inactive account doesn't loop indefinitely.
  for (let i = 0; i < 60; i++) {
    const key = dateStr(cursor);
    const row = checkinsByDate[key];
    if (row && row.completed) {
      streak += 1;
      consecutiveMissed = 0;
    } else {
      consecutiveMissed += 1;
      if (consecutiveMissed > 2) break;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// ── Expo push send (batched, max 100 per request per Expo's API) ───────
async function sendExpoPushBatch(messages) {
  const results = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      body: JSON.stringify(batch)
    });
    const json = await res.json().catch(() => null);
    results.push({ status: res.status, body: json });
  }
  return results;
}

// ── Notification copy ───────────────────────────────────────────────────
// Picks the personalized day-of-cycle check-in reminder for a user, or null if anything in
// the chain is missing — caller falls back to fallbackCheckinCopy() in that case, never
// throws. Built 2026-08-06: this used to be a comment describing intended behavior that was
// never actually implemented — every check-in reminder used the generic fallback,
// unconditionally, for every user, regardless of dominant_layer or actions-table state.
//
// dayIndex uses the exact same toDateOnly/daysBetween calendar-date math as
// checkRetestTrigger above (and the app's own daysSinceCalendar, which was built to mirror
// this Worker) — so the push notification's teaser and the in-app reveal card's fuller
// explanation are always reading the same index into the same 7-entry copy_variants array,
// never disagreeing on which day's copy to show.
function pickCheckinContent(latestScoreCreatedAt, dominantLayer, actionsByLayer, today) {
  if (!latestScoreCreatedAt || dominantLayer == null) return null;
  const layerKey = `L${dominantLayer}`;
  const actionRow = actionsByLayer[layerKey];
  if (!actionRow || !Array.isArray(actionRow.copy_variants) || actionRow.copy_variants.length !== 7) return null;
  const daysSince = daysBetween(new Date(latestScoreCreatedAt), today);
  const dayIndex = ((daysSince % 7) + 7) % 7;
  const variant = actionRow.copy_variants[dayIndex];
  if (!variant || !variant.teaser) return null;
  return { title: "Today's 1% is waiting", body: variant.teaser };
}

function retestCopy(triggerType) {
  if (triggerType === 'retest_opens_tomorrow') {
    return {
      title: 'Retest opens tomorrow',
      body: 'Your Metabolic Score retest unlocks tomorrow — worth checking what\u2019s shifted.'
    };
  }
  return {
    title: 'Time for your retest',
    body: 'It\u2019s been 14 days — this is the point we recommend retesting to see real movement.'
  };
}
function streakCopy(streakCount) {
  return {
    title: `${streakCount}-day streak`,
    body: `${streakCount} days of showing up for your 1% — that consistency is exactly what moves the needle.`
  };
}
function fallbackCheckinCopy() {
  return {
    title: "Today's 1% is waiting",
    body: 'One small action, one tap — worth two minutes before the day closes out.'
  };
}

// ── Main scheduled job ──────────────────────────────────────────────────
async function runDailyNotificationJob(env) {
  const today = new Date();
  const todayKey = dateStr(today);
  const lookbackDate = new Date(today);
  lookbackDate.setUTCDate(lookbackDate.getUTCDate() - 60);

  // 1. Users eligible for an actual push SEND. This stays token-gated — sending obviously
  //    requires a token — but as of 2026-08-06 this is no longer the population that drives
  //    habit_cycles bootstrap/evaluation (see step 2 below and the loop).
  const pushUsersRows = await supabaseFetch(
    env,
    '/rest/v1/app_profiles?expo_push_token=not.is.null&select=id,expo_push_token'
  );
  const pushTokenByUser = {};
  if (Array.isArray(pushUsersRows)) {
    for (const row of pushUsersRows) {
      pushTokenByUser[row.id] = row.expo_push_token;
    }
  }

  // 2. Latest app_scores.created_at per user (most recent first, take first occurrence per
  //    user_id). Also now defines the "has completed at least one test" population that
  //    habit_cycles bootstrap/evaluation runs against — independent of push-token
  //    possession. Fixed 2026-08-06: this used to only run inside the push-token-filtered
  //    `users` loop, so a user who completed a test but never enabled notifications never
  //    got a habit_cycles row created at all, and the Streak Calendar screen showed an
  //    empty state for them indefinitely. The cycle DATA is now created/evaluated for
  //    everyone in this population; only the notification SEND stays token-gated below.
  // dominant_layer added 2026-08-06 for pickCheckinContent below — kept in a separate map
  // (dominantLayerByUser) rather than folded into latestScoreByUser, since
  // latestScoreByUser's existing callers (checkRetestTrigger) expect a bare created_at
  // string, not an object.
  const scoresRows = await supabaseFetch(
    env,
    '/rest/v1/app_scores?select=user_id,created_at,dominant_layer&order=created_at.desc'
  );
  const latestScoreByUser = {};
  const dominantLayerByUser = {};
  if (Array.isArray(scoresRows)) {
    for (const row of scoresRows) {
      if (!(row.user_id in latestScoreByUser)) {
        latestScoreByUser[row.user_id] = row.created_at;
        dominantLayerByUser[row.user_id] = row.dominant_layer;
      }
    }
  }

  const allUserIds = new Set([...Object.keys(pushTokenByUser), ...Object.keys(latestScoreByUser)]);
  if (allUserIds.size === 0) {
    return { sent: 0, evaluated: 0, note: 'No users with push tokens or completed tests' };
  }

  // 3. Check-ins for the last 60 days, grouped by user then by date.
  const checkinRows = await supabaseFetch(
    env,
    `/rest/v1/app_checkins?select=user_id,date,completed,assigned_action_id&date=gte.${dateStr(lookbackDate)}`
  );
  const checkinsByUser = {};
  if (Array.isArray(checkinRows)) {
    for (const row of checkinRows) {
      if (!checkinsByUser[row.user_id]) checkinsByUser[row.user_id] = {};
      checkinsByUser[row.user_id][row.date] = row;
    }
  }

  // 4. Habit cycles — each user's current active/extended cycle, if any (Habit_Cycle_Engine_
  //    SPEC.md §2: at most one active-or-extended row per user, enforced at the app level).
  const cycleRows = await supabaseFetch(
    env,
    '/rest/v1/habit_cycles?status=in.(active,extended)&select=*'
  );
  const cycleByUser = {};
  if (Array.isArray(cycleRows)) {
    for (const row of cycleRows) {
      cycleByUser[row.user_id] = row;
    }
  }

  // 5. Actions content — fetched once for the whole run (not per-user; only 5 rows exist,
  //    one per layer, v1.0 has no rotation — Habit_Cycle_Engine_SPEC.md/§10.3 of the
  //    notification spec). Feeds pickCheckinContent below.
  const actionsRows = await supabaseFetch(
    env,
    '/rest/v1/actions?select=layer,copy_variants'
  );
  const actionsByLayer = {};
  if (Array.isArray(actionsRows)) {
    for (const row of actionsRows) {
      actionsByLayer[row.layer] = row;
    }
  } else {
    console.warn('[notification-worker] actions table fetch did not return an array — pickCheckinContent will fall back to generic copy for everyone this run:', actionsRows);
  }

  const messages = [];
  const logRows = [];
  const cycleUpdates = [];      // [{ id, patch }] — extend/close, one PATCH per row
  const newCycleInserts = [];   // rows to insert — bootstrap (no cycle yet) + reset-reopens

  for (const userId of allUserIds) {
    const hasPushToken = pushTokenByUser.hasOwnProperty(userId);
    const eligibleForCycle = latestScoreByUser.hasOwnProperty(userId);
    const existingCycle = cycleByUser[userId];

    // Cycle bootstrap + day-14/21 evaluation — runs for every test-completed user,
    // regardless of push-token possession (see the 2026-08-06 note above step 1). Computed
    // once here and reused below if this user also happens to have a token.
    let cycleResult = null;
    if (eligibleForCycle) {
      if (!existingCycle) {
        // Bootstrap: no active/extended cycle yet (first-ever, or fell through some other
        // way) — start one today. No evaluation needed on the same run a cycle is created;
        // day 0 can never hit the day-14/21 checks in evaluateCycleRule.
        newCycleInserts.push({ user_id: userId, start_date: todayKey, status: 'active' });
      } else {
        cycleResult = evaluateCycleRule(existingCycle, checkinsByUser[userId] || {}, today);
        if (cycleResult) {
          if (cycleResult.action === 'extend') {
            cycleUpdates.push({ id: existingCycle.id, patch: cycleResult.update });
          } else if (cycleResult.action === 'reset') {
            cycleUpdates.push({ id: existingCycle.id, patch: cycleResult.closeUpdate });
            newCycleInserts.push(cycleResult.newCycle);
          }
        }
      }
    }

    // Everything past this point is push-decision logic — nothing to do for a user we can't
    // actually send to. The cycle DB writes staged above still apply regardless.
    if (!hasPushToken) continue;

    let chosen = null; // { type, title, body }

    // Priority 1: retest window (existing — score-date based, independent of habit_cycles)
    const retestTrigger = checkRetestTrigger(latestScoreByUser[userId], today);
    if (retestTrigger) {
      chosen = { type: 'retest_reminder', ...retestCopy(retestTrigger) };
    }

    // Priority 2 (new): habit cycle day-14/21 evaluation
    if (!chosen && cycleResult) {
      chosen = { type: cycleResult.type, ...CYCLE_COPY_BY_TYPE[cycleResult.type]() };
    }

    // Priority 3: streak milestone (only relevant if today is already completed)
    const todaysCheckin = (checkinsByUser[userId] || {})[todayKey];
    if (!chosen && todaysCheckin && todaysCheckin.completed) {
      const streak = computeStreak(checkinsByUser[userId] || {}, today);
      if (STREAK_MILESTONES.includes(streak)) {
        chosen = { type: 'streak_milestone', ...streakCopy(streak) };
      }
    }

    // Priority 4: check-in reminder (today not completed, nothing higher-priority fired).
    // Personalized via pickCheckinContent when dominant_layer + a matching actions row with
    // a full 7-entry copy_variants are all present; falls back to the generic copy only when
    // that lookup genuinely comes back empty (missing layer, missing actions row, missing
    // grant, etc.) — never throws either way.
    if (!chosen && !(todaysCheckin && todaysCheckin.completed)) {
      const personalized = pickCheckinContent(latestScoreByUser[userId], dominantLayerByUser[userId], actionsByLayer, today);
      chosen = { type: 'checkin_reminder', ...(personalized || fallbackCheckinCopy()) };
    }

    if (chosen) {
      messages.push({
        to: pushTokenByUser[userId],
        sound: 'default',
        title: chosen.title,
        body: chosen.body,
        data: { type: chosen.type }
      });
      logRows.push({
        user_id: userId,
        type: chosen.type,
        sent_at: new Date().toISOString(),
        metadata: { title: chosen.title }
      });
    }
  }

  // Apply habit_cycles writes before sending pushes — DB state should reflect reality before
  // a user gets a notification implying that state. Extends/closes are per-row PATCHes (each
  // carries a different patch body, so can't batch into one request); new cycles (bootstrap +
  // reset-reopens) batch into a single POST like notification_log below.
  for (const u of cycleUpdates) {
    const res = await supabaseFetch(env, `/rest/v1/habit_cycles?id=eq.${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify(u.patch)
    });
    if (!Array.isArray(res)) {
      console.warn('[notification-worker] failed to update habit_cycles row', u.id, ':', res);
    }
  }
  if (newCycleInserts.length > 0) {
    const insertRes = await supabaseFetch(env, '/rest/v1/habit_cycles', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(newCycleInserts)
    });
    if (!Array.isArray(insertRes)) {
      console.warn('[notification-worker] failed to insert new habit_cycles rows:', insertRes);
    }
  }

  if (messages.length === 0) {
    return { sent: 0, evaluated: allUserIds.size, cyclesCreated: newCycleInserts.length, cyclesUpdated: cycleUpdates.length, note: 'No eligible notifications today' };
  }

  const sendResults = await sendExpoPushBatch(messages);

  // Log every attempted send — including ones Expo's API rejected — so
  // notification_log stays truthful. Not gated on Expo returning success,
  // since we still attempted the send (matches the "verify with a real
  // data check, not just no error shown" discipline from CLAUDE.md).
  const logRes = await supabaseFetch(env, '/rest/v1/notification_log', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(logRows)
  });
  if (!Array.isArray(logRes)) {
    console.warn('[notification-worker] failed to write notification_log:', logRes);
  }

  return { sent: messages.length, evaluated: allUserIds.size, cyclesCreated: newCycleInserts.length, cyclesUpdated: cycleUpdates.length, sendResults };
}

export default {
  // Cron-triggered entry point
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyNotificationJob(env));
  },

  // Manual trigger for testing (e.g. curl the Worker URL directly during
  // dev, before the cron fires) — mirrors the POST-only convention from
  // payment-verify.
  async fetch(req, env) {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
    try {
      const result = await runDailyNotificationJob(env);
      return jsonResponse(result);
    } catch (e) {
      console.error('[notification-worker] unhandled error:', e);
      return jsonResponse({ error: e.message }, 500);
    }
  }
};
