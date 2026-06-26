-- ============================================================
-- 20260625120000_class_reservations.sql
-- Member reservations for class occurrences. A reservation attaches to a
-- (schedule_id + occurrence_date) pair — occurrences themselves are computed,
-- not stored (see class_schedules).
--
-- Box-configurable behaviour (organizations.settings -> 'reservations'):
--   waitlistEnabled  bool   — allow joining a waitlist when a class is full
--   waitlistMode     text   — 'auto_promote' | 'notify' (on a freed spot)
--   waitlistCapacity int    — default max waitlist size (per-class override below)
--   cancelCutoffMin  int    — minutes before start inside which a booked
--                             reservation can no longer be cancelled
-- Per-class override: class_schedules.waitlist_capacity (null -> use box default).
--
-- All member-facing mutations go through SECURITY DEFINER RPCs so capacity,
-- cutoff and waitlist promotion are enforced server-side (members hold no
-- direct write policy). Safe to re-run.
-- ============================================================

-- Per-class waitlist size override (null = use the box default).
alter table public.class_schedules
  add column if not exists waitlist_capacity integer;

create table if not exists public.class_reservations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id     uuid not null references public.class_schedules(id) on delete cascade,
  occurrence_date date not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'booked' check (status in ('booked', 'waitlisted')),
  notified_at     timestamptz,                 -- set when a freed spot was offered/granted
  created_at      timestamptz not null default now(),
  unique (schedule_id, occurrence_date, user_id)
);

create index if not exists idx_class_reservations_occ
  on public.class_reservations(schedule_id, occurrence_date);
create index if not exists idx_class_reservations_user
  on public.class_reservations(user_id);

alter table public.class_reservations enable row level security;

-- Read: a member sees their own reservations; staff see the full roster.
drop policy if exists read_class_reservations on public.class_reservations;
create policy read_class_reservations on public.class_reservations
  for select using (
    user_id = (select auth.uid())
    or has_org_role(organization_id, array['owner','coach','staff'])
  );
-- No member insert/update/delete policy on purpose: all writes go through the
-- RPCs below, which enforce capacity, cutoff and promotion.

-- ── helpers ────────────────────────────────────────────────
-- Read a reservations setting from the box settings jsonb, with a fallback.
create or replace function public.resa_setting(p_org_id uuid, p_key text, p_default jsonb)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select settings -> 'reservations' -> p_key
       from public.organizations where id = p_org_id),
    p_default
  );
$$;

-- Start timestamp of an occurrence, used for past-checks and the cancel cutoff.
create or replace function public.occurrence_start(p_schedule_id uuid, p_date date)
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select (p_date + start_time)::timestamptz
    from public.class_schedules where id = p_schedule_id;
$$;

-- ── book ───────────────────────────────────────────────────
-- Book (or waitlist) the current user onto an occurrence. Returns the resulting
-- status ('booked' | 'waitlisted'); raises a French message otherwise.
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

  -- Must be an active member (any role) of the box.
  if not has_org_role(s.organization_id, array['owner','coach','staff','member']) then
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

-- ── cancel ─────────────────────────────────────────────────
-- Cancel the current user's reservation. Booked cancellations respect the box
-- cutoff; waitlist cancellations are always allowed. When a booked spot frees
-- up, the earliest waitlisted member is promoted (auto_promote) or flagged for
-- notification (notify). Returns 'cancelled'.
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

  select (status = 'booked') into v_was_booked
    from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = uid;
  if not found then raise exception 'Aucune réservation à annuler'; end if;

  -- Cancel cutoff applies only to confirmed (booked) spots.
  if v_was_booked then
    v_cutoff_min := (resa_setting(s.organization_id, 'cancelCutoffMin', '120'::jsonb))::int;
    if now() > occurrence_start(p_schedule_id, p_date) - make_interval(mins => v_cutoff_min) then
      raise exception 'Trop tard pour annuler (délai dépassé)';
    end if;
  end if;

  delete from public.class_reservations
    where schedule_id = p_schedule_id and occurrence_date = p_date and user_id = uid;

  -- A confirmed spot opened up — handle the waitlist.
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
        else  -- 'notify': member keeps their waitlist slot but is told to claim it
          update public.class_reservations set notified_at = now() where id = v_next;
        end if;
        -- NOTE: actual email/push delivery is deferred until a provider is wired;
        -- notified_at records the intent and drives the in-app prompt.
      end if;
    end if;
  end if;

  return 'cancelled';
end;
$$;

grant execute on function public.cancel_class(uuid, date) to authenticated;

-- ── claim (notify mode) ────────────────────────────────────
-- In 'notify' mode a freed spot is offered to the earliest waitlisted member,
-- who must confirm. This promotes their waitlist entry to booked, provided a
-- spot is genuinely free (guards against a race with other claimants).
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

grant execute on function public.claim_waitlist_spot(uuid, date) to authenticated;

-- ── reads ──────────────────────────────────────────────────
-- Booking counts for every occurrence in a date range, plus the caller's own
-- status/position. Privacy-preserving: no attendee names, just counts. Any
-- active member of the box may call it.
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
  with ranked as (
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
    bool_or(user_id = (select auth.uid()) and notified_at is not null)
  from ranked
  where has_org_role(p_org_id, array['owner','coach','staff','member'])
  group by schedule_id, occurrence_date;
$$;

grant execute on function public.get_bookings_in_range(uuid, date, date) to authenticated;

-- Attendee list for one occurrence (names), for the box staff roster view.
create or replace function public.get_occurrence_attendees(p_schedule_id uuid, p_date date)
returns table (
  user_id      uuid,
  first_name   text,
  status       text,
  wl_position  int,
  notified     boolean
)
language sql stable security definer set search_path = public
as $$
  select
    r.user_id,
    p.first_name,
    r.status,
    rank() over (partition by r.status order by r.created_at)::int,
    r.notified_at is not null
  from public.class_reservations r
  join public.class_schedules s on s.id = r.schedule_id
  left join public.user_profile p on p.user_id = r.user_id
  where r.schedule_id = p_schedule_id
    and r.occurrence_date = p_date
    and has_org_role(s.organization_id, array['owner','coach','staff'])
  order by r.status, r.created_at;
$$;

grant execute on function public.get_occurrence_attendees(uuid, date) to authenticated;
