-- ============================================================
-- 20260629150000_profile_goals_array.sql
-- Allow multiple objectives on the profile. Adds user_profile.goals (text[])
-- and backfills it from the existing single `goal`. The single column is kept
-- in sync (goals[0]) for any legacy reader. Safe to re-run.
-- ============================================================

alter table public.user_profile add column if not exists goals text[];

update public.user_profile
  set goals = array[goal]
  where goal is not null and goal <> '' and goals is null;
