-- ST-103 (CA-02) Community v1 — fist-bumps (kudos) + comments on WOD scores.
-- Attaches to a wod_scores row. organization_id is denormalized so RLS can gate
-- on has_org_role directly. Run in the Supabase SQL editor. Safe to re-run.

-- 1) Kudos (one per member per score).
create table if not exists public.score_kudos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  score_id        uuid not null references public.wod_scores(id) on delete cascade,
  user_id         uuid not null,
  created_at      timestamptz default now(),
  unique (score_id, user_id)
);
alter table public.score_kudos enable row level security;
drop policy if exists "kudos_read"   on public.score_kudos;
drop policy if exists "kudos_insert" on public.score_kudos;
drop policy if exists "kudos_delete" on public.score_kudos;
create policy "kudos_read" on public.score_kudos for select to authenticated
  using (public.has_org_role(organization_id, array['owner','coach','staff','member']));
create policy "kudos_insert" on public.score_kudos for insert to authenticated
  with check (user_id = auth.uid() and public.has_org_role(organization_id, array['owner','coach','staff','member']));
create policy "kudos_delete" on public.score_kudos for delete to authenticated
  using (user_id = auth.uid());
grant all on public.score_kudos to authenticated;

-- 2) Comments.
create table if not exists public.score_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  score_id        uuid not null references public.wod_scores(id) on delete cascade,
  user_id         uuid not null,
  body            text not null,
  created_at      timestamptz default now()
);
create index if not exists score_comments_score_idx on public.score_comments (score_id, created_at);
alter table public.score_comments enable row level security;
drop policy if exists "comments_read"   on public.score_comments;
drop policy if exists "comments_insert" on public.score_comments;
drop policy if exists "comments_delete" on public.score_comments;
create policy "comments_read" on public.score_comments for select to authenticated
  using (public.has_org_role(organization_id, array['owner','coach','staff','member']));
create policy "comments_insert" on public.score_comments for insert to authenticated
  with check (user_id = auth.uid() and public.has_org_role(organization_id, array['owner','coach','staff','member']));
-- Delete: your own comment, or moderation by owner/coach.
create policy "comments_delete" on public.score_comments for delete to authenticated
  using (user_id = auth.uid() or public.has_org_role(organization_id, array['owner','coach']));
grant all on public.score_comments to authenticated;

-- 3) Leaderboard RPCs now also return score_id + social counts (kudos, whether
--    I kudoed, comment count). Drop+recreate (return signature changes).
drop function if exists public.get_wod_leaderboard(uuid, date);
create function public.get_wod_leaderboard(p_org_id uuid, p_date date)
returns table (score_id uuid, user_id uuid, first_name text, score_type text, score_value numeric,
               score_display text, rx boolean, note text, kudos integer, i_kudoed boolean, comments integer)
language sql security definer set search_path = public as $$
  select s.id, s.user_id, coalesce(nullif(trim(p.first_name), ''), 'Athlète'),
         s.score_type, s.score_value, s.score_display, s.rx, s.note,
         (select count(*) from public.score_kudos k where k.score_id = s.id)::int,
         exists (select 1 from public.score_kudos k where k.score_id = s.id and k.user_id = auth.uid()),
         (select count(*) from public.score_comments c where c.score_id = s.id)::int
  from public.wod_scores s
  left join public.user_profile p on p.user_id = s.user_id
  where s.organization_id = p_org_id and s.wod_date = p_date
    and public.has_org_role(p_org_id, array['owner','coach','staff','member'])
  order by case when s.score_type = 'time' then s.score_value end asc nulls last,
           case when s.score_type <> 'time' then s.score_value end desc nulls last, s.created_at asc;
$$;

drop function if exists public.get_benchmark_leaderboard(uuid, uuid);
create function public.get_benchmark_leaderboard(p_org_id uuid, p_benchmark_id uuid)
returns table (score_id uuid, user_id uuid, first_name text, score_type text, score_value numeric,
               score_display text, rx boolean, note text, kudos integer, i_kudoed boolean, comments integer)
language sql security definer set search_path = public as $$
  select s.id, s.user_id, coalesce(nullif(trim(p.first_name), ''), 'Athlète'),
         s.score_type, s.score_value, s.score_display, s.rx, s.note,
         (select count(*) from public.score_kudos k where k.score_id = s.id)::int,
         exists (select 1 from public.score_kudos k where k.score_id = s.id and k.user_id = auth.uid()),
         (select count(*) from public.score_comments c where c.score_id = s.id)::int
  from public.wod_scores s
  left join public.user_profile p on p.user_id = s.user_id
  where s.organization_id = p_org_id and s.benchmark_id = p_benchmark_id
    and public.has_org_role(p_org_id, array['owner','coach','staff','member'])
  order by case when s.score_type = 'time' then s.score_value end asc nulls last,
           case when s.score_type <> 'time' then s.score_value end desc nulls last, s.created_at asc;
$$;

-- 4) Comment thread for a score (author names via SECURITY DEFINER).
create or replace function public.get_score_comments(p_score_id uuid)
returns table (id uuid, user_id uuid, first_name text, body text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.user_id, coalesce(nullif(trim(p.first_name), ''), 'Athlète'), c.body, c.created_at
  from public.score_comments c
  join public.wod_scores s on s.id = c.score_id
  left join public.user_profile p on p.user_id = c.user_id
  where c.score_id = p_score_id
    and public.has_org_role(s.organization_id, array['owner','coach','staff','member'])
  order by c.created_at asc;
$$;

grant execute on function public.get_wod_leaderboard(uuid, date)       to authenticated;
grant execute on function public.get_benchmark_leaderboard(uuid, uuid) to authenticated;
grant execute on function public.get_score_comments(uuid)              to authenticated;
