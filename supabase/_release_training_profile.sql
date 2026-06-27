-- ST-41: structured training profile for AI recommendations.
-- One flexible jsonb column so we can add fields without further migrations.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Planned shape (the UI will read/write these keys):
--   {
--     "injuries":        "texte libre (blessures / limitations)",
--     "available_days":  ["mon","tue","sat"],
--     "preferred_times": "matin | midi | soir",
--     "equipment":       ["barre","anneaux","rameur",...],
--     "goal_detail":     "objectif détaillé",
--     "experience":      { "snatch": "débutant", "muscle_up": "non acquis", ... }
--   }

alter table public.user_profile
  add column if not exists training_profile jsonb not null default '{}'::jsonb;
