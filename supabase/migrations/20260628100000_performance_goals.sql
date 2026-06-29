-- ST-35 (goals): minimal per-movement performance goals. Run in the SQL editor. Safe to re-run.

create table if not exists public.performance_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  movement_id   text not null,
  movement_name text not null,
  target_value  numeric not null,
  unit          text not null default 'kg',
  created_at    timestamptz default now(),
  unique (user_id, movement_id, unit)
);

alter table public.performance_goals enable row level security;

drop policy if exists "perf_goals_owner" on public.performance_goals;
create policy "perf_goals_owner" on public.performance_goals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant all on public.performance_goals to authenticated;
