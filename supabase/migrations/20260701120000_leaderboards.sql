-- ST-102 (CA-01) Leaderboards v1 — members log a score on the box's daily WOD
-- (and, later, on named benchmarks) and see a ranking. Run in the Supabase SQL
-- editor. Safe to re-run.
--
-- Ranking direction is driven by score_type: 'time' → lower is better (seconds),
-- 'reps' / 'load' / 'rounds' → higher is better. The app stores a canonical
-- numeric sort key (score_value) + a human string (score_display) so display is
-- decoupled from sorting (e.g. rounds+reps "3+7" sorts as 3007).

-- 1) The coach sets the score type on the daily WOD (drives ranking direction).
alter table public.box_programming
  add column if not exists score_type text
  check (score_type in ('time','reps','load','rounds'));

-- 2) Named benchmarks (Fran, Cindy…), box-scoped, coach-managed. (UI: fast follow.)
create table if not exists public.benchmarks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  score_type      text not null check (score_type in ('time','reps','load','rounds')),
  description     text,
  created_by      uuid,
  created_at      timestamptz default now()
);
alter table public.benchmarks enable row level security;
drop policy if exists "benchmarks_read"  on public.benchmarks;
drop policy if exists "benchmarks_write" on public.benchmarks;
create policy "benchmarks_read" on public.benchmarks
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner','coach','staff','member']));
create policy "benchmarks_write" on public.benchmarks
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner','coach']))
  with check (public.has_org_role(organization_id, array['owner','coach']));
grant all on public.benchmarks to authenticated;

-- 3) One score per member per WOD-day OR per benchmark (they can update it).
create table if not exists public.wod_scores (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null,
  score_type      text not null check (score_type in ('time','reps','load','rounds')),
  score_value     numeric not null,      -- canonical sort key
  score_display   text not null,         -- human string (e.g. "4:32", "3+7", "225")
  rx              boolean not null default true,
  note            text,
  wod_date        date,                  -- set for a daily-WOD score
  benchmark_id    uuid references public.benchmarks(id) on delete cascade,  -- set for a benchmark score
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  -- exactly one target
  constraint wod_scores_one_target check ((wod_date is not null) <> (benchmark_id is not null))
);

-- one entry per member per daily WOD / per benchmark
create unique index if not exists wod_scores_uniq_day
  on public.wod_scores (organization_id, user_id, wod_date) where wod_date is not null;
create unique index if not exists wod_scores_uniq_bench
  on public.wod_scores (user_id, benchmark_id) where benchmark_id is not null;
create index if not exists wod_scores_day_idx   on public.wod_scores (organization_id, wod_date);
create index if not exists wod_scores_bench_idx  on public.wod_scores (benchmark_id);

alter table public.wod_scores enable row level security;
drop policy if exists "wod_scores_read"  on public.wod_scores;
drop policy if exists "wod_scores_write" on public.wod_scores;
-- Read: any active member of the box (the leaderboard is shared).
create policy "wod_scores_read" on public.wod_scores
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner','coach','staff','member']));
-- Write: only your own rows, and only in a box you belong to.
create policy "wod_scores_write" on public.wod_scores
  for all to authenticated
  using (user_id = auth.uid() and public.has_org_role(organization_id, array['owner','coach','staff','member']))
  with check (user_id = auth.uid() and public.has_org_role(organization_id, array['owner','coach','staff','member']));
grant all on public.wod_scores to authenticated;

-- 4) Ranked leaderboards WITH member names. SECURITY DEFINER so members can see
-- each other's first names (user_profile RLS is per-user); gated by has_org_role
-- on the CALLER so only box members get rows. Ranking: time → asc, else desc.
create or replace function public.get_wod_leaderboard(p_org_id uuid, p_date date)
returns table (user_id uuid, first_name text, score_type text, score_value numeric, score_display text, rx boolean, note text)
language sql security definer set search_path = public as $$
  select s.user_id, coalesce(nullif(trim(p.first_name), ''), 'Athlète'),
         s.score_type, s.score_value, s.score_display, s.rx, s.note
  from public.wod_scores s
  left join public.user_profile p on p.user_id = s.user_id
  where s.organization_id = p_org_id and s.wod_date = p_date
    and public.has_org_role(p_org_id, array['owner','coach','staff','member'])
  order by case when s.score_type = 'time' then s.score_value end asc nulls last,
           case when s.score_type <> 'time' then s.score_value end desc nulls last,
           s.created_at asc;
$$;

create or replace function public.get_benchmark_leaderboard(p_org_id uuid, p_benchmark_id uuid)
returns table (user_id uuid, first_name text, score_type text, score_value numeric, score_display text, rx boolean, note text)
language sql security definer set search_path = public as $$
  select s.user_id, coalesce(nullif(trim(p.first_name), ''), 'Athlète'),
         s.score_type, s.score_value, s.score_display, s.rx, s.note
  from public.wod_scores s
  left join public.user_profile p on p.user_id = s.user_id
  where s.organization_id = p_org_id and s.benchmark_id = p_benchmark_id
    and public.has_org_role(p_org_id, array['owner','coach','staff','member'])
  order by case when s.score_type = 'time' then s.score_value end asc nulls last,
           case when s.score_type <> 'time' then s.score_value end desc nulls last,
           s.created_at asc;
$$;

grant execute on function public.get_wod_leaderboard(uuid, date)        to authenticated;
grant execute on function public.get_benchmark_leaderboard(uuid, uuid)  to authenticated;
