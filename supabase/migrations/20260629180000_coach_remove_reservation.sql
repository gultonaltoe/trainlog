-- ============================================================
-- 20260629180000_coach_remove_reservation.sql
-- Let a box owner/coach/staff remove a member from a class occurrence — whether
-- booked or waitlisted. SECURITY DEFINER + has_org_role gate (members can't use
-- it on others). On removing a BOOKED seat it frees the spot and runs the same
-- waitlist handling as a normal cancel (auto_promote / notify / notify_all) and
-- refunds the member's pack credit. Idempotent / safe to re-run.
-- ============================================================

create or replace function public.coach_remove_reservation(p_schedule_id uuid, p_date date, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s            public.class_schedules%rowtype;
  v_was_booked bool;
  v_mp         uuid;
  v_wl_enabled bool;
  v_mode       text;
  v_next_id    uuid;
  v_next_uid   uuid;
  v_pick_id    uuid;
  v_pick_pack  bool;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id;
  if not found then raise exception 'Cours introuvable'; end if;

  if not has_org_role(s.organization_id, array['owner','coach','staff']) then
    raise exception 'Action réservée au staff de la box';
  end if;

  -- Serialize against concurrent booking/cancel/promotion on this occurrence.
  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text || '|' || p_date::text, 0));

  select (status = 'booked'), member_plan_id into v_was_booked, v_mp
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = p_user_id;
  if not found then raise exception 'Réservation introuvable'; end if;

  delete from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = p_user_id;

  -- Refund the pack credit this booking consumed (ST-10/16).
  if v_mp is not null then
    update public.member_plans set credits_remaining = coalesce(credits_remaining, 0) + 1 where id = v_mp;
  end if;

  -- Removing a confirmed seat frees a spot → handle the waitlist by mode (ST-24 / ST-32).
  if v_was_booked then
    v_wl_enabled := (resa_setting(s.organization_id, 'waitlistEnabled', 'true'::jsonb))::bool;
    if v_wl_enabled then
      v_mode := trim(both '"' from (resa_setting(s.organization_id, 'waitlistMode', '"auto_promote"'::jsonb))::text);

      if v_mode = 'notify_all' then
        update public.class_reservations set notified_at = now()
          where schedule_id = p_schedule_id and occurrence_date = p_date
            and status = 'waitlisted' and notified_at is null;

      elsif v_mode = 'notify' then
        perform public.escalate_waitlist(p_schedule_id, p_date);

      else
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
end;
$$;

grant execute on function public.coach_remove_reservation(uuid, date, uuid) to authenticated;
