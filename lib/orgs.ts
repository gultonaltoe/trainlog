import { supabase } from './supabase'
import { requireUserId } from './auth'

// Organizations (boxes/gyms) + the current user's role in each.
// "Athlete" is not a role — every user owns their training data regardless.
// These functions only concern the org/role layer.

export type Role = 'owner' | 'coach' | 'staff' | 'member'
export type MembershipStatus = 'active' | 'invited' | 'pending' | 'inactive'

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
  firstName: string | null
  role: Role
  status: MembershipStatus
  dataSharing: boolean
}

/**
 * Member directory of a box (names + role + status), for owner/coach/staff.
 * Uses a SECURITY DEFINER function that exposes only names, not full profiles.
 */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase.rpc('get_org_member_directory', { p_org_id: orgId })
  if (error) throw new Error(`getOrgMembers: ${error.message}`)
  return (data ?? []).map(m => ({
    membershipId: m.membership_id,
    userId:       m.user_id,
    firstName:    m.first_name,
    role:         m.role as Role,
    status:       m.status as MembershipStatus,
    dataSharing:  m.data_sharing,
  }))
}

/** The box's shareable join code (members enter it to request to join). */
export async function getBoxJoinCode(orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('organizations').select('join_code').eq('id', orgId).single()
  if (error) throw new Error(`getBoxJoinCode: ${error.message}`)
  return data.join_code
}

/** Athlete requests to join a box by its code. Returns the box name. */
export async function requestToJoinBox(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('request_to_join_box', { p_code: code.trim() })
  if (error) throw new Error(error.message)
  return data
}

/** Owner/coach/staff approve (active) or reject (inactive) a membership. */
export async function setMembershipStatus(membershipId: string, status: MembershipStatus): Promise<void> {
  const { error } = await supabase.from('memberships').update({ status }).eq('id', membershipId)
  if (error) throw new Error(`setMembershipStatus: ${error.message}`)
}

/** Member toggles whether this box's coaches can see their training data. */
export async function setDataSharing(orgId: string, share: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_data_sharing', { org_id: orgId, share })
  if (error) throw new Error(`setDataSharing: ${error.message}`)
}
