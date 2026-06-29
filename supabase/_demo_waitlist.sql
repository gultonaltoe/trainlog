-- ============================================================
-- _demo_waitlist.sql  (DEMO DATA — not a migration)
-- Creates a small, already-FULL class tomorrow on the test box so testers who
-- try to book it land on the waitlist — and the attendees sheet already shows
-- inscrits + liste d'attente. Re-runnable: wipes its own previous demo class
-- first (cascades its reservations), so you get a clean full class every time.
-- Run in the Supabase SQL editor before the demo.
--   • Class: "DEMO — Liste d'attente", tomorrow 18:30, capacity 2
--   • Fills 2 booked + up to 3 waitlisted using the box's members (then any user)
-- ============================================================

do $$
declare
  v_org   uuid;
  v_sched uuid;
  v_wd    int  := (extract(dow from current_date + 1)::int + 6) % 7;  -- tomorrow, 0 = Monday
  v_occ   date := current_date + 1;
  v_cap   int  := 2;
  r       record;
  v_i     int  := 0;
begin
  select id into v_org from public.organizations where name = 'Test Julien Test' order by created_at limit 1;
  if v_org is null then raise exception 'Box « Test Julien Test » introuvable'; end if;

  -- Self-clean (cascades to its class_reservations).
  delete from public.class_schedules where organization_id = v_org and title = 'DEMO — Liste d''attente';

  insert into public.class_schedules
    (organization_id, title, session_type, weekday, start_time, duration_min, capacity, start_date, kind, bookable)
  values (v_org, 'DEMO — Liste d''attente', 'CrossFit', v_wd, time '18:30', 60, v_cap, current_date, 'class', true)
  returning id into v_sched;

  -- Fill seats: prefer the box's active members, then any user, so the class is
  -- guaranteed full (first v_cap = booked, the rest = waitlisted).
  for r in
    with ranked as (
      select u.id as user_id,
             case when m.user_id is not null then 0 else 1 end as pref,
             row_number() over (order by u.created_at) as rn
      from auth.users u
      left join public.memberships m
        on m.user_id = u.id and m.organization_id = v_org and m.status = 'active'
    )
    select user_id from ranked order by pref, rn limit v_cap + 3
  loop
    v_i := v_i + 1;
    insert into public.class_reservations (organization_id, schedule_id, occurrence_date, user_id, status)
    values (v_org, v_sched, v_occ, r.user_id, case when v_i <= v_cap then 'booked' else 'waitlisted' end)
    on conflict (schedule_id, occurrence_date, user_id) do nothing;
  end loop;

  raise notice 'Demo full class le % à 18:30 (capacité %, % places remplies). Schedule %', v_occ, v_cap, v_i, v_sched;
end $$;
