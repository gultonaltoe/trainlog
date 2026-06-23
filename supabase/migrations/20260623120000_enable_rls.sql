-- ============================================================
-- 20260623120000_enable_rls.sql
-- Phase 0 security: enable Row Level Security (RLS) so the
-- DATABASE enforces "you can only touch your own data" — instead
-- of trusting a filter in the frontend (which a user can tamper with).
--
-- Safe to re-run: each policy is dropped-if-exists before creation,
-- and enabling RLS twice is harmless.
--
-- NOTE: run the pre-flight diagnostic (see docs / chat) first to make
-- sure no live rows have a null or orphaned user_id — those would
-- become invisible once RLS is on.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Drop ALL pre-existing policies on the target tables.
--    RLS was previously enabled with permissive "USING (true)"
--    policies. Postgres ORs permissive policies together, so an old
--    open policy left in place would override our new owner rules.
--    This wipes the slate so only the policies below apply.
-- ------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'user_profile','sessions','session_blocks','wods',
        'session_pain_alerts','personal_records','body_metrics','nutrition_logs',
        'block_sets','wod_components','programs','program_sessions',
        'movements','session_types','wod_formats','body_parts','feedback')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 1. Owner-only tables (they carry a user_id column)
--    A row is yours iff its user_id = your logged-in id.
--    `for all` = applies to select/insert/update/delete.
--    `using`   = which existing rows you can see/change/delete.
--    `with check` = what new/updated rows are allowed to contain.
-- ------------------------------------------------------------

alter table public.user_profile enable row level security;
drop policy if exists own_user_profile on public.user_profile;
create policy own_user_profile on public.user_profile
  for all using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

alter table public.sessions enable row level security;
drop policy if exists own_sessions on public.sessions;
create policy own_sessions on public.sessions
  for all using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

alter table public.personal_records enable row level security;
drop policy if exists own_personal_records on public.personal_records;
create policy own_personal_records on public.personal_records
  for all using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

alter table public.body_metrics enable row level security;
drop policy if exists own_body_metrics on public.body_metrics;
create policy own_body_metrics on public.body_metrics
  for all using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

alter table public.nutrition_logs enable row level security;
drop policy if exists own_nutrition_logs on public.nutrition_logs;
create policy own_nutrition_logs on public.nutrition_logs
  for all using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 2. Session-owned tables — ownership ALWAYS derives from the
--    owning session (sessions.user_id), never from these tables'
--    own user_id column.
--
--    Why: the app inserts session_blocks / wods / session_pain_alerts
--    WITHOUT a user_id, so that column is null/stale and must not be
--    trusted. The authoritative owner is the parent session.
--    block_sets and wod_components walk two levels up to the session.
-- ------------------------------------------------------------

-- Direct children of a session (one hop)
alter table public.session_blocks enable row level security;
drop policy if exists own_session_blocks on public.session_blocks;
create policy own_session_blocks on public.session_blocks
  for all
  using (exists (select 1 from public.sessions s
                 where s.id = session_blocks.session_id
                   and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.sessions s
                      where s.id = session_blocks.session_id
                        and s.user_id = (select auth.uid())));

alter table public.wods enable row level security;
drop policy if exists own_wods on public.wods;
create policy own_wods on public.wods
  for all
  using (exists (select 1 from public.sessions s
                 where s.id = wods.session_id
                   and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.sessions s
                      where s.id = wods.session_id
                        and s.user_id = (select auth.uid())));

alter table public.session_pain_alerts enable row level security;
drop policy if exists own_session_pain_alerts on public.session_pain_alerts;
create policy own_session_pain_alerts on public.session_pain_alerts
  for all
  using (exists (select 1 from public.sessions s
                 where s.id = session_pain_alerts.session_id
                   and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.sessions s
                      where s.id = session_pain_alerts.session_id
                        and s.user_id = (select auth.uid())));

-- Grandchildren (two hops to a session)
alter table public.block_sets enable row level security;
drop policy if exists own_block_sets on public.block_sets;
create policy own_block_sets on public.block_sets
  for all
  using (exists (select 1 from public.session_blocks sb
                 join public.sessions s on s.id = sb.session_id
                 where sb.id = block_sets.block_id
                   and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.session_blocks sb
                      join public.sessions s on s.id = sb.session_id
                      where sb.id = block_sets.block_id
                        and s.user_id = (select auth.uid())));

alter table public.wod_components enable row level security;
drop policy if exists own_wod_components on public.wod_components;
create policy own_wod_components on public.wod_components
  for all
  using (exists (select 1 from public.wods w
                 join public.sessions s on s.id = w.session_id
                 where w.id = wod_components.wod_id
                   and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.wods w
                      join public.sessions s on s.id = w.session_id
                      where w.id = wod_components.wod_id
                        and s.user_id = (select auth.uid())));

-- ------------------------------------------------------------
-- 3. Programs: owner can do everything; anyone logged-in can READ
--    a program flagged is_public (forward-compatible with sharing).
-- ------------------------------------------------------------

alter table public.programs enable row level security;
drop policy if exists read_programs   on public.programs;
drop policy if exists insert_programs on public.programs;
drop policy if exists update_programs on public.programs;
drop policy if exists delete_programs on public.programs;
create policy read_programs on public.programs
  for select using ((select auth.uid()) = user_id or is_public = true);
create policy insert_programs on public.programs
  for insert with check ((select auth.uid()) = user_id);
create policy update_programs on public.programs
  for update using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);
create policy delete_programs on public.programs
  for delete using ((select auth.uid()) = user_id);

alter table public.program_sessions enable row level security;
drop policy if exists read_program_sessions   on public.program_sessions;
drop policy if exists insert_program_sessions on public.program_sessions;
drop policy if exists update_program_sessions on public.program_sessions;
drop policy if exists delete_program_sessions on public.program_sessions;
create policy read_program_sessions on public.program_sessions
  for select using (exists (select 1 from public.programs p
    where p.id = program_sessions.program_id
      and (p.user_id = (select auth.uid()) or p.is_public = true)));
create policy insert_program_sessions on public.program_sessions
  for insert with check (exists (select 1 from public.programs p
    where p.id = program_sessions.program_id and p.user_id = (select auth.uid())));
create policy update_program_sessions on public.program_sessions
  for update using (exists (select 1 from public.programs p
    where p.id = program_sessions.program_id and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.programs p
    where p.id = program_sessions.program_id and p.user_id = (select auth.uid())));
create policy delete_program_sessions on public.program_sessions
  for delete using (exists (select 1 from public.programs p
    where p.id = program_sessions.program_id and p.user_id = (select auth.uid())));

-- ------------------------------------------------------------
-- 4. Reference catalogs: read-only for any logged-in user.
--    No insert/update/delete policy => clients cannot modify them.
-- ------------------------------------------------------------

alter table public.movements enable row level security;
drop policy if exists read_movements on public.movements;
create policy read_movements on public.movements
  for select using ((select auth.uid()) is not null);

alter table public.session_types enable row level security;
drop policy if exists read_session_types on public.session_types;
create policy read_session_types on public.session_types
  for select using ((select auth.uid()) is not null);

alter table public.wod_formats enable row level security;
drop policy if exists read_wod_formats on public.wod_formats;
create policy read_wod_formats on public.wod_formats
  for select using ((select auth.uid()) is not null);

alter table public.body_parts enable row level security;
drop policy if exists read_body_parts on public.body_parts;
create policy read_body_parts on public.body_parts
  for select using ((select auth.uid()) is not null);

-- ------------------------------------------------------------
-- 5. Feedback: any logged-in user can submit; no read policy
--    means only the service_role (admin/back-office) can read it.
-- ------------------------------------------------------------

alter table public.feedback enable row level security;
drop policy if exists insert_feedback on public.feedback;
create policy insert_feedback on public.feedback
  for insert with check ((select auth.uid()) is not null);

-- ------------------------------------------------------------
-- 6. Views: make them run with the CALLER's privileges so the
--    base-table RLS above applies. Without this, views bypass RLS
--    and would leak every user's data (e.g. v_weekly_volume).
-- ------------------------------------------------------------

alter view public.v_sessions_summary    set (security_invoker = on);
alter view public.v_weekly_volume        set (security_invoker = on);
alter view public.v_movement_progression set (security_invoker = on);
alter view public.v_pain_timeline        set (security_invoker = on);
