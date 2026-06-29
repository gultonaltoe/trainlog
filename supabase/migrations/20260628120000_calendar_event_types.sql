-- ST-51: let the box put non-class events on the calendar (formations/BPJEPS,
-- cours ados/pré-ados, ménage…). Adds a kind + bookable flag to class_schedules.
-- bookable=false → shows on planning/agenda but NOT in member booking, no Réserver.
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.class_schedules add column if not exists kind     text    not null default 'class';
alter table public.class_schedules add column if not exists bookable boolean not null default true;
-- kind examples: 'class' (WOD réservable), 'event' (générique), 'course' (formation/théorie),
-- 'kids' (ados/pré-ados), 'cleaning' (ménage). Free to extend.
