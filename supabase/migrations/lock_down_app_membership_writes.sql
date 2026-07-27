-- Run this in Supabase SQL editor.
-- Closes an RLS gap found while auditing Day 1 Part B (payment flow): app_membership had
-- client-writable INSERT and UPDATE policies (both scoped to auth.uid() = user_id), left
-- over from the now-deleted TEST_ONLY_confirmBooking / TEST_ONLY_confirmProgramUpgrade
-- client-side functions. That meant any signed-in user could set their OWN membership row
-- to status: 'paid' directly via the REST API, with no payment check, bypassing the
-- payment-verify Worker entirely.
--
-- Confirmed via grep across App.tsx, AppDataContext.tsx, and src/config/supabase.ts that
-- nothing legitimate does an INSERT/UPDATE to app_membership client-side — only a SELECT
-- (membership.get, used by App.tsx) and a DELETE (account.deleteMyData, the DPDP
-- self-deletion flow). Safe to drop both write policies entirely: the payment-verify
-- Worker writes via the Supabase service_role key, which bypasses RLS regardless of any
-- policy here.

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where tablename = 'app_membership'
      and cmd in ('INSERT', 'UPDATE')
  loop
    execute format('drop policy %I on app_membership', pol.policyname);
  end loop;
end $$;

-- Verification query — re-run after the above to confirm only SELECT (and DELETE, if
-- present) policies remain on app_membership.
select policyname, cmd, roles, qual as using_expression, with_check
from pg_policies
where tablename = 'app_membership';
