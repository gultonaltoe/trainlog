-- ============================================================
-- _seed_nero_box.sql  (SEED DATA — not a migration)
-- Creates the "Nero CrossFit" box, makes the owner of "Test Julien Test" its
-- owner too (so you own 2 boxes and can test the switch), and clones that box's
-- members, coaches, planning and settings. Sets the brand accent to Nero red
-- (#ED1C24, eyeballed from the logo — swap for the exact hex later in
-- "Marque & politique"). Re-runnable. Run in the Supabase SQL editor.
-- NOTE: the box logo isn't set here (binary upload) — add it via Nero's
-- "Marque & politique" settings; until then the switcher shows the generic icon.
-- ============================================================

do $$
declare
  v_test  uuid;
  v_owner uuid;
  v_nero  uuid;
  r       record;
begin
  select id, owner_user_id into v_test, v_owner
    from public.organizations where name = 'Test Julien Test' order by created_at limit 1;
  if v_test is null then raise exception 'Source box « Test Julien Test » introuvable'; end if;
  if v_owner is null then
    select user_id into v_owner from public.memberships
      where organization_id = v_test and role = 'owner' and status = 'active' limit 1;
  end if;
  if v_owner is null then raise exception 'Owner de la box source introuvable'; end if;

  -- The BEFORE-INSERT trigger sets owner_user_id := auth.uid() (NOT NULL column),
  -- which is null in the SQL editor → insert fails. Make auth.uid() resolve to the
  -- owner for this transaction so the trigger sets it correctly.
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner::text)::text, true);

  -- Create Nero (idempotent by name). join_code is auto-set by the same trigger.
  select id into v_nero from public.organizations where name = 'Nero CrossFit' limit 1;
  if v_nero is null then
    v_nero := gen_random_uuid();
    insert into public.organizations (id, name, slug, settings)
    values (
      v_nero, 'Nero CrossFit', 'nero-crossfit',
      jsonb_set(
        coalesce((select settings from public.organizations where id = v_test), '{}'::jsonb),
        '{brand}', jsonb_build_object('logoUrl', '', 'brandColor', '#ED1C24'), true)
    );
  end if;
  update public.organizations
    set owner_user_id = v_owner,
        settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{brand,brandColor}', '"#ED1C24"'::jsonb, true)
    where id = v_nero;

  -- Owner membership (no auth.uid() in the editor → set explicitly).
  insert into public.memberships (organization_id, user_id, role, status)
    values (v_nero, v_owner, 'owner', 'active')
    on conflict (organization_id, user_id) do update set role = 'owner', status = 'active';

  -- Clone the other members + coaches from the test box.
  for r in
    select user_id, role, status from public.memberships
    where organization_id = v_test and user_id <> v_owner
  loop
    insert into public.memberships (organization_id, user_id, role, status)
      values (v_nero, r.user_id, r.role, r.status)
      on conflict (organization_id, user_id) do nothing;
  end loop;

  -- Clone the planning (recurring schedules). Clean re-run.
  delete from public.class_schedules where organization_id = v_nero;
  insert into public.class_schedules
    (organization_id, title, session_type, weekday, start_time, duration_min,
     capacity, coach_user_id, start_date, waitlist_capacity, kind, bookable, active)
  select v_nero, title, session_type, weekday, start_time, duration_min,
     capacity, coach_user_id, start_date, waitlist_capacity, kind, bookable, active
  from public.class_schedules where organization_id = v_test;

  raise notice 'Nero CrossFit prête : org %, owner %, % membres, planning cloné, brand #ED1C24',
    v_nero, v_owner, (select count(*) from public.memberships where organization_id = v_nero);
end $$;
