-- ============================================================
-- 20260629200000_changelog_fr.sql
-- Translate the seeded "Welcome" changelog entry to French (the app is in
-- French). Idempotent — updates the English seed row if present; 0 rows once
-- already translated or absent.
-- ============================================================

update public.changelog_entries
  set title = 'Bienvenue dans la bêta Trainlift 👋',
      body  = 'Tu fais partie des premiers athlètes à tester l''app. Log tes séances, suis tes PR, et dis-nous ce que tu en penses.'
  where title = 'Welcome to Trainlift beta 👋';
