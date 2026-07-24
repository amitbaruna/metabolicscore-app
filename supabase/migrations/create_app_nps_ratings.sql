-- Run this in Supabase SQL editor BEFORE the updated app build goes live.
-- Captures the 1-10 "does this feel like you?" resonance rating shown on
-- the Results screen. Previously this rating was shown to the user but
-- never persisted anywhere.

create table if not exists app_nps_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  score smallint not null check (score >= 1 and score <= 10),
  total_score integer,        -- user's metabolic score at time of rating, for band correlation
  dominant_layer smallint,    -- 1-5, for layer-level feedback correlation
  created_at timestamptz not null default now()
);

alter table app_nps_ratings enable row level security;

-- Users can insert their own rating
create policy "Users can insert their own nps rating"
  on app_nps_ratings for insert
  with check (auth.uid() = user_id);

-- Users can read their own ratings (not required by the app today, but
-- harmless and consistent with other tables' RLS shape)
create policy "Users can read their own nps ratings"
  on app_nps_ratings for select
  using (auth.uid() = user_id);
