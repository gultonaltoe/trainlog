-- Trainlog release batch 3 (2026-06-26) — run in Supabase SQL Editor.
-- New: coach leave window + directory RPC update. Verified via db reset.

-- ============================================================
-- 20260626200000_coach_leave.sql
-- ST-18: a coach "en congé" gets a date window. Adds leave_start/leave_end to
-- memberships and surfaces them in the member directory so the planning can flag
-- classes whose coach is on leave on that date. Safe to re-run.
-- ============================================================

alter table public.memberships add column if not exists leave_start date;
alter table public.memberships add column if not exists leave_end   date;

-- Recreate the directory RPC with the two leave columns (return type changes,
-- so drop first).
drop function if exists public.get_org_member_directory(uuid);
create function public.get_org_member_directory(p_org_id uuid)
returns table (
  membership_id     uuid,
  user_id           uuid,
  first_name        text,
  role              text,
  status            text,
  data_sharing      boolean,
  employment_status text,
  leave_start       date,
  leave_end         date
)
language sql stable security definer set search_path = public
as $$
  select
    m.id, m.user_id, p.first_name, m.role, m.status, m.data_sharing,
    m.employment_status, m.leave_start, m.leave_end
  from public.memberships m
  left join public.user_profile p on p.user_id = m.user_id
  where m.organization_id = p_org_id
    and m.status <> 'inactive'
    and public.has_org_role(p_org_id, array['owner','coach','staff'])
  order by m.created_at;
$$;

grant execute on function public.get_org_member_directory(uuid) to authenticated;
