-- ============================================================
-- 20260629140000_movement_lunges.sql
-- ST-70: add Lunges (+ variants) to the movements catalogue. The DB category
-- taxonomy is fixed (weightlifting/powerlifting/gymnastics/cardio/strongman/
-- accessory/skill), so "Lower Body" maps to category 'accessory' + subcategory
-- 'legs'. Idempotent — only inserts names not already present.
-- ============================================================

insert into public.movements (name, category, subcategory, equipment, muscle_groups, is_unilateral)
select v.name, v.category, v.subcategory, v.equipment, v.muscle_groups, v.is_unilateral
from (values
  ('Lunges',          'accessory', 'legs', array[]::text[],                  array['quadriceps','glutes','hamstrings'], true),
  ('Walking Lunges',  'accessory', 'legs', array[]::text[],                  array['quadriceps','glutes','hamstrings'], true),
  ('Reverse Lunges',  'accessory', 'legs', array[]::text[],                  array['quadriceps','glutes','hamstrings'], true),
  ('Weighted Lunges', 'accessory', 'legs', array['barbell','dumbbell']::text[], array['quadriceps','glutes','hamstrings'], true)
) as v(name, category, subcategory, equipment, muscle_groups, is_unilateral)
where not exists (select 1 from public.movements m where m.name = v.name);
