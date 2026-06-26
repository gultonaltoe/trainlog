-- ============================================================
-- 20260626130000_booking_window.sql
-- Booking-window enforcement for member reservations, configured per box in
-- organizations.settings -> 'reservations':
--   bookAheadDays  int  — members can only book occurrences within this many
--                         days from today (0 = no limit)
--   bookCutoffMin  int  — booking closes this many minutes before start (0 = until start)
-- Re-defines book_class to enforce both (and drops the now-inert 'staff' role).
-- Safe to re-run.
-- ============================================================

create or replace function public.book_class(p_schedule_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  s   public.class_schedules%rowtype;
  v_booked     int;
  v_waitlisted int;
  v_wl_enabled bool;
  v_wl_cap     int;
  v_ahead      int;
  v_cutoff     int;
  v_status     text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id and active;
  if not found then raise exception 'Cours introuvable'; end if;

  -- Must be an active member (any role) of the box.
  if not has_org_role(s.organization_id, array['owner','coach','member']) then
    raise exception 'Tu n''es pas membre de cette box';
  end if;

  -- The date must be a real, future occurrence of this weekly schedule.
  if (extract(dow from p_date)::int + 6) % 7 <> s.weekday then
    raise exception 'Ce cours n''a pas lieu ce jour';
  end if;
  if p_date < s.start_date then
    raise exception 'Ce cours n''a pas encore commencé';
  end if;
  if occurrence_start(p_schedule_id, p_date) < now() then
    raise exception 'Ce cours est déjà passé';
  end if;

  -- Booking window: not too far ahead, and before the booking cutoff.
  v_ahead := (resa_setting(s.organization_id, 'bookAheadDays', '0'::jsonb))::int;
  if v_ahead > 0 and p_date > (current_date + v_ahead) then
    raise exception 'Réservations pas encore ouvertes (ouvre % jours avant)', v_ahead;
  end if;
  v_cutoff := (resa_setting(s.organization_id, 'bookCutoffMin', '0'::jsonb))::int;
  if now() > occurrence_start(p_schedule_id, p_date) - make_interval(mins => v_cutoff) then
    raise exception 'Réservations fermées pour ce cours';
  end if;

  -- Already booked?
  if exists (select 1 from public.class_reservations
             where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = uid) then
    raise exception 'Tu as déjà réservé ce cours';
  end if;

  select count(*) filter (where status = 'booked'),
         count(*) filter (where status = 'waitlisted')
    into v_booked, v_waitlisted
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date;

  if v_booked < s.capacity then
    v_status := 'booked';
  else
    v_wl_enabled := (resa_setting(s.organization_id, 'waitlistEnabled', 'true'::jsonb))::bool;
    if not v_wl_enabled then raise exception 'Cours complet'; end if;
    v_wl_cap := coalesce(s.waitlist_capacity,
                         (resa_setting(s.organization_id, 'waitlistCapacity', '5'::jsonb))::int);
    if v_waitlisted >= v_wl_cap then raise exception 'Liste d''attente complète'; end if;
    v_status := 'waitlisted';
  end if;

  insert into public.class_reservations (organization_id, schedule_id, occurrence_date, user_id, status)
    values (s.organization_id, p_schedule_id, p_date, uid, v_status);

  return v_status;
end;
$$;

grant execute on function public.book_class(uuid, date) to authenticated;
