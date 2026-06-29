-- ST-31: enforce a max number of active (upcoming) reservations per member.
-- Reads settings.reservations.maxActiveBookings (0 = unlimited). Counts the
-- member's upcoming reservations (booked or waitlisted, occurrence today onward)
-- in this box. Owner/coach are exempt. This supersedes the book_class from
-- _release_concurrency.sql (keeps the per-occurrence advisory lock).
-- Run in the Supabase SQL editor (safe to re-run).

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
  v_status     text;
  v_max        int;
  v_active     int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id and active;
  if not found then raise exception 'Cours introuvable'; end if;

  -- Serialize concurrent bookings on the same occurrence (ST-46).
  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));

  if not has_org_role(s.organization_id, array['owner','coach','staff','member']) then
    raise exception 'Tu n''es pas membre de cette box';
  end if;

  if (extract(dow from p_date)::int + 6) % 7 <> s.weekday then
    raise exception 'Ce cours n''a pas lieu ce jour';
  end if;
  if p_date < s.start_date then
    raise exception 'Ce cours n''a pas encore commencé';
  end if;
  if occurrence_start(p_schedule_id, p_date) < now() then
    raise exception 'Ce cours est déjà passé';
  end if;

  if exists (select 1 from public.class_reservations
             where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = uid) then
    raise exception 'Tu as déjà réservé ce cours';
  end if;

  -- ST-31: cap upcoming reservations per member (members only; owner/coach exempt).
  v_max := (resa_setting(s.organization_id, 'maxActiveBookings', '0'::jsonb))::int;
  if v_max > 0 and not has_org_role(s.organization_id, array['owner','coach','staff']) then
    select count(*) into v_active
      from public.class_reservations
      where organization_id = s.organization_id and user_id = uid
        and occurrence_date >= current_date and status in ('booked','waitlisted');
    if v_active >= v_max then
      raise exception 'Limite de % réservations actives atteinte', v_max;
    end if;
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
