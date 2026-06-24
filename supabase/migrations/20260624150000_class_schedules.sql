-- ============================================================
-- 20260624150000_class_schedules.sql
-- Planning v2: recurring schedules (templates). A schedule recurs weekly
-- from start_date with NO end date — it stops only when removed/deactivated.
-- Occurrences are computed on the fly for the displayed range (not stored).
-- Member reservations (later) attach to (schedule_id + date).
-- Safe to re-run.
-- ============================================================

create table if not exists public.class_schedules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  session_type    text,
  weekday         integer not null check (weekday between 0 and 6),  -- 0 = Monday
  start_time      time not null,
  duration_min    integer not null default 60,
  capacity        integer not null,
  coach_user_id   uuid references auth.users(id),
  active          boolean not null default true,
  start_date      date not null default current_date,                -- recurs from here, no end
  created_at      timestamptz not null default now()
);

create index if not exists idx_class_schedules_org on public.class_schedules(organization_id);

alter table public.class_schedules enable row level security;

drop policy if exists read_class_schedules on public.class_schedules;
create policy read_class_schedules on public.class_schedules
  for select using (has_org_role(organization_id, array['owner','coach','staff','member']));

drop policy if exists insert_class_schedules on public.class_schedules;
create policy insert_class_schedules on public.class_schedules
  for insert with check (has_org_role(organization_id, array['owner','coach','staff']));

drop policy if exists update_class_schedules on public.class_schedules;
create policy update_class_schedules on public.class_schedules
  for update using (has_org_role(organization_id, array['owner','coach','staff']))
          with check (has_org_role(organization_id, array['owner','coach','staff']));

drop policy if exists delete_class_schedules on public.class_schedules;
create policy delete_class_schedules on public.class_schedules
  for delete using (has_org_role(organization_id, array['owner','coach','staff']));
