-- Fix movement naming: "Press strict" → "Strict Press" (and a couple of common variants).
-- Run in the Supabase SQL editor. Safe to re-run.

update public.movements set name = 'Strict Press' where name ilike 'press strict';
update public.movements set name = 'Push Press'   where name ilike 'press push';

-- Keep already-saved PRs labelled consistently too.
update public.personal_records set movement_name = 'Strict Press' where movement_name ilike 'press strict';
update public.personal_records set movement_name = 'Push Press'   where movement_name ilike 'press push';
