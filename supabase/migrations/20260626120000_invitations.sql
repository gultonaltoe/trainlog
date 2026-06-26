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
