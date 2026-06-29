-- Add 'sick' (Maladie) as an employment status for coaches.
-- memberships.employment_status has a CHECK constraint, so widen it.
-- Run in the Supabase SQL editor (safe to re-run).

alter table public.memberships
  drop constraint if exists memberships_employment_status_check;

alter table public.memberships
  add constraint memberships_employment_status_check
  check (employment_status = any (array['active','on_leave','sick','inactive']));
