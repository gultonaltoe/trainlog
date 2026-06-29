-- ============================================================
-- 20260629170000_drop_migrate_user_data.sql
-- SECURITY FIX: migrate_user_data(old_uid) was SECURITY DEFINER, granted to
-- anon + authenticated, with NO ownership check on old_uid — any logged-in user
-- could pass another user's UUID and reassign that user's profile / sessions /
-- personal_records to themselves. Obsolete (leftover from an anonymous-auth
-- experiment). Revoke EXECUTE then drop entirely. Idempotent / safe to re-run.
-- ============================================================

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'migrate_user_data'
  ) then
    revoke execute on function public.migrate_user_data(uuid) from anon;
    revoke execute on function public.migrate_user_data(uuid) from authenticated;
  end if;
end $$;

drop function if exists public.migrate_user_data(uuid);
