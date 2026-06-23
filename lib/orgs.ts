import { supabase } from './supabase'
import { requireUserId } from './auth'

// Organizations (boxes/gyms) + the current user's role in each.
// "Athlete" is not a role — every user owns their training data regardless.
// These functions only concern the org/role layer.

export type Role = 'owner' | 'coach' | 'staff' | 'member'
export type MembershipStatus = 'active' | 'invited' | 'inactive'

export type Membership = {
  id: string
  organizationId: string
  organizationName: string
  role: Role
  status: MembershipStatus
  dataSharing: boolean
}

/** All active memberships for the current user (their boxes + role in each). */
export async function getMyMemberships(): Promise<Membership[]> {
  const uid = await requireUserId()
  const { data, error } = await supabase
    .from('memberships')
    .select('id, organization_id, role, status, data_sharing, organizations(name)')
    .eq('user_id', uid)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`getMyMemberships: ${error.message}`)
  return (data ?? []).map(m => ({
    id:               m.id,
    organizationId:   m.organization_id,
    organizationName: m.organizations?.name ?? 'Box',
    role:             m.role as Role,
    status:           m.status as MembershipStatus,
    dataSharing:      m.data_sharing,
  }))
}

/** Create a box. A DB trigger makes the current user its owner. Returns the new org id. */
export async function createOrganization(name: string): Promise<string> {
  const uid = await requireUserId()
  const id = crypto.randomUUID()
  // No .select(): with a return representation, the DB re-checks the new row
  // against the SELECT (read_orgs) policy, which needs the owner-membership the
  // AFTER trigger hasn't created yet at that instant — that produced the RLS
  // error. We generate the id ourselves and insert with return=minimal.
  const { error } = await supabase
    .from('organizations')
    .insert({ id, name: name.trim(), owner_user_id: uid })
  if (error) throw new Error(`createOrganization: ${error.message}`)
  return id
}

export type OrgMember = {
  membershipId: string
  userId: string
  role: Role
  dataSharing: boolean
}

/** Active members of a box (owner/coach/staff can read this via RLS). */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, data_sharing')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`getOrgMembers: ${error.message}`)
  return (data ?? []).map(m => ({
    membershipId: m.id,
    userId:       m.user_id,
    role:         m.role as Role,
    dataSharing:  m.data_sharing,
  }))
}

/** Member toggles whether this box's coaches can see their training data. */
export async function setDataSharing(orgId: string, share: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_data_sharing', { org_id: orgId, share })
  if (error) throw new Error(`setDataSharing: ${error.message}`)
}
