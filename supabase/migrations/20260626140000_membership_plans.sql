-- ============================================================
-- 20260626140000_membership_plans.sql
-- ST-10 stage 1: a box's catalogue of membership plans (no payments yet).
--   kind: unlimited (time-based), pack (N credits), drop_in (single), trial
--   price_cents + currency; credits (packs); duration_days (validity window)
-- Owner manages; any member can read active plans. Safe to re-run.
-- ============================================================

create table if not exists public.membership_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  kind            text not null default 'unlimited' check (kind in ('unlimited', 'pack', 'drop_in', 'trial')),
  price_cents     integer not null default 0,
  currency        text not null default 'EUR',
  credits         integer,        -- pack: number of sessions; null for other kinds
  duration_days   integer,        -- validity window in days from start; null = no expiry
  recurring       boolean not null default false,   -- monthly auto-renew (Stripe, later)
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_membership_plans_org on public.membership_plans(organization_id);

alter table public.membership_plans enable row level security;

-- Members (any active role) can see the plans; only the owner manages them.
drop policy if exists read_membership_plans on public.membership_plans;
create policy read_membership_plans on public.membership_plans
  for select using (has_org_role(organization_id, array['owner', 'coach', 'member']));

drop policy if exists write_membership_plans on public.membership_plans;
create policy write_membership_plans on public.membership_plans
  for all using (has_org_role(organization_id, array['owner']))
          with check (has_org_role(organization_id, array['owner']));
