-- ============================================================
-- 20260629110000_waitlist_escalation.sql
-- ST-32: make the "Notifier 1er" (strict-order) waitlist mode actually work.
-- Until now it offered the freed spot to the first waitlisted person and waited
-- FOREVER if they didn't claim. This adds a confirmation window
-- (settings.reservations.waitlistNotifyWindowMin, default 30 min): once it
-- lapses, the offer passes to the next in line. When everyone has had their
-- window, the seat is simply left open (anyone can re-book). No scheduler:
-- escalation is LAZY — it runs whenever the occurrence sees activity
-- (book / cancel / claim) and via sync_waitlist() when the booking page loads.
--
-- Offered-but-protected: in notify mode an active offer reserves the seat, so a
-- new booker can't jump the queue (they're waitlisted behind it).
--
-- Self-contained: re-issues book_class / cancel_class / claim_waitlist_spot
-- with the full ST-61 logic (plan gate, credits, booking window, max bookings,
-- notify_all) plus escalation. Run in the Supabase SQL editor. Safe to re-run.
-- "Offered already, didn't claim" = notified_at set but older than the window;
-- such rows are never re-offered (only notified_at IS NULL rows are).
-- ============================================================

-- ── escalate: offer freed seats down the strict-order queue (notify mode) ──
create or replace function public.escalate_waitlist(p_schedule_id uuid, p_date date)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s        public.class_schedules%rowtype;
  v_mode   text;
  v_window int;
  v_booked int;
  v_free   int;
  v_active int;
  v_offer  int;
  r        record;
begin
  select * into s from public.class_schedules where id = p_schedule_id;
  if not found then return; end if;

  -- Only the strict-order "notify" mode uses timed single offers.
  v_mode := trim(both '"' from (resa_setting(s.organization_id, 'waitlistMode', '"auto_promote"'::jsonb))::text);
  if v_mode <> 'notify' then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));

  v_window := coalesce((resa_setting(s.organization_id, 'waitlistNotifyWindowMin', '30'::jsonb))::int, 30);

  select count(*) filter (where status = 'booked') into v_booked
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date;
  v_free := s.capacity - v_booked;
  if v_free <= 0 then return; end if;

  -- Offers still inside their confirmation window keep their seat reserved.
  select count(*) into v_active
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date
      and status = 'waitlisted' and notified_at is not null
      and notified_at > now() - make_interval(mins => v_window);

  v_offer := v_free - v_active;
  if v_offer <= 0 then return; end if;

  -- Offer to the next never-offered waitlisters, in queue order. Anyone whose
  -- window already lapsed (notified_at set, old) is skipped — strict one shot.
  for r in
    select id from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date
      and status = 'waitlisted' and notified_at is null
    order by created_at
    limit v_offer
  loop
    update public.class_reservations set notified_at = now() where id = r.id;
  end loop;
  -- Fewer un-offered than free seats → the rest stay open (fallback: leave open).
end;
$$;

grant execute on function public.escalate_waitlist(uuid, date) to authenticated;

-- ── sync: escalate every waitlisted occurrence in a range (called on page load) ──
create or replace function public.sync_waitlist(p_org_id uuid, p_from date, p_to date)
returns void
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  if not has_org_role(p_org_id, array['owner','coach','staff','member']) then return; end if;
  for r in
    select distinct schedule_id, occurrence_date
    from public.class_reservations
    where organization_id = p_org_id and occurrence_date between p_from and p_to
      and status = 'waitlisted'
  loop
    perform public.escalate_waitlist(r.schedule_id, r.occurrence_date);
  end loop;
end;
$$;

grant execute on function public.sync_waitlist(uuid, date, date) to authenticated;

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
  v_mode       text;
  v_window     int;
  v_offers     int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id and active;
  if not found then raise exception 'Cours introuvable'; end if;

  -- Serialize concurrent bookings on the same occurrence (ST-46).
  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));
  -- Strict-order queue takes priority: pass any lapsed offers along first (ST-32).
  perform public.escalate_waitlist(p_schedule_id, p_date);

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

  -- ST-32: in strict-order mode, active offers reserve their seat — a new booker
  -- can't take a seat currently offered to someone ahead of them in the queue.
  v_mode := trim(both '"' from (resa_setting(s.organization_id, 'waitlistMode', '"auto_promote"'::jsonb))::text);
  v_offers := 0;
  if v_mode = 'notify' then
    v_window := coalesce((resa_setting(s.organization_id, 'waitlistNotifyWindowMin', '30'::jsonb))::int, 30);
    select count(*) into v_offers
      from public.class_reservations
      where schedule_id = p_schedule_id and occurrence_date = p_date
        and status = 'waitlisted' and notified_at is not null
        and notified_at > now() - make_interval(mins => v_window);
  end if;

  if (v_booked + v_offers) < s.capacity then
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

  -- A confirmed spot opened up — handle the waitlist by mode (ST-24 / ST-32).
  if v_was_booked then
    v_wl_enabled := (resa_setting(s.organization_id, 'waitlistEnabled', 'true'::jsonb))::bool;
    if v_wl_enabled then
      v_mode := trim(both '"' from (resa_setting(s.organization_id, 'waitlistMode', '"auto_promote"'::jsonb))::text);

      if v_mode = 'notify_all' then
        -- Tell everyone waiting; first to claim wins (FCFS).
        update public.class_reservations set notified_at = now()
          where schedule_id = p_schedule_id and occurrence_date = p_date
            and status = 'waitlisted' and notified_at is null;

      elsif v_mode = 'notify' then
        -- ST-32: strict order with a confirmation window — offer to the next in line.
        perform public.escalate_waitlist(p_schedule_id, p_date);

      else
        -- auto_promote: book the earliest waitlisted immediately.
        select id, user_id into v_next_id, v_next_uid from public.class_reservations
          where schedule_id = p_schedule_id and occurrence_date = p_date and status = 'waitlisted'
          order by created_at limit 1;
        if found then
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
  v_mode      text;
  v_window    int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id;
  if not found then raise exception 'Cours introuvable'; end if;

  -- Serialize against concurrent claims/bookings (ST-46): enforces FCFS.
  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));

  v_mode := trim(both '"' from (resa_setting(s.organization_id, 'waitlistMode', '"auto_promote"'::jsonb))::text);

  -- My offer must exist and, in strict-order mode, still be within its window (ST-32).
  if v_mode = 'notify' then
    v_window := coalesce((resa_setting(s.organization_id, 'waitlistNotifyWindowMin', '30'::jsonb))::int, 30);
    select id into v_mine from public.class_reservations
      where schedule_id = p_schedule_id and occurrence_date = p_date
        and user_id = uid and status = 'waitlisted'
        and notified_at is not null and notified_at > now() - make_interval(mins => v_window);
    if not found then raise exception 'Ton délai de confirmation est dépassé'; end if;
  else
    select id into v_mine from public.class_reservations
      where schedule_id = p_schedule_id and occurrence_date = p_date
        and user_id = uid and status = 'waitlisted' and notified_at is not null;
    if not found then raise exception 'Aucune place à confirmer'; end if;
  end if;

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

-- ── get_bookings_in_range: my_notified reflects an ACTIVE offer ─────────────
-- In strict-order mode, a lapsed offer no longer shows the "confirm" CTA.
create or replace function public.get_bookings_in_range(p_org_id uuid, p_from date, p_to date)
returns table (
  schedule_id      uuid,
  occurrence_date  date,
  booked_count     int,
  waitlist_count   int,
  my_status        text,
  my_position      int,
  my_notified      boolean
)
language sql stable security definer set search_path = public
as $$
  with cfg as (
    select trim(both '"' from (resa_setting(p_org_id, 'waitlistMode', '"auto_promote"'::jsonb))::text) as mode,
           coalesce((resa_setting(p_org_id, 'waitlistNotifyWindowMin', '30'::jsonb))::int, 30) as win
  ),
  ranked as (
    select r.*,
           rank() over (partition by r.schedule_id, r.occurrence_date, r.status
                        order by r.created_at) as rnk
    from public.class_reservations r
    where r.organization_id = p_org_id
      and r.occurrence_date between p_from and p_to
  )
  select
    schedule_id,
    occurrence_date,
    count(*) filter (where status = 'booked')::int,
    count(*) filter (where status = 'waitlisted')::int,
    max(status) filter (where user_id = (select auth.uid())),
    max(rnk)    filter (where user_id = (select auth.uid()))::int,
    bool_or(user_id = (select auth.uid()) and notified_at is not null
            and ((select mode from cfg) <> 'notify'
                 or notified_at > now() - make_interval(mins => (select win from cfg))))
  from ranked
  where has_org_role(p_org_id, array['owner','coach','staff','member'])
  group by schedule_id, occurrence_date;
$$;

grant execute on function public.get_bookings_in_range(uuid, date, date) to authenticated;
