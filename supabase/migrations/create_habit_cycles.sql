-- Run this in Supabase SQL editor.
-- Habit_Cycle_Engine_SPEC.md (approved 2026-08-05), §2.

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

-- Client is read-only, own rows only. All writes (create/extend/close/reopen) happen only
-- from the notification Worker via service_role, same pattern as app_membership — there is
-- deliberately no client-facing insert/update policy here.
create policy "cycles_select_own" on public.habit_cycles
  for select using (auth.uid() = user_id);

-- Explicit table-level GRANTs, not left to inheritance from ALTER DEFAULT PRIVILEGES.
--
-- Found live on 2026-08-06 while debugging app_checkins/actions returning zero rows despite
-- the app behaving as if writes succeeded: RLS policies are a separate, higher layer from base
-- SQL table privileges — a role can have a correct RLS policy and still get
-- "permission denied for table X" (42501) if it was never GRANTed access to the table at all.
-- The earlier grant_service_role_table_access.sql (2026-07-27) included
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO service_role`, intended to cover this
-- for every future table automatically — but ALTER DEFAULT PRIVILEGES only applies to objects
-- later created BY THE SAME ROLE that ran it, not schema-wide. app_checkins and actions were
-- created after that migration and still ended up with zero grants for authenticated/anon,
-- confirmed via a direct anon-key REST probe (401, "permission denied for table app_checkins",
-- vs. a working table like app_profiles returning 200 with RLS-filtered results). Granting
-- explicitly here so habit_cycles doesn't repeat that same failure on day one.
grant select on public.habit_cycles to authenticated;
grant select, insert, update, delete on public.habit_cycles to service_role;
