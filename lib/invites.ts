import { supabase } from './supabase'
import type { Role } from './orgs'

// Box-initiated email invites. Owner invites a coach/member by email; the
// invitation is claimed automatically when that email next logs in (see
// acceptMyInvites, called on app load). Email delivery (a heads-up to the
// invitee) is deferred until a notification provider is wired.

export type InviteRole = Extract<Role, 'coach' | 'member'>

export type Invite = {
  id: string
  email: string
  role: InviteRole
  status: 'pending' | 'accepted' | 'revoked'
  createdAt: string
}

/** Owner invites someone by email (default role: coach). Returns the invite id. */
export async function createInvite(orgId: string, email: string, role: InviteRole = 'coach'): Promise<string> {
  const { data, error } = await supabase.rpc('create_invite', { p_org_id: orgId, p_email: email, p_role: role })
  if (error) throw new Error(error.message)
  return data as string
}

/** Pending invites for a box (owner/coach can read). */
export async function getOrgInvites(orgId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, status, created_at')
    .eq('organization_id', orgId).eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`getOrgInvites: ${error.message}`)
  return (data ?? []).map(r => ({
    id: r.id, email: r.email, role: r.role as InviteRole,
    status: r.status as Invite['status'], createdAt: r.created_at,
  }))
}

/** Owner revokes a pending invite. */
export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('invitations').delete().eq('id', inviteId)
  if (error) throw new Error(`revokeInvite: ${error.message}`)
}

/** Claim any pending invites matching the current user's email. Called on app load. */
export async function acceptMyInvites(): Promise<number> {
  const { data, error } = await supabase.rpc('accept_my_invites')
  if (error) return 0   // non-fatal: never block app load on this
  return (data as number) ?? 0
}
