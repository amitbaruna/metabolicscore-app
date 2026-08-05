// Hand-maintained manifest of every column the app actually sends to each Supabase table.
//
// This file MUST be updated by hand whenever a new field is added to any insert/update
// payload in src/config/supabase.ts or src/context/AppDataContext.tsx — check-schema.ts
// only knows what's listed here. It is not derived automatically; treat it the same as any
// other source of truth that can silently go stale.
//
// Each entry's `columns` list was populated by reading the actual payload objects in those
// two files as of 2026-07-30, not by guessing at intended schema. Where no real write path
// exists for a requested table, that's noted explicitly in `source` rather than invented.

export type TableManifest = {
  // Every column name the app sends in an INSERT/UPSERT/PATCH body, across all code paths
  // that write to this table.
  columns: string[];
  // Where these were read from, for whoever updates this file next.
  source: string;
};

export const SCHEMA_MANIFEST: Record<string, TableManifest> = {
  app_scores: {
    columns: [
      'user_id', 'total_score', 'layer1', 'layer2', 'layer3', 'layer4', 'layer5',
      'rcs', 'dominant_pattern', 'dominant_pattern_confidence', 'answers',
      'time_spent_seconds', 'engagement_grade',
    ],
    source: 'src/config/supabase.ts (scores.save, adds user_id) + App.tsx handleScoreComplete\'s saveScore({...}) payload',
  },

  app_cravings: {
    columns: [
      'user_id', 'craving_type', 'craving_time', 'craving_context',
      'mapped_layer', 'mechanism', 'tier', 'confidence',
    ],
    source: 'src/config/supabase.ts (cravings.save/update, save adds user_id) + src/context/AppDataContext.tsx (saveCraving/updateCraving)',
  },

  app_profiles: {
    columns: [
      'id', 'email', 'full_name', 'onboarded', 'gender', 'conditions',
      'symptoms', 'goals', 'fat_deposition', 'baseline', 'mini_quiz',
      'expo_push_token', 'push_token_updated_at',
    ],
    source:
      'src/config/supabase.ts (auth.signUp insert, profiles.upsert, profiles.updateFields, pushNotifications.saveToken) ' +
      '+ src/context/AppDataContext.tsx (setSymptoms/setGoals/setFatDeposition/setBaseline/setConditions/setMiniQuizAnswers/saveProfile) ' +
      '+ App.tsx OnboardingScreen.handleComplete. ' +
      'push_token (old, mismatched name) replaced by expo_push_token/push_token_updated_at ' +
      '2026-08-05 — the deployed notification Worker only ever read expo_push_token, so the ' +
      'old column name meant no token the app saved was ever actually found by the Worker.',
  },

  // Read-only from the app's side (actionContent.get in src/config/supabase.ts) — content
  // rows are managed directly in Supabase, not written by this app. Columns used by the app:
  // `layer` ('L1'..'L5' text) to look up a row, and `copy_variants` (jsonb array of 7
  // { teaser, reveal } objects, one per day of the weekly cycle) for the check-in card's
  // rotating "reveal" text.
  actions: {
    columns: [],
    source: 'src/config/supabase.ts (actionContent.get) — read-only, no app write path.',
  },

  app_checkins: {
    columns: ['user_id', 'date', 'assigned_action_id', 'completed', 'completed_at', 'backfilled'],
    source: 'src/config/supabase.ts (checkins.markDone) + src/context/AppDataContext.tsx (logCheckin)',
  },

  // No code path in this repo writes to a table by this name — mini-quiz answers are
  // persisted as a JSON field (`mini_quiz`) on app_profiles instead, via
  // setMiniQuizAnswers in src/context/AppDataContext.tsx. Kept as an empty entry (rather
  // than dropped) so check-schema.ts still reports whether a table by this name exists in
  // Supabase at all — useful either way: if it exists, it's dead/legacy relative to this
  // app; if it doesn't, this confirms there's no real integration point for it right now.
  app_micro_quiz_answers: {
    columns: [],
    source: 'NOT FOUND in src/config/supabase.ts or src/context/AppDataContext.tsx — flagged, not fabricated. See comment above.',
  },

  app_bookings: {
    columns: [
      'user_id', 'template_slot_id', 'booking_date', 'status',
      'hold_expires_at', 'confirmed_at',
    ],
    source: 'src/config/supabase.ts (booking.createHold, booking.createFreeRebooking, booking.rescheduleBooking, booking.cancelBooking)',
  },

  // The app never writes to this table directly. app_membership writes were deliberately
  // locked down to service_role only (see CLAUDE.md's 2026-07-27 session log — client
  // INSERT/UPDATE policies were found and removed as a security gap); the only writer is
  // the Cloudflare Worker (metabolic-payment-verify.js), which lives outside this repo.
  // Kept as an empty entry so check-schema.ts still confirms the table/columns exist, for
  // whoever maintains the Worker's side of this contract.
  app_membership: {
    columns: [],
    source: 'membership.get() only (read-only) — see src/config/supabase.ts. Writes happen only in the Cloudflare Worker, not in this repo.',
  },
};
