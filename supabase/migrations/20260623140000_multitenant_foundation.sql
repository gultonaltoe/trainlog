-- ============================================================
-- 20260623140000_multitenant_foundation.sql
-- Phase 1: organizations + memberships (RBAC) foundation.
--
-- Adds the two multi-tenant tables, helper functions, and extends
-- training-data RLS so a box's coaches/owners can READ a member's
-- training data WHEN the member shares it (data_sharing = true,
-- default true — per sign-off 2026-06-23).
--
-- Nothing here changes existing athlete data or Phase 0 owner policies.
-- With zero memberships, the new coach-read policies grant nothing.
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------

create table if not exists public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique,
  owner_user_id       uuid not null references auth.users(id),
  settings            jsonb not null default '{}'::jsonb,
  subscription_status text not null default 'trial',
  created_at          timestamptz not null default now()
);

create table if not exists public.memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('owner','coach','staff','member')),
  status          text not null default 'active' check (status in ('active','invited','inactive')),
  data_sharing    boolean not null default true,   -- sign-off: shared by default, member can revoke
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_org  on public.memberships(organization_id);

-- ------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER so they can read
--    memberships without tripping RLS recursion in policies).
-- ------------------------------------------------------------

-- Does the current user hold one of `allowed_roles` (active) in `org_id`?
create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

-- May the current user view `target_user_id`'s training data?
-- True when they share an org in which the target shares data and the
-- current user is an active owner/coach.
create or replace function public.can_view_member_data(target_user_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.memberships target
    join public.memberships viewer
      on viewer.organization_id = target.organization_id
    where target.user_id   = target_user_id
      and target.status    = 'active'
      and target.data_sharing = true
      and viewer.user_id   = (select auth.uid())
      and viewer.status    = 'active'
      and viewer.role in ('owner','coach')
  );
$$;

-- Member flips their OWN data-sharing for an org (can't touch role/status this way).
create or replace function public.set_data_sharing(org_id uuid, share boolean)
returns void
language sql security definer set search_path = public
as $$
  update public.memberships
     set data_sharing = share
   where organization_id = org_id
     and user_id = (select auth.uid());
$$;

-- Auto-create the owner's membership when an organization is created.
create or replace function public.add_owner_membership()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.memberships (organization_id, user_id, role, status, data_sharing)
  values (new.id, new.owner_user_id, 'owner', 'active', true)
  on conflict (organization_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_add_owner_membership on public.organizations;
create trigger trg_add_owner_membership
  after insert on public.organizations
  for each row execute function public.add_owner_membership();

-- ------------------------------------------------------------
-- 3. RLS on the new tables
-- ------------------------------------------------------------

alter table public.organizations enable row level security;
drop policy if exists read_orgs   on public.organizations;
drop policy if exists insert_orgs on public.organizations;
drop policy if exists update_orgs on public.organizations;
drop policy if exists delete_orgs on public.organizations;
create policy read_orgs on public.organizations
  for select using (has_org_role(id, array['owner','coach','staff','member']));
create policy insert_orgs on public.organizations
  for insert with check (owner_user_id = (select auth.uid()));
create policy update_orgs on public.organizations
  for update using (has_org_role(id, array['owner']))
          with check (has_org_role(id, array['owner']));
create policy delete_orgs on public.organizations
  for delete using (has_org_role(id, array['owner']));

alter table public.memberships enable row level security;
drop policy if exists read_own_memberships on public.memberships;
drop policy if exists read_org_memberships on public.memberships;
drop policy if exists insert_memberships   on public.memberships;
drop policy if exists update_memberships   on public.memberships;
drop policy if exists delete_memberships   on public.memberships;
-- See your own membership rows…
create policy read_own_memberships on public.memberships
  for select using (user_id = (select auth.uid()));
-- …and owners/coaches/staff see everyone in their org (the roster).
create policy read_org_memberships on public.memberships
  for select using (has_org_role(organization_id, array['owner','coach','staff']));
-- Owners/staff manage the roster. (Members change only data_sharing, via the
-- set_data_sharing() function above — they cannot self-edit role/status.)
create policy insert_memberships on public.memberships
  for insert with check (has_org_role(organization_id, array['owner','staff']));
create policy update_memberships on public.memberships
  for update using (has_org_role(organization_id, array['owner','staff']))
          with check (has_org_role(organization_id, array['owner','staff']));
create policy delete_memberships on public.memberships
  for delete using (has_org_role(organization_id, array['owner','staff']));

-- ------------------------------------------------------------
-- 4. Coach/owner READ access to a sharing member's training data.
--    Added as EXTRA permissive SELECT policies alongside the Phase 0
--    owner policies. Scope: sessions + their children + PRs (NOT
--    body_metrics / nutrition_logs, which stay private to the member).
-- ------------------------------------------------------------

drop policy if exists coach_read_sessions on public.sessions;
create policy coach_read_sessions on public.sessions
  for select using (can_view_member_data(user_id));

drop policy if exists coach_read_personal_records on public.personal_records;
create policy coach_read_personal_records on public.personal_records
  for select using (can_view_member_data(user_id));

drop policy if exists coach_read_session_blocks on public.session_blocks;
create policy coach_read_session_blocks on public.session_blocks
  for select using (exists (select 1 from public.sessions s
    where s.id = session_blocks.session_id and can_view_member_data(s.user_id)));

drop policy if exists coach_read_wods on public.wods;
create policy coach_read_wods on public.wods
  for select using (exists (select 1 from public.sessions s
    where s.id = wods.session_id and can_view_member_data(s.user_id)));

drop policy if exists coach_read_session_pain_alerts on public.session_pain_alerts;
create policy coach_read_session_pain_alerts on public.session_pain_alerts
  for select using (exists (select 1 from public.sessions s
    where s.id = session_pain_alerts.session_id and can_view_member_data(s.user_id)));

drop policy if exists coach_read_block_sets on public.block_sets;
create policy coach_read_block_sets on public.block_sets
  for select using (exists (select 1 from public.session_blocks sb
    join public.sessions s on s.id = sb.session_id
    where sb.id = block_sets.block_id and can_view_member_data(s.user_id)));

drop policy if exists coach_read_wod_components on public.wod_components;
create policy coach_read_wod_components on public.wod_components
  for select using (exists (select 1 from public.wods w
    join public.sessions s on s.id = w.session_id
    where w.id = wod_components.wod_id and can_view_member_data(s.user_id)));
