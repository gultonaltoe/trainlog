-- ST-54: join a box by searching its name (+ owner approval), instead of a code.
-- Run in the Supabase SQL editor. Safe to re-run.

-- Search boxes by name (SECURITY DEFINER so non-members can discover; returns
-- only id+name, min 2 chars, capped). No contact details exposed.
create or replace function public.search_boxes(p_query text)
returns table (id uuid, name text)
language sql stable security definer set search_path = public
as $$
  select o.id, o.name
  from public.organizations o
  where length(btrim(p_query)) >= 2
    and o.name ilike '%' || btrim(p_query) || '%'
  order by o.name
  limit 10;
$$;
grant execute on function public.search_boxes(text) to authenticated;

-- Request to join a box by id → pending membership (owner approves, as today).
create or replace function public.request_to_join_box_by_id(p_org_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select name into v_name from public.organizations where id = p_org_id;
  if v_name is null then raise exception 'Box introuvable'; end if;
  insert into public.memberships (organization_id, user_id, role, status)
    values (p_org_id, uid, 'member', 'pending')
    on conflict (organization_id, user_id) do nothing;
  return v_name;
end;
$$;
grant execute on function public.request_to_join_box_by_id(uuid) to authenticated;
