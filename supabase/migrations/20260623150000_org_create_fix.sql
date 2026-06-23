-- ============================================================
-- 20260623150000_org_create_fix.sql
-- Fix "new row violates RLS policy for organizations" on create.
--
-- The previous insert policy required owner_user_id = auth.uid() in WITH CHECK,
-- which is brittle. Instead: force the owner = the caller via a BEFORE trigger
-- (server-side, unspoofable), and relax the insert policy to "any authenticated
-- user". This is also the single chokepoint to GATE creation later (self-serve
-- org creation is NOT the long-term mechanic — fine for testing only).
-- Safe to re-run.
-- ============================================================

create or replace function public.set_org_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.owner_user_id := auth.uid();   -- always the caller, regardless of payload
  return new;
end;
$$;

drop trigger if exists trg_set_org_owner on public.organizations;
create trigger trg_set_org_owner
  before insert on public.organizations
  for each row execute function public.set_org_owner();

drop policy if exists insert_orgs on public.organizations;
create policy insert_orgs on public.organizations
  for insert with check ((select auth.uid()) is not null);
