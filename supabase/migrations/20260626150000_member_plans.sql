-- ============================================================
-- 20260626150000_member_plans.sql
-- ST-10 stage 2: a member's assigned membership plan(s). Assigned manually by
-- owner/coach for now; Stripe (stage 4) will create these on payment.
--   status: active | expired | cancelled
--   ends_on: validity end (from plan.duration_days); null = no expiry
--   credits_remaining: for 'pack' plans; null otherwise
-- Owner/coach manage; a member reads their own. Safe to re-run.
-- ============================================================

create table if not exists public.member_plans (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  plan_id           uuid not null references public.membership_plans(id) on delete restrict,
  status            text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_on         date not null default current_date,
  ends_on           date,
  credits_remaining integer,
  created_at        timestamptz not null default now()
);

create index if not exists idx_member_plans_org_user on public.member_plans(organization_id, user_id);
create index if not exists idx_member_plans_user on public.member_plans(user_id);

alter table public.member_plans enable row level security;

-- A member reads their own plans; owner/coach read all in the box.
drop policy if exists read_member_plans on public.member_plans;
create policy read_member_plans on public.member_plans
  for select using (
    user_id = (select auth.uid())
    or has_org_role(organization_id, array['owner', 'coach'])
  );

-- Owner/coach assign and manage member plans.
drop policy if exists write_member_plans on public.member_plans;
create policy write_member_plans on public.member_plans
  for all using (has_org_role(organization_id, array['owner', 'coach']))
          with check (has_org_role(organization_id, array['owner', 'coach']));
