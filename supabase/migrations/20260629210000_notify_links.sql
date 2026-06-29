-- ============================================================
-- 20260629210000_notify_links.sql
-- Re-issue tg_reservation_notify so every booking/waitlist notification carries
-- a link, and point the "spot freed — confirm" offer at /box/book#mine (the
-- "Mes réservations" tab now has a "Confirmer ma place" button). Idempotent.
-- ============================================================

create or replace function public.tg_reservation_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_title text;
  v_when  text;
begin
  select title into v_title from public.class_schedules where id = new.schedule_id;
  v_title := coalesce(v_title, 'Cours');
  v_when  := to_char(new.occurrence_date, 'DD/MM');

  if tg_op = 'INSERT' then
    if new.status = 'booked' then
      insert into public.notifications (user_id, organization_id, type, title, body, link)
        values (new.user_id, new.organization_id, 'booking_confirmed',
                'Réservation confirmée', v_title || ' · ' || v_when, '/box/book#mine');
    elsif new.status = 'waitlisted' then
      insert into public.notifications (user_id, organization_id, type, title, body, link)
        values (new.user_id, new.organization_id, 'waitlist_joined',
                'Ajouté en liste d''attente', v_title || ' · ' || v_when, '/box/book#mine');
    end if;

  elsif tg_op = 'UPDATE' and new.notified_at is not null and old.notified_at is null then
    if new.status = 'booked' then
      insert into public.notifications (user_id, organization_id, type, title, body, link)
        values (new.user_id, new.organization_id, 'waitlist_promoted',
                'Une place s''est libérée — tu es inscrit !', v_title || ' · ' || v_when, '/box/book#mine');
    else
      insert into public.notifications (user_id, organization_id, type, title, body, link)
        values (new.user_id, new.organization_id, 'waitlist_offer',
                'Une place s''est libérée — confirme vite', v_title || ' · ' || v_when, '/box/book#mine');
    end if;
  end if;

  return new;
end;
$$;
