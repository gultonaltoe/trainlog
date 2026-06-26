-- ============================================================
-- 20260626170000_notifications.sql
-- In-app notifications (ST-4). A per-user feed; created server-side (triggers /
-- definer functions), read by the owner of the row. A trigger on
-- class_reservations auto-creates booking notifications (confirmed / waitlisted
-- / spot-freed) so the RPC bodies stay clean. Safe to re-run.
-- ============================================================

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  type            text not null,
  title           text not null,
  body            text,
  link            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

-- A user reads + marks-read their own notifications. Inserts happen server-side
-- (triggers / SECURITY DEFINER), so there's no member insert policy.
drop policy if exists read_notifications on public.notifications;
create policy read_notifications on public.notifications
  for select using (user_id = (select auth.uid()));

drop policy if exists update_notifications on public.notifications;
create policy update_notifications on public.notifications
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Auto-create booking notifications from reservation changes.
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
                'Une place s''est libérée — confirme vite', v_title || ' · ' || v_when, '/box/book');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservation_notify on public.class_reservations;
create trigger reservation_notify
  after insert or update on public.class_reservations
  for each row execute function public.tg_reservation_notify();
