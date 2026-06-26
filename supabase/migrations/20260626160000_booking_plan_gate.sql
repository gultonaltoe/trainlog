-- ============================================================
-- 20260626160000_booking_plan_gate.sql
-- ST-10 stage 3: booking gated by membership plan + credit accounting.
--   settings.reservations.requirePlan (bool, default false): members need a
--     usable plan to book/waitlist (owner/coach exempt).
--   Prefer a non-pack plan (unlimited/trial/time) so pack credits aren't wasted;
--     only decrement a pack credit when a 'booked' spot is actually taken.
--   The charged member_plan is recorded on the reservation and refunded on cancel.
--   Promotion (auto_promote) and claim (notify) charge the promoted member.
-- Re-defines book_class / cancel_class / claim_waitlist_spot. Safe to re-run.
-- ============================================================

alter table public.class_reservations
  add column if not exists member_plan_id uuid references public.member_plans(id) on delete set null;

-- Choose which member_plan covers a booking on p_date: a usable non-pack plan
-- first (no credit cost), else a pack with credits left. Returns null if none.
create or replace function public.pick_member_plan(p_org uuid, p_uid uuid, p_date date)
returns table (mp_id uuid, is_pack boolean)
language sql stable security definer set search_path = public
as $$
  select mp.id, (pl.kind = 'pack')
  from public.member_plans mp
  join public.membership_plans pl on pl.id = mp.plan_id
  where mp.organization_id = p_org and mp.user_id = p_uid
    and mp.status = 'active'
    and (mp.ends_on is null or mp.ends_on >= p_date)
    and (pl.kind <> 'pack' or coalesce(mp.credits_remaining, 0) > 0)
  order by (pl.kind = 'pack') asc, mp.created_at asc
  limit 1;
$$;

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
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id and active;
  if not found then raise exception 'Cours introuvable'; end if;

  if not has_org_role(s.organization_id, array['owner','coach','member']) then
    raise exception 'Tu n''es pas membre de cette box';
  end if;

  if (extract(dow from p_date)::int + 6) % 7 <> s.weekday then
    raise exception 'Ce cours n''a pas lieu ce jour';
  end if;
  if p_date < s.start_date then raise exception 'Ce cours n''a pas encore commencé'; end if;
  if occurrence_start(p_schedule_id, p_date) < now() then raise exception 'Ce cours est déjà passé'; end if;

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

  -- Plan gate + credit charge (members only; owner/coach exempt).
  v_is_member := not has_org_role(s.organization_id, array['owner','coach']);
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

  -- Refund the pack credit this booking consumed.
  if v_my_mp is not null then
    update public.member_plans set credits_remaining = coalesce(credits_remaining, 0) + 1 where id = v_my_mp;
  end if;

  -- A confirmed spot opened up — handle the waitlist.
  if v_was_booked then
    v_wl_enabled := (resa_setting(s.organization_id, 'waitlistEnabled', 'true'::jsonb))::bool;
    if v_wl_enabled then
      select id, user_id into v_next_id, v_next_uid from public.class_reservations
        where schedule_id = p_schedule_id and occurrence_date = p_date and status = 'waitlisted'
        order by created_at limit 1;
      if found then
        v_mode := trim(both '"' from (resa_setting(s.organization_id, 'waitlistMode', '"auto_promote"'::jsonb))::text);
        if v_mode = 'auto_promote' then
          -- Charge the promoted member (pack credit) if applicable.
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
        else
          update public.class_reservations set notified_at = now() where id = v_next_id;
        end if;
      end if;
    end if;
  end if;

  return 'cancelled';
end;
$$;

grant execute on function public.cancel_class(uuid, date) to authenticated;

-- ── claim (notify mode) ────────────────────────────────────
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

  select id into v_mine from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date
      and user_id = uid and status = 'waitlisted' and notified_at is not null;
  if not found then raise exception 'Aucune place à confirmer'; end if;

  select count(*) filter (where status = 'booked') into v_booked
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date;
  if v_booked >= s.capacity then raise exception 'La place vient d''être prise'; end if;

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
