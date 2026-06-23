-- ============================================================
-- 20260624110000_membership_requests.sql
-- Bidirectional join with box approval (athlete-initiated half):
--   - athletes request to join via a box's join_code (status 'pending')
--   - owner/coach/staff approve (pending -> active) or reject (-> inactive)
-- Box-initiated email invites come later (separate invitations table).
-- Safe to re-run.
-- ============================================================

-- 1. Allow a 'pending' membership status (athlete requested, awaiting approval).
alter table public.memberships drop constraint if exists memberships_status_check;
alter table public.memberships add constraint memberships_status_check
  check (status in ('active', 'invited', 'pending', 'inactive'));

-- 2. A short, shareable join code per box. Backfill existing boxes.
alter table public.organizations add column if not exists join_code text unique;
update public.organizations
  set join_code = upper(substr(md5(random()::text || id::text), 1, 6))
  where join_code is null;

-- New boxes get a code automatically (extend the existing owner trigger).
create or replace function public.set_org_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.owner_user_id := auth.uid();
  if new.join_code is null then
    new.join_code := upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 6));
  end if;
  return new;
end;
$$;

-- 3. Athlete requests to join by code (SECURITY DEFINER creates the pending row).
create or replace function public.request_to_join_box(p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select id, name into v_id, v_name
    from public.organizations
    where join_code = upper(btrim(p_code));
  if v_id is null then raise exception 'Box introuvable'; end if;
  insert into public.memberships (organization_id, user_id, role, status)
    values (v_id, uid, 'member', 'pending')
    on conflict (organization_id, user_id) do nothing;
  return v_name;
end;
$$;

grant execute on function public.request_to_join_box(text) to authenticated;

-- 4. Approval rights: owner/coach/staff can update memberships (approve/reject).
drop policy if exists update_memberships on public.memberships;
create policy update_memberships on public.memberships
  for update using (has_org_role(organization_id, array['owner','coach','staff']))
          with check (has_org_role(organization_id, array['owner','coach','staff']));
