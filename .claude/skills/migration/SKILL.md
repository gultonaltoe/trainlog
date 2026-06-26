---
name: migration
description: Author and verify a Supabase database migration for Trainlog. Use whenever creating or changing a SQL migration in supabase/migrations, adding/altering tables, RLS policies, or RPC functions. Enforces running the SQL against local Postgres before handoff so syntax/logic errors are caught locally, then regenerates types and typechecks.
---

# Migration workflow (Trainlog)

Goal: never hand over SQL that hasn't actually executed. Past bugs (`position`
reserved word, drop-before-recreate) would all have been caught by running the
migration locally. Follow these steps in order.

## 1. Write the migration
- File: `supabase/migrations/<UTC-timestamp>_<slug>.sql` (e.g. `20260626120000_add_x.sql`).
- Make it **idempotent / re-runnable**: `create table if not exists`, `drop policy if exists` before `create policy`, `create or replace function`.
- Match existing conventions: `security definer set search_path = public` on RPCs; RLS via `has_org_role(org_id, array[...])`; French user-facing `raise exception` messages.
- Avoid reserved words as output column names (`position`, `order`, `user`, etc.) — alias them (`wl_position`).

## 2. Run it against LOCAL Postgres (the gate)
Requires Docker running.
```
supabase start            # first time / if not running — boots local Postgres + applies all migrations
supabase db reset         # re-apply ALL migrations from scratch (catches ordering + syntax errors)
```
- If `db reset` errors, fix the SQL and re-run until it applies cleanly.
- To test an RPC quickly: `supabase db reset` then psql via `supabase` or the local Studio (URL printed by `supabase start`).

## 3. Regenerate types
```
supabase gen types typescript --local > lib/database.types.ts
```
(Use `--local` against the running stack. The remote variant is
`--project-id hhcqomkcdjgttgwfcymu`.)

## 4. Typecheck
```
npx tsc --noEmit
```
Must be clean. The Stop hook also enforces this.

## 5. Hand off
- Tell Julien exactly which file to apply and that it ran clean locally.
- If schema changed, remind him the remote still needs the migration applied
  (SQL Editor) + remote type regen, unless we've wired `supabase db push`.

## Notes
- Never use the service_role key anywhere client-side (see security memory).
- Members must not get direct write RLS on booking tables — mutations go through
  SECURITY DEFINER RPCs.
