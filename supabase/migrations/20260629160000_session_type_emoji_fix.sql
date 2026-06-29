-- ============================================================
-- 20260629160000_session_type_emoji_fix.sql
-- ST-78 follow-up: the previous pass set Haltéro to 🏋️, colliding with CrossFit
-- (which must stay 🏋️). Give Haltéro a distinct mark — 🥇 — matching the
-- Progression page's haltéro category. Also nudge a couple of catch-alls.
-- Idempotent, by-name; safe to re-run.
-- ============================================================

update public.session_types set emoji = '🥇' where lower(name) in ('haltéro','haltero','haltérophilie','halterophilie');
update public.session_types set emoji = '⚡' where lower(name) = 'autre';
