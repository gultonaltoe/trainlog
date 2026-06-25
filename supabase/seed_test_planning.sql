-- ============================================================
-- seed_test_planning.sql  (TEST DATA — not a migration)
-- A realistic weekly planning for the box owned by the given user:
--   • Mon–Fri, 1h classes every hour 07:00 → 13:00 (slots start 07–12)
--   • Always 2 classes in parallel per slot (court 1 = CrossFit, court 2 = mix)
--   • An afternoon "Open Gym (libre)" slot members can also book
-- Recurring weekly (class_schedules has no end date). Re-running ADDS duplicates;
-- use the cleanup block at the bottom to reset first if needed.
-- ============================================================

do $$
declare
  v_org      uuid;
  v_day      int;
  v_slot     int;
  v_hour     int;
  v_alt      text[] := array['Haltérophilie', 'Endurance', 'Hyrox', 'HIIT', 'Team WOD', 'Gymnastics'];
  v_alt_type text;
begin
  select organization_id into v_org
    from public.memberships
    where user_id = 'fade2de8-666f-420d-b4a8-abc491ae3e78' and role = 'owner'
    order by created_at limit 1;
  if v_org is null then raise exception 'Aucune box possédée trouvée'; end if;

  for v_day in 0..4 loop                         -- 0 = Lundi … 4 = Vendredi
    for v_slot in 0..5 loop                       -- créneaux 07:00 → 12:00 (fin 13:00)
      v_hour := 7 + v_slot;

      -- Court 1 : toujours CrossFit
      insert into public.class_schedules
        (organization_id, title, session_type, weekday, start_time, duration_min, capacity, start_date)
      values (v_org, 'CrossFit', 'CrossFit', v_day, make_time(v_hour, 0, 0), 60, 14, current_date);

      -- Court 2 : type alterné selon le créneau
      v_alt_type := v_alt[1 + (v_slot % array_length(v_alt, 1))];
      insert into public.class_schedules
        (organization_id, title, session_type, weekday, start_time, duration_min, capacity, start_date)
      values (v_org, v_alt_type, v_alt_type, v_day, make_time(v_hour, 0, 0), 60, 12, current_date);
    end loop;

    -- Après-midi : créneau libre (Open Gym), réservable par les membres
    insert into public.class_schedules
      (organization_id, title, session_type, weekday, start_time, duration_min, capacity, start_date)
    values (v_org, 'Open Gym (libre)', 'Open Gym', v_day, make_time(17, 0, 0), 120, 25, current_date);
  end loop;
end $$;

-- ── Cleanup (run to remove ONLY this seed; safe if run right after seeding) ──
-- delete from public.class_schedules
--   where organization_id = (select organization_id from public.memberships
--                            where user_id = 'fade2de8-666f-420d-b4a8-abc491ae3e78'
--                              and role = 'owner' order by created_at limit 1)
--     and created_at > now() - interval '1 hour';
