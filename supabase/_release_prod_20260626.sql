-- Trainlog prod release 2026-06-26 — run top to bottom in the Supabase SQL Editor.
-- Excludes the local-only baseline. All verified via 'supabase db reset'.

-- ===== 20260625120000_class_reservations =====
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

-- ===== 20260626120000_invitations =====
-- ============================================================
-- 20260626120000_invitations.sql
-- Box-initiated invites by email. An owner invites someone (coach or member)
-- by email; a pending invitation is recorded. When that email logs in (now or
-- later), accept_my_invites() turns pending invitations into active memberships
-- — no approval step. Complements the athlete-initiated join-by-code flow.
--
-- Email matching is dot/case-insensitive for Gmail (Supabase treats
-- julien.altoe@ and julienaltoe@ as different users; normalize_email unifies
-- them) so the invite reaches the right person regardless of dot variants.
-- Safe to re-run.
-- ============================================================

-- Canonical form of an email for matching: lowercased+trimmed; for gmail/
-- googlemail, dots in the local part are stripped and the domain unified.
create or replace function public.normalize_email(p_email text)
returns text
language sql immutable
as $$
  select case
    when lower(btrim(p_email)) ~ '@(gmail|googlemail)\.com$'
      then regexp_replace(split_part(lower(btrim(p_email)), '@', 1), '\.', '', 'g') || '@gmail.com'
    else lower(btrim(p_email))
  end;
$$;

create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,                          -- as entered (lowercased), for display
  role            text not null default 'coach' check (role in ('coach', 'member')),
  invited_by      uuid references auth.users(id),
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz
);

-- One live (pending) invite per email per box.
create unique index if not exists uniq_pending_invite
  on public.invitations(organization_id, email) where status = 'pending';
create index if not exists idx_invitations_org on public.invitations(organization_id);

alter table public.invitations enable row level security;

-- Staff (owner/coach) of the box can see its invites. Invited users never read
-- this table directly — acceptance is server-side via the RPC below.
drop policy if exists read_invitations on public.invitations;
create policy read_invitations on public.invitations
  for select using (has_org_role(organization_id, array['owner', 'coach']));

-- Only the owner revokes (deletes) invites. Creation is via the RPC.
drop policy if exists delete_invitations on public.invitations;
create policy delete_invitations on public.invitations
  for delete using (has_org_role(organization_id, array['owner']));

-- ── create ─────────────────────────────────────────────────
-- Owner invites someone by email. Returns the invitation id.
create or replace function public.create_invite(p_org_id uuid, p_email text, p_role text default 'coach')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  v_email text := lower(btrim(p_email));
  v_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not has_org_role(p_org_id, array['owner']) then
    raise exception 'Seul le propriétaire peut inviter';
  end if;
  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Email invalide';
  end if;
  if p_role not in ('coach', 'member') then raise exception 'Rôle invalide'; end if;

  -- Already an active member of this box (match dot/case-insensitively)?
  if exists (
    select 1 from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_org_id and m.status = 'active'
      and normalize_email(u.email) = normalize_email(v_email)
  ) then
    raise exception 'Cette personne est déjà membre de la box';
  end if;

  insert into public.invitations (organization_id, email, role, invited_by, status)
    values (p_org_id, v_email, p_role, uid, 'pending')
    on conflict (organization_id, email) where (status = 'pending')
    do update set role = excluded.role, invited_by = excluded.invited_by
    returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_invite(uuid, text, text) to authenticated;

-- ── accept ─────────────────────────────────────────────────
-- Turn every pending invitation matching the current user's email into an
-- active membership. Called by the client after login. Returns how many were
-- accepted. Idempotent.
create or replace function public.accept_my_invites()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  v_email text;
  v_count int := 0;
  r record;
begin
  if uid is null then return 0; end if;
  select email into v_email from auth.users where id = uid;
  if v_email is null then return 0; end if;

  for r in
    select * from public.invitations
    where status = 'pending'
      and normalize_email(email) = normalize_email(v_email)
  loop
    insert into public.memberships (organization_id, user_id, role, status)
      values (r.organization_id, uid, r.role, 'active')
      on conflict (organization_id, user_id)
      do update set role = excluded.role, status = 'active';
    update public.invitations set status = 'accepted', accepted_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.accept_my_invites() to authenticated;

-- ===== 20260626130000_booking_window =====
-- ============================================================
-- 20260626130000_booking_window.sql
-- Booking-window enforcement for member reservations, configured per box in
-- organizations.settings -> 'reservations':
--   bookAheadDays  int  — members can only book occurrences within this many
--                         days from today (0 = no limit)
--   bookCutoffMin  int  — booking closes this many minutes before start (0 = until start)
-- Re-defines book_class to enforce both (and drops the now-inert 'staff' role).
-- Safe to re-run.
-- ============================================================

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
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into s from public.class_schedules where id = p_schedule_id and active;
  if not found then raise exception 'Cours introuvable'; end if;

  -- Must be an active member (any role) of the box.
  if not has_org_role(s.organization_id, array['owner','coach','member']) then
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

  -- Booking window: not too far ahead, and before the booking cutoff.
  v_ahead := (resa_setting(s.organization_id, 'bookAheadDays', '0'::jsonb))::int;
  if v_ahead > 0 and p_date > (current_date + v_ahead) then
    raise exception 'Réservations pas encore ouvertes (ouvre % jours avant)', v_ahead;
  end if;
  v_cutoff := (resa_setting(s.organization_id, 'bookCutoffMin', '0'::jsonb))::int;
  if now() > occurrence_start(p_schedule_id, p_date) - make_interval(mins => v_cutoff) then
    raise exception 'Réservations fermées pour ce cours';
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

-- ===== 20260626140000_membership_plans =====
-- ============================================================
-- 20260626140000_membership_plans.sql
-- ST-10 stage 1: a box's catalogue of membership plans (no payments yet).
--   kind: unlimited (time-based), pack (N credits), drop_in (single), trial
--   price_cents + currency; credits (packs); duration_days (validity window)
-- Owner manages; any member can read active plans. Safe to re-run.
-- ============================================================

create table if not exists public.membership_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  kind            text not null default 'unlimited' check (kind in ('unlimited', 'pack', 'drop_in', 'trial')),
  price_cents     integer not null default 0,
  currency        text not null default 'EUR',
  credits         integer,        -- pack: number of sessions; null for other kinds
  duration_days   integer,        -- validity window in days from start; null = no expiry
  recurring       boolean not null default false,   -- monthly auto-renew (Stripe, later)
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_membership_plans_org on public.membership_plans(organization_id);

alter table public.membership_plans enable row level security;

-- Members (any active role) can see the plans; only the owner manages them.
drop policy if exists read_membership_plans on public.membership_plans;
create policy read_membership_plans on public.membership_plans
  for select using (has_org_role(organization_id, array['owner', 'coach', 'member']));

drop policy if exists write_membership_plans on public.membership_plans;
create policy write_membership_plans on public.membership_plans
  for all using (has_org_role(organization_id, array['owner']))
          with check (has_org_role(organization_id, array['owner']));

-- ===== 20260626150000_member_plans =====
-- ============================================================
-- 20260626150000_member_plans.sql
-- ST-10 stage 2: a member's assigned membership plan(s). Assigned manually by
-- owner/coach for now; Stripe (stage 4) will create these on payment.
--   status: active | expired | cancelled
--   ends_on: validity end (from plan.duration_days); null = no expiry
--   credits_remaining: for 'pack' plans; null otherwise
-- Owner/coach manage; a member reads their own. Safe to re-run.
-- ============================================================

create table if not exists public.member_plans (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  plan_id           uuid not null references public.membership_plans(id) on delete restrict,
  status            text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_on         date not null default current_date,
  ends_on           date,
  credits_remaining integer,
  created_at        timestamptz not null default now()
);

create index if not exists idx_member_plans_org_user on public.member_plans(organization_id, user_id);
create index if not exists idx_member_plans_user on public.member_plans(user_id);

alter table public.member_plans enable row level security;

-- A member reads their own plans; owner/coach read all in the box.
drop policy if exists read_member_plans on public.member_plans;
create policy read_member_plans on public.member_plans
  for select using (
    user_id = (select auth.uid())
    or has_org_role(organization_id, array['owner', 'coach'])
  );

-- Owner/coach assign and manage member plans.
drop policy if exists write_member_plans on public.member_plans;
create policy write_member_plans on public.member_plans
  for all using (has_org_role(organization_id, array['owner', 'coach']))
          with check (has_org_role(organization_id, array['owner', 'coach']));

-- ===== 20260626160000_booking_plan_gate =====
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

