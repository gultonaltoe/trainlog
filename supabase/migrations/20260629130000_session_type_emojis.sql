-- ============================================================
-- 20260629130000_session_type_emojis.sql
-- ST-78: refresh the global session-type emojis (the athlete log catalogue).
-- CrossFit and Gymnastique are left untouched per the ticket. Idempotent —
-- updates by name, only matching rows change; safe to re-run.
-- (Box-created class types are a separate list and aren't affected here.)
-- ============================================================

update public.session_types set emoji = '🏃' where lower(name) in ('endurance','engine','cardio');
update public.session_types set emoji = '🏋️' where lower(name) in ('haltérophilie','halterophilie','haltéro','haltero');
update public.session_types set emoji = '🏁' where lower(name) = 'hyrox';
update public.session_types set emoji = '💪' where lower(name) in ('force','renfo','renforcement','renforcement musculaire');
update public.session_types set emoji = '🔥' where lower(name) = 'hiit';
update public.session_types set emoji = '🧘' where lower(name) in ('mobilité','mobilite','stretching','récupération','recuperation','recovery');
update public.session_types set emoji = '👟' where lower(name) = 'run';
update public.session_types set emoji = '🤝' where lower(name) in ('team wod','team');
