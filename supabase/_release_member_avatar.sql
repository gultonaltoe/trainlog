-- ST-9 (coach-for-member): let a box owner/coach set a photo for one of their
-- members. Run in the SQL editor after _release_storage_images.sql + _release_avatars.sql.
-- Safe to re-run.

-- 1) Storage: allow writing avatars/{userId}/ for yourself OR for a member of a
--    box where you are owner/coach. (Replaces the self-only write/update policies.)
drop policy if exists "avatars_write"  on storage.objects;
drop policy if exists "avatars_update" on storage.objects;

create policy "avatars_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.memberships me
        join public.memberships them on them.organization_id = me.organization_id
        where me.user_id = auth.uid() and me.role in ('owner','coach')
          and them.user_id::text = (storage.foldername(name))[1]
      )
    )
  );

create policy "avatars_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.memberships me
        join public.memberships them on them.organization_id = me.organization_id
        where me.user_id = auth.uid() and me.role in ('owner','coach')
          and them.user_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- 2) Persist a member's avatar_url (a coach can't update another user's profile
--    directly under RLS, so go through a SECURITY DEFINER RPC with a role check).
create or replace function public.set_member_avatar(p_user_id uuid, p_url text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.memberships me
    join public.memberships them on them.organization_id = me.organization_id
    where me.user_id = auth.uid() and me.role in ('owner','coach')
      and them.user_id = p_user_id
  ) then
    raise exception 'Non autorisé';
  end if;
  update public.user_profile set avatar_url = p_url, updated_at = now() where user_id = p_user_id;
end;
$$;

grant execute on function public.set_member_avatar(uuid, text) to authenticated;
