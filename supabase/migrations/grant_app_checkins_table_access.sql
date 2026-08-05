-- Run this in Supabase SQL editor.
-- Requested 2026-08-06 — app_checkins was confirmed (via a direct anon-key REST probe) to
-- be missing base table-level GRANTs, same as `actions` (see grant_actions_table_access.sql),
-- but never got its own migration file at the time — the grant fix that got app_checkins
-- writes working again tonight was applied directly in Supabase's SQL editor, not committed
-- to this repo. This file exists so that fix is actually recorded here, not just live in the
-- database with no trace of it in source control.
--
-- Not run from a live verified grants query — this environment deliberately has no
-- service_role-authenticated DB access (that key must never leave the Worker's own
-- Cloudflare secrets). Rather than guess at current state, this grants explicitly and
-- idempotently instead: safe to run whether or not the grant was already present, same
-- defensive approach already taken for `actions` and `habit_cycles` earlier tonight.
--
-- For a real, direct answer on current grant state before running this, check:
--
--   SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'app_checkins' ORDER BY grantee;
--
-- Role split, per actual read/write paths in this repo:
-- - `authenticated` needs SELECT, INSERT, UPDATE — the signed-in client both reads
--   (checkins.listSince, for the Streak Calendar grid) and writes (checkins.markDone /
--   checkins.markUndone) directly, via the user's own JWT, not service_role.
-- - `service_role` only needs SELECT — metabolic-notification-worker.js only ever reads
--   app_checkins (for streak/adherence computation), it never writes to this table.

grant select, insert, update on public.app_checkins to authenticated;
grant select on public.app_checkins to service_role;
