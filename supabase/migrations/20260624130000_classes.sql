-- ============================================================
-- 20260624130000_classes.sql
-- Planning: classes (concrete dated sessions). "Recurring" is materialized as
-- one row per occurrence at creation time (simple, individually editable).
-- Member reservations (bookings) come in a later migration.
-- Safe to re-run.
-- ============================================================

create table if not exists public.classes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  date            date not null,
  start_time      time not null,
  duration_min    integer not null default 60,
  capacity        integer,                       -- null = unlimited
  coach_user_id   uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_classes_org_date on public.classes(organization_id, date);

alter table public.classes enable row level security;

-- Any active member of the box can view the schedule.
drop policy if exists read_classes on public.classes;
create policy read_classes on public.classes
  for select using (has_org_role(organization_id, array['owner','coach','staff','member']));

-- Owner/coach/staff manage the schedule.
drop policy if exists insert_classes on public.classes;
create policy insert_classes on public.classes
  for insert with check (has_org_role(organization_id, array['owner','coach','staff']));
drop policy if exists update_classes on public.classes;
create policy update_classes on public.classes
  for update using (has_org_role(organization_id, array['owner','coach','staff']))
          with check (has_org_role(organization_id, array['owner','coach','staff']));
drop policy if exists delete_classes on public.classes;
create policy delete_classes on public.classes
  for delete using (has_org_role(organization_id, array['owner','coach','staff']));
