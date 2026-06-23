-- ============================================================
-- 20260624120000_directory_all_statuses.sql
-- The member directory should also surface PENDING join requests (with names)
-- so the box can approve/reject them — not just active members.
-- Same signature as before, so no type regeneration needed.
-- Safe to re-run.
-- ============================================================

create or replace function public.get_org_member_directory(p_org_id uuid)
returns table (
  membership_id uuid,
  user_id       uuid,
  first_name    text,
  role          text,
  status        text,
  data_sharing  boolean
)
language sql security definer stable set search_path = public
as $$
  select
    m.id,
    m.user_id,
    p.first_name,
    m.role,
    m.status,
    m.data_sharing
  from public.memberships m
  left join public.user_profile p on p.user_id = m.user_id
  where m.organization_id = p_org_id
    and m.status <> 'inactive'
    and public.has_org_role(p_org_id, array['owner','coach','staff'])
  order by m.created_at;
$$;
