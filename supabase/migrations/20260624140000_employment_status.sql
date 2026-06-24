-- ============================================================
-- 20260624140000_employment_status.sql
-- Employee status for staff (owner/coach/staff), separate from the
-- join-lifecycle `status`. Lets a box mark a coach as active / on leave /
-- inactive without removing their membership. Members leave it null.
-- Surfaced through the member directory so the Staff page can show/edit it.
-- Safe to re-run.
-- ============================================================

alter table public.memberships
  add column if not exists employment_status text
  check (employment_status in ('active', 'on_leave', 'inactive'));

update public.memberships
  set employment_status = 'active'
  where role in ('owner', 'coach', 'staff') and employment_status is null;

-- Add employment_status to the directory (extends the previous signature).
create or replace function public.get_org_member_directory(p_org_id uuid)
returns table (
  membership_id     uuid,
  user_id           uuid,
  first_name        text,
  role              text,
  status            text,
  data_sharing      boolean,
  employment_status text
)
language sql security definer stable set search_path = public
as $$
  select
    m.id,
    m.user_id,
    p.first_name,
    m.role,
    m.status,
    m.data_sharing,
    m.employment_status
  from public.memberships m
  left join public.user_profile p on p.user_id = m.user_id
  where m.organization_id = p_org_id
    and m.status <> 'inactive'
    and public.has_org_role(p_org_id, array['owner','coach','staff'])
  order by m.created_at;
$$;
