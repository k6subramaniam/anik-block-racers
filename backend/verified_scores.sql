-- Dedicated ANIK game Supabase project only. Never apply to an unrelated commerce database.
-- Only an authenticated Edge Function with a service-role key can insert verified results.
create table if not exists public.anik_verified_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  track text not null check (track in ('blast','canyon','frost','skybridge','summit')),
  laps smallint not null check (laps between 1 and 5),
  weather text not null check (weather in ('clear','rain','snow','wind','dynamic')),
  ticks integer not null check (ticks between 1 and 18000),
  stunt_points integer not null check (stunt_points between 0 and 1000000),
  finish_rank smallint not null check (finish_rank between 1 and 4),
  replay_hash text not null check (length(replay_hash)=64),
  created_at timestamptz not null default now(),
  unique (owner_id, replay_hash)
);
create index if not exists anik_verified_times_lookup on public.anik_verified_runs(track,laps,weather,ticks);
alter table public.anik_verified_runs enable row level security;
revoke all on table public.anik_verified_runs from anon, authenticated;
-- Expose only public fields. Do not reveal JWT ownership identifiers or replay hashes.
grant select (id,track,laps,weather,ticks,stunt_points,finish_rank,created_at) on public.anik_verified_runs to anon, authenticated;
create policy "Read public anonymous rankings" on public.anik_verified_runs
  for select to anon,authenticated using (true);
-- No client insert/update/delete policies. Service-role authorization is Edge-only.
