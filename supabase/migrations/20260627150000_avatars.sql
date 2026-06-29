-- ST-9: member/coach profile photos.
-- Adds user_profile.avatar_url and surfaces it in the member directory so the
-- roster / coach lists / member detail can show avatars. Run in the SQL editor
-- (after _release_storage_images.sql which creates the 'avatars' bucket). Safe to re-run.

alter table public.user_profile add column if not exists avatar_url text;

-- Recreate the directory RPC with avatar_url (return type changes → drop first).
drop function if exists public.get_org_member_directory(uuid);
create function public.get_org_member_directory(p_org_id uuid)
returns table (
  membership_id     uuid,
  user_id           uuid,
  first_name        text,
  role              text,
  status            text,
  data_sharing      boolean,
  employment_status text,
  leave_start       date,
  leave_end         date,
  avatar_url        text
)
language sql stable security definer set search_path = public
as $$
  select
    m.id, m.user_id, p.first_name, m.role, m.status, m.data_sharing,
    m.employment_status, m.leave_start, m.leave_end, p.avatar_url
  from public.memberships m
  left join public.user_profile p on p.user_id = m.user_id
  where m.organization_id = p_org_id
    and m.status <> 'inactive'
    and public.has_org_role(p_org_id, array['owner','coach','staff'])
  order by m.created_at;
$$;

grant execute on function public.get_org_member_directory(uuid) to authenticated;
