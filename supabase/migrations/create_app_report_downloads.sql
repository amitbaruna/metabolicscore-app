-- Run this in Supabase SQL editor before wiring up the "Download PDF Report" button.
-- Click-tracking only: one row per report download/share, so we know the button
-- is actually being used before investing further in the export itself.

create table if not exists app_report_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  report_type text not null default 'pdf_report',  -- e.g. 'pdf_report' — room for other export types later
  created_at timestamptz not null default now()
);

alter table app_report_downloads enable row level security;

-- Users can insert their own download record
create policy "Users can insert their own report download"
  on app_report_downloads for insert
  with check (auth.uid() = user_id);

-- Users can read their own download history (not required by the app today, but
-- harmless and consistent with other tables' RLS shape)
create policy "Users can read their own report downloads"
  on app_report_downloads for select
  using (auth.uid() = user_id);
