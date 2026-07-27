-- Run this in Supabase SQL editor.
-- Root-cause fix for a permission gap discovered while live-testing the payment webhook:
-- service_role was missing base table-level GRANTs on at least app_profiles and
-- unmatched_payments (confirmed via a temporary debug log in the Worker — the app_profiles
-- lookup was failing with "permission denied for table app_profiles", which supabaseFetch's
-- error handling silently misread as "zero rows found", making a real permission error look
-- like a legitimate no-match case).
--
-- service_role is meant to bypass RLS entirely, but RLS is a separate, higher layer than
-- base SQL privileges — bypassing RLS does not imply the role has SELECT/INSERT/UPDATE
-- rights on the table underneath. These tables likely never got the grants Supabase's own
-- dashboard tooling sets up automatically, because they were created via raw SQL instead.
--
-- This grants service_role full access on every existing table in public (covers both
-- known-affected tables plus anything else the Worker touches), and sets it as the default
-- for any table created from now on, so this class of bug can't silently recur.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
