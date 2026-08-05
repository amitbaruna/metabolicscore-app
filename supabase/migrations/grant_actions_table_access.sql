-- Run this in Supabase SQL editor.
-- Requested 2026-08-06 after building pickCheckinContent() in metabolic-notification-
-- worker.js, which reads the `actions` table via service_role for the first time — it was
-- previously only ever read by the app's signed-in client, via actionContent.get() in
-- src/config/supabase.ts.
--
-- Not run from a live verified grants query — this environment deliberately has no
-- service_role-authenticated DB access (that key must never leave the Worker's own
-- Cloudflare secrets). Rather than guess at current state, this grants explicitly and
-- idempotently instead: safe to run whether or not the grant was already present, same
-- defensive approach already taken for habit_cycles earlier tonight (create_habit_cycles.sql)
-- after finding app_checkins and actions both missing base table-level GRANTs for anon,
-- confirmed via a direct anon-key REST probe.
--
-- For a real, direct answer on whether service_role was actually missing this grant before
-- this migration runs (rather than just applying a safe fix regardless), run this first and
-- check whether 'service_role' / 'authenticated' both appear with SELECT:
--
--   SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'actions' ORDER BY grantee;
--
-- Note: this migration only covers `actions`. app_checkins' authenticated/service_role grant
-- status was flagged as an open, unconfirmed question earlier tonight (during the
-- app_checkins write-failure investigation) and was never resolved via migration — still
-- open, distinct from this fix, not covered here.

grant select on public.actions to authenticated;
grant select on public.actions to service_role;
