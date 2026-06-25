-- ============================================================
-- 20260625130000_remove_staff_role.sql
-- Simplify org roles to owner / coach / member (drop 'staff'). Existing staff
-- become coaches; employment_status now applies to coaches. RLS policies that
-- still list 'staff' in their role arrays are left as-is — inert, since no row
-- can hold the value once the check constraint is tightened. Safe to re-run.
-- ============================================================

-- Existing staff become coaches.
update public.memberships set role = 'coach' where role = 'staff';

-- Tighten the role check (inline constraint is auto-named <table>_<col>_check).
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships add constraint memberships_role_check
  check (role in ('owner', 'coach', 'member'));
