-- ============================================================
-- 20260629120000_membership_approved_notify.sql
-- ST-80: notify a member (in-app) when their box approves the join request.
-- Trigger on memberships: when status flips to 'active' (from a non-active
-- state) for a member, insert a 'membership_approved' notification. The member
-- dashboard surfaces it as a one-shot banner (cleared on read). Safe to re-run.
-- ============================================================

create or replace function public.tg_membership_approved()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_org text;
begin
  if tg_op = 'UPDATE'
     and new.status = 'active'
     and old.status is distinct from 'active'
     and new.role = 'member' then
    select name into v_org from public.organizations where id = new.organization_id;
    insert into public.notifications (user_id, organization_id, type, title, body, link)
      values (new.user_id, new.organization_id, 'membership_approved',
              'Demande acceptée 🎉',
              'Bienvenue chez ' || coalesce(v_org, 'ta box') || ' ! Ton accès est maintenant actif.',
              '/');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_membership_approved on public.memberships;
create trigger trg_membership_approved
  after update on public.memberships
  for each row execute function public.tg_membership_approved();
