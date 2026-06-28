-- ST-34 P1: box daily programming (the "WOD du jour" the coach publishes).
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.box_programming (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date            date not null,
  title           text,
  warmup          text,
  strength        text,
  wod_format      text,
  wod_description text,
  time_cap_min    int,
  notes           text,
  created_by      uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (organization_id, date)
);

alter table public.box_programming enable row level security;

-- Read: any active member of the box. Write: owner/coach.
drop policy if exists "box_prog_read"  on public.box_programming;
drop policy if exists "box_prog_write" on public.box_programming;

create policy "box_prog_read" on public.box_programming
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner','coach','staff','member']));

create policy "box_prog_write" on public.box_programming
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner','coach']))
  with check (public.has_org_role(organization_id, array['owner','coach']));

grant all on public.box_programming to authenticated;
