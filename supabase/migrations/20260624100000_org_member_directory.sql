-- ============================================================
-- 20260624100000_org_member_directory.sql
-- Let a box's owner/coach/staff see member NAMES for the roster,
-- without exposing full member profiles (weight, health, etc.).
--
-- We expose a minimal directory via a SECURITY DEFINER function rather
-- than a broad RLS policy on user_profile. The function returns only
-- name + role + sharing flag, and only to staff of that box.
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
    and m.status = 'active'
    -- caller must be owner/coach/staff of this box (else returns nothing)
    and public.has_org_role(p_org_id, array['owner','coach','staff'])
  order by m.created_at;
$$;

grant execute on function public.get_org_member_directory(uuid) to authenticated;
