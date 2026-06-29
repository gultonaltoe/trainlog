-- ============================================================
-- 20260629100000_booking_unify_fix.sql
-- ST-6 review fix: the ST-46 (concurrency) and ST-31 (max bookings) rewrites of
-- book_class / cancel_class / claim_waitlist_spot were built on a stale base and
-- dropped logic added earlier the same week:
--   • plan gate + pack-credit accounting (ST-10/16)
--   • booking window: bookAheadDays / bookCutoffMin (booking_window)
--   • notify_all waitlist mode (ST-24)
--   • member_plan_id recorded on reservations
-- This re-issues all three with EVERY feature merged + the per-occurrence
-- advisory lock kept. Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── book ───────────────────────────────────────────────────
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
  v_is_member  bool;
  v_require    bool;
  v_pick_id    uuid;
  v_pick_pack  bool;
  v_mp         uuid;
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
  if p_date < s.start_date then raise exception 'Ce cours n''a pas encore commencé'; end if;
  if occurrence_start(p_schedule_id, p_date) < now() then raise exception 'Ce cours est déjà passé'; end if;

  -- Booking window (booking_window).
  v_ahead := (resa_setting(s.organization_id, 'bookAheadDays', '0'::jsonb))::int;
  if v_ahead > 0 and p_date > (current_date + v_ahead) then
    raise exception 'Réservations pas encore ouvertes (ouvre % jours avant)', v_ahead;
  end if;
  v_cutoff := (resa_setting(s.organization_id, 'bookCutoffMin', '0'::jsonb))::int;
  if now() > occurrence_start(p_schedule_id, p_date) - make_interval(mins => v_cutoff) then
    raise exception 'Réservations fermées pour ce cours';
  end if;

  if exists (select 1 from public.class_reservations
             where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = uid) then
    raise exception 'Tu as déjà réservé ce cours';
  end if;

  -- Owner/coach/staff are exempt from member-only limits (max bookings, plan gate).
  v_is_member := not has_org_role(s.organization_id, array['owner','coach','staff']);

  -- ST-31: cap upcoming reservations per member (0 = unlimited).
  if v_is_member then
    v_max := (resa_setting(s.organization_id, 'maxActiveBookings', '0'::jsonb))::int;
    if v_max > 0 then
      select count(*) into v_active
        from public.class_reservations
        where organization_id = s.organization_id and user_id = uid
          and occurrence_date >= current_date and status in ('booked','waitlisted');
      if v_active >= v_max then
        raise exception 'Limite de % réservations actives atteinte', v_max;
      end if;
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

  -- ST-10/16: plan gate + pack-credit charge (members only).
  if v_is_member then
    v_require := (resa_setting(s.organization_id, 'requirePlan', 'false'::jsonb))::bool;
    select mp_id, is_pack into v_pick_id, v_pick_pack
      from public.pick_member_plan(s.organization_id, uid, p_date);
    if v_require and v_pick_id is null then
      raise exception 'Aucun abonnement actif — choisis un abonnement';
    end if;
    if v_status = 'booked' and v_pick_id is not null and v_pick_pack then
      update public.member_plans set credits_remaining = greatest(coalesce(credits_remaining, 0) - 1, 0)
        where id = v_pick_id;
      v_mp := v_pick_id;
    end if;
  end if;

  insert into public.class_reservations (organization_id, schedule_id, occurrence_date, user_id, status, member_plan_id)
    values (s.organization_id, p_schedule_id, p_date, uid, v_status, v_mp);

  return v_status;
end;
$$;

grant execute on function public.book_class(uuid, date) to authenticated;

-- ── cancel ─────────────────────────────────────────────────
create or replace function public.cancel_class(p_schedule_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  s   public.class_schedules%rowtype;
  v_was_booked bool;
  v_my_mp      uuid;
  v_cutoff_min int;
  v_wl_enabled bool;
  v_mode       text;
  v_next_id    uuid;
  v_next_uid   uuid;
  v_pick_id    uuid;
  v_pick_pack  bool;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id;
  if not found then raise exception 'Cours introuvable'; end if;

  -- Serialize against concurrent booking/promotion on the same occurrence (ST-46).
  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));

  select (status = 'booked'), member_plan_id into v_was_booked, v_my_mp
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

  -- Refund the pack credit this booking consumed (ST-10/16).
  if v_my_mp is not null then
    update public.member_plans set credits_remaining = coalesce(credits_remaining, 0) + 1 where id = v_my_mp;
  end if;

  -- A confirmed spot opened up — handle the waitlist by mode (ST-24).
  if v_was_booked then
    v_wl_enabled := (resa_setting(s.organization_id, 'waitlistEnabled', 'true'::jsonb))::bool;
    if v_wl_enabled then
      v_mode := trim(both '"' from (resa_setting(s.organization_id, 'waitlistMode', '"auto_promote"'::jsonb))::text);

      if v_mode = 'notify_all' then
        -- Tell everyone waiting; first to claim wins (FCFS).
        update public.class_reservations set notified_at = now()
          where schedule_id = p_schedule_id and occurrence_date = p_date
            and status = 'waitlisted' and notified_at is null;

      else
        -- auto_promote / notify both target the earliest waitlisted entry.
        select id, user_id into v_next_id, v_next_uid from public.class_reservations
          where schedule_id = p_schedule_id and occurrence_date = p_date and status = 'waitlisted'
          order by created_at limit 1;
        if found then
          if v_mode = 'auto_promote' then
            select mp_id, is_pack into v_pick_id, v_pick_pack
              from public.pick_member_plan(s.organization_id, v_next_uid, p_date);
            if v_pick_id is not null and v_pick_pack then
              update public.member_plans set credits_remaining = greatest(coalesce(credits_remaining, 0) - 1, 0)
                where id = v_pick_id;
              update public.class_reservations set status = 'booked', notified_at = now(), member_plan_id = v_pick_id
                where id = v_next_id;
            else
              update public.class_reservations set status = 'booked', notified_at = now(), member_plan_id = null
                where id = v_next_id;
            end if;
          else  -- 'notify' (first only)
            update public.class_reservations set notified_at = now() where id = v_next_id;
          end if;
        end if;
      end if;
    end if;
  end if;

  return 'cancelled';
end;
$$;

grant execute on function public.cancel_class(uuid, date) to authenticated;

-- ── claim (notify / notify_all mode) ───────────────────────
create or replace function public.claim_waitlist_spot(p_schedule_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  s   public.class_schedules%rowtype;
  v_booked    int;
  v_mine      uuid;
  v_pick_id   uuid;
  v_pick_pack bool;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id;
  if not found then raise exception 'Cours introuvable'; end if;

  -- Serialize against concurrent claims/bookings (ST-46): enforces FCFS.
  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));

  select id into v_mine from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date
      and user_id = uid and status = 'waitlisted' and notified_at is not null;
  if not found then raise exception 'Aucune place à confirmer'; end if;

  select count(*) filter (where status = 'booked') into v_booked
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date;
  if v_booked >= s.capacity then raise exception 'La place vient d''être prise'; end if;

  -- Charge the claiming member's pack credit if applicable (ST-10/16).
  select mp_id, is_pack into v_pick_id, v_pick_pack
    from public.pick_member_plan(s.organization_id, uid, p_date);
  if v_pick_id is not null and v_pick_pack then
    update public.member_plans set credits_remaining = greatest(coalesce(credits_remaining, 0) - 1, 0)
      where id = v_pick_id;
    update public.class_reservations set status = 'booked', member_plan_id = v_pick_id where id = v_mine;
  else
    update public.class_reservations set status = 'booked', member_plan_id = null where id = v_mine;
  end if;

  return 'booked';
end;
$$;

grant execute on function public.claim_waitlist_spot(uuid, date) to authenticated;
