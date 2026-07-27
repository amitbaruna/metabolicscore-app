-- Run this in Supabase SQL editor BEFORE deploying the updated payment-verify Worker.
-- Captures any Razorpay payment.captured event the webhook couldn't turn into a
-- membership flip — typo'd email, someone who paid before signing up in the app,
-- a payment link missing its plan_type note, or a transient write failure. Previously
-- these cases only hit a Cloudflare console.warn and were otherwise lost.
--
-- No RLS policies are added on purpose: only the Worker (service_role key, which
-- bypasses RLS entirely) ever writes here, and Amit reviews/resolves rows manually via
-- Supabase's Table Editor as project owner. No client (anon or authenticated) should
-- ever be able to read or write this table.

create table if not exists unmatched_payments (
  id uuid primary key default gen_random_uuid(),
  razorpay_payment_id text not null unique,
  email text,
  plan_type text,
  amount integer,           -- paise, straight from the Razorpay payment entity
  booking_id uuid,
  reason text not null,      -- why it couldn't be matched/confirmed
  raw_payload jsonb,         -- full payment entity, for manual reconciliation
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table unmatched_payments enable row level security;
