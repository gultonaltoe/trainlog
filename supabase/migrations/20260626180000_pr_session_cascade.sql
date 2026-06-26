-- ============================================================
-- 20260626180000_pr_session_cascade.sql
-- ST-12: deleting a session left its personal_records (PR / logged sets) behind.
-- Re-create the session_id FK with ON DELETE CASCADE so a session's derived
-- records go with it. PRs with a null session_id (manually added) are untouched.
-- Safe to re-run.
-- ============================================================

alter table public.personal_records
  drop constraint if exists personal_records_session_id_fkey;

alter table public.personal_records
  add constraint personal_records_session_id_fkey
  foreign key (session_id) references public.sessions(id) on delete cascade;
