-- ============================================================
-- seed_test_julien_box.sql  (TEST DATA — not a migration)  [ST-48]
-- Realistic weekly planning for the box named 'Test Julien Test':
--   • Mon–Fri, 1h classes 07:00 → 13:00 (slots start 07–12)
--   • Exactly 2 classes in parallel per slot (court 1 = CrossFit, court 2 = mix)
--   • An afternoon "Open Gym (libre)" slot members can also book
-- Self-cleaning: deletes the box's existing schedules first, so re-running
-- always yields exactly 2 in parallel (no duplicates).
-- Run in the Supabase SQL editor.
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
  select id into v_org from public.organizations where name = 'Test Julien Test' order by created_at limit 1;
  if v_org is null then raise exception 'Box « Test Julien Test » introuvable'; end if;

  -- Clean slate (cascades to class_reservations — fine for the test box).
  delete from public.class_schedules where organization_id = v_org;

  for v_day in 0..4 loop                         -- 0 = Lundi … 4 = Vendredi
    for v_slot in 0..5 loop                       -- 07:00 → 12:00 (fin 13:00)
      v_hour := 7 + v_slot;

      insert into public.class_schedules
        (organization_id, title, session_type, weekday, start_time, duration_min, capacity, start_date)
      values (v_org, 'CrossFit', 'CrossFit', v_day, make_time(v_hour, 0, 0), 60, 14, current_date);

      v_alt_type := v_alt[1 + (v_slot % array_length(v_alt, 1))];
      insert into public.class_schedules
        (organization_id, title, session_type, weekday, start_time, duration_min, capacity, start_date)
      values (v_org, v_alt_type, v_alt_type, v_day, make_time(v_hour, 0, 0), 60, 12, current_date);
    end loop;

    insert into public.class_schedules
      (organization_id, title, session_type, weekday, start_time, duration_min, capacity, start_date)
    values (v_org, 'Open Gym (libre)', 'Open Gym', v_day, make_time(17, 0, 0), 120, 25, current_date);
  end loop;
end $$;
