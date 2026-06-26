-- ============================================================
-- 20260626190000_waitlist_notify_all.sql
-- ST-24: third waitlist mode 'notify_all' — when a booked spot frees, notify
-- EVERYONE on the waitlist; first to claim gets it (first-come-first-served).
-- Re-defines cancel_class to add the notify_all branch (auto_promote / notify
-- unchanged). claim_waitlist_spot already enforces FCFS via the capacity check.
-- Safe to re-run.
-- ============================================================

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

  -- A confirmed spot opened up — handle the waitlist by mode.
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
