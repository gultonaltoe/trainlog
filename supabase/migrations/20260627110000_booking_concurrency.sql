-- ST-46: make booking race-safe under concurrent actions.
-- Two members grabbing the last seat at the same time could both pass the
-- capacity check before either inserts. Fix: take a transaction-scoped advisory
-- lock keyed on the occurrence (schedule + date) at the start of each mutating
-- RPC, so count→insert/update is serialized per occurrence. Lock auto-releases
-- at commit/rollback. Run in the Supabase SQL editor (safe to re-run).

-- ── book ───────────────────────────────────────────────────
create or replace function public.book_class(p_schedule_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  s   public.class_schedules%rowtype;
  v_booked    int;
  v_waitlisted int;
  v_wl_enabled bool;
  v_wl_cap     int;
  v_status     text;
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

-- ── cancel ─────────────────────────────────────────────────
create or replace function public.cancel_class(p_schedule_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  s   public.class_schedules%rowtype;
  v_was_booked bool;
  v_cutoff_min int;
  v_wl_enabled bool;
  v_mode       text;
  v_next       uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id;
  if not found then raise exception 'Cours introuvable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));

  select (status = 'booked') into v_was_booked
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = uid;
  if not found then raise exception 'Aucune réservation à annuler'; end if;

  if v_was_booked then
    v_cutoff_min := (resa_setting(s.organization_id, 'cancelCutoffMin', '120'::jsonb))::int;
    if now() > occurrence_start(p_schedule_id, p_date) - make_interval(mins => v_cutoff_min) then
      raise exception 'Trop tard pour annuler (délai dépassé)';
    end if;
  end if;

  delete from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = uid;

  if v_was_booked then
    v_wl_enabled := (resa_setting(s.organization_id, 'waitlistEnabled', 'true'::jsonb))::bool;
    if v_wl_enabled then
      select id into v_next from public.class_reservations
        where schedule_id = p_schedule_id and occurrence_date = p_date and status = 'waitlisted'
        order by created_at limit 1;
      if found then
        v_mode := trim(both '"' from (resa_setting(s.organization_id, 'waitlistMode', '"auto_promote"'::jsonb))::text);
        if v_mode = 'auto_promote' then
          update public.class_reservations set status = 'booked', notified_at = now() where id = v_next;
        else
          update public.class_reservations set notified_at = now() where id = v_next;
        end if;
      end if;
    end if;
  end if;

  return 'cancelled';
end;
$$;

-- ── claim (notify mode) ────────────────────────────────────
create or replace function public.claim_waitlist_spot(p_schedule_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  s   public.class_schedules%rowtype;
  v_booked int;
  v_mine   uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id;
  if not found then raise exception 'Cours introuvable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));

  select id into v_mine from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date
      and user_id = uid and status = 'waitlisted' and notified_at is not null;
  if not found then raise exception 'Aucune place à confirmer'; end if;

  select count(*) filter (where status = 'booked') into v_booked
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date;
  if v_booked >= s.capacity then raise exception 'La place vient d''être prise'; end if;

  update public.class_reservations set status = 'booked' where id = v_mine;
  return 'booked';
end;
$$;
