-- ============================================================
-- _seed_nero_test_data.sql  (SEED DATA — not a migration)
-- Populates Nero CrossFit with test data:
--   1) Pending staff invitations (Jo, Anne-Claire, Manu, Nathan, Warren,
--      Romain, Ève) with placeholder emails — change them later.
--   2) A ranked WOD du jour (score_type = time) so ST-102 is testable.
--   3) A populated leaderboard (demo athlete profiles + scores).
-- Requires Nero to exist (run _seed_nero_box.sql first) AND the leaderboard
-- migration (20260701120000_leaderboards.sql). Re-runnable. Run in SQL editor.
--
-- CONSTRAINTS (why it's shaped this way):
--   • memberships.user_id → auth.users : can't fabricate ACTIVE members without
--     real accounts (and the app never uses the service role), so staff are added
--     as PENDING invitations. They become active when they sign up + claim.
--   • invitations.role ∈ (coach, member) : owners aren't invitable → Jo &
--     Anne-Claire go in as 'coach'; promote them to owner after they sign up.
--   • 'stagiaire' isn't a valid employment_status yet (active/on_leave/sick/
--     inactive) — applies to Romain/Ève once active; needs a check widening.
--   • Leaderboard demo athletes are user_profile + wod_scores rows only (no
--     auth), so the board isn't empty. Clearly test data — cleanup at bottom.
-- ============================================================

do $$
declare
  v_nero  uuid;
  v_owner uuid;
  v_today date := current_date;
  r       record;
begin
  select id, owner_user_id into v_nero, v_owner
    from public.organizations where name = 'Nero CrossFit' limit 1;
  if v_nero is null then raise exception 'Nero CrossFit introuvable — lance _seed_nero_box.sql d''abord'; end if;

  -- 1) Staff roster as pending invitations (placeholder emails).
  insert into public.invitations (organization_id, email, role, invited_by, status) values
    (v_nero, 'jo.demo@nero.test',         'coach', v_owner, 'pending'),
    (v_nero, 'anneclaire.demo@nero.test', 'coach', v_owner, 'pending'),
    (v_nero, 'manu.demo@nero.test',       'coach', v_owner, 'pending'),
    (v_nero, 'nathan.demo@nero.test',     'coach', v_owner, 'pending'),
    (v_nero, 'warren.demo@nero.test',     'coach', v_owner, 'pending'),
    (v_nero, 'romain.demo@nero.test',     'coach', v_owner, 'pending'),
    (v_nero, 'eve.demo@nero.test',        'coach', v_owner, 'pending')
  on conflict (organization_id, email) where status = 'pending' do nothing;

  -- 2) Today's ranked WOD (For Time → fastest wins).
  insert into public.box_programming
    (organization_id, date, title, warmup, strength, wod_format, wod_description, time_cap_min, notes, score_type, created_by)
  values
    (v_nero, v_today, 'Fran (démo)', E'2 tours:\n10 air squats\n10 pass-throughs',
     'Back Squat 5x3 @80%', 'For Time', E'21-15-9\nThrusters 43 kg\nPull-ups', 12, 'Démo classement', 'time', v_owner)
  on conflict (organization_id, date) do update
    set score_type = 'time', title = excluded.title, warmup = excluded.warmup, strength = excluded.strength,
        wod_format = excluded.wod_format, wod_description = excluded.wod_description, time_cap_min = excluded.time_cap_min;

  -- 3) Populated leaderboard: demo athlete profiles + scores (test data only).
  for r in select * from (values
    ('00000000-0000-4000-a000-000000000a01'::uuid, 'Manu',   168, true),   -- 2:48
    ('00000000-0000-4000-a000-000000000a02'::uuid, 'Nathan', 183, true),   -- 3:03
    ('00000000-0000-4000-a000-000000000a03'::uuid, 'Warren', 201, true),   -- 3:21
    ('00000000-0000-4000-a000-000000000a04'::uuid, 'Romain', 222, false),  -- 3:42 Scaled
    ('00000000-0000-4000-a000-000000000a05'::uuid, 'Ève',    240, true),   -- 4:00
    ('00000000-0000-4000-a000-000000000a06'::uuid, 'Léa',    258, false),  -- 4:18 Scaled
    ('00000000-0000-4000-a000-000000000a07'::uuid, 'Tom',    285, true)    -- 4:45
  ) as t(uid, nm, secs, rx)
  loop
    insert into public.user_profile (id, user_id, first_name, notes)
      values (r.uid, r.uid, r.nm, '__demo_nero')
      on conflict (id) do update set first_name = excluded.first_name;
    delete from public.wod_scores where organization_id = v_nero and wod_date = v_today and user_id = r.uid;
    insert into public.wod_scores (organization_id, user_id, score_type, score_value, score_display, rx, note, wod_date)
      values (v_nero, r.uid, 'time', r.secs,
              to_char(r.secs / 60, 'FM9') || ':' || to_char(r.secs % 60, 'FM00'), r.rx, 'démo', v_today);
  end loop;

  raise notice 'Nero test data OK : 7 invitations en attente, WOD du jour classé (time), 7 scores démo pour le %.', v_today;
end $$;

-- ── Nettoyage des données démo (à copier-coller si besoin) ────────────────────
-- delete from public.wod_scores  where note = 'démo';
-- delete from public.user_profile where notes = '__demo_nero';
-- delete from public.invitations  where email like '%@nero.test';
