-- ST-33 / ST-9: storage buckets for box logos + user avatars.
-- Run in the Supabase SQL editor (safe to re-run).
-- Public read (images are shown to members); writes are scoped:
--   box-assets/{orgId}/...  → only owners of that org
--   avatars/{userId}/...    → only that user (coach-uploading-for-member handled
--                              later via a dedicated RPC if needed)

insert into storage.buckets (id, name, public) values ('box-assets', 'box-assets', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

-- ── box-assets ──────────────────────────────────────────────
drop policy if exists "box_assets_read"   on storage.objects;
drop policy if exists "box_assets_write"  on storage.objects;
drop policy if exists "box_assets_update" on storage.objects;
drop policy if exists "box_assets_delete" on storage.objects;

create policy "box_assets_read" on storage.objects
  for select using (bucket_id = 'box-assets');
create policy "box_assets_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'box-assets' and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner']));
create policy "box_assets_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'box-assets' and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner']));
create policy "box_assets_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'box-assets' and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner']));

-- ── avatars ─────────────────────────────────────────────────
drop policy if exists "avatars_read"   on storage.objects;
drop policy if exists "avatars_write"  on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;

create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
