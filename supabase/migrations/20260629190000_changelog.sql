-- ============================================================
-- 20260629190000_changelog.sql
-- changelog_entries: global "What's New" content. Readable by any authenticated
-- user; no client writes (admin via Studio / service role only). No user_id.
-- Idempotent / safe to re-run.
-- ============================================================
create table if not exists public.changelog_entries (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  tag          text not null default 'new_feature' check (tag in ('new_feature','improvement','fix')),
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_changelog_published on public.changelog_entries (published_at desc);

alter table public.changelog_entries enable row level security;

drop policy if exists read_changelog on public.changelog_entries;
create policy read_changelog on public.changelog_entries
  for select using ((select auth.uid()) is not null);
-- No INSERT/UPDATE/DELETE policy → no client can write (admin-only).

-- Seed one entry so the panel isn't empty on first load (idempotent on title).
insert into public.changelog_entries (title, body, tag, published_at)
select 'Welcome to Trainlift beta 👋',
       'You''re among the first athletes to try the app. Log your sessions, track your PRs, and let us know what you think.',
       'new_feature', now()
where not exists (select 1 from public.changelog_entries where title = 'Welcome to Trainlift beta 👋');
