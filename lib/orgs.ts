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
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name: name.trim(), owner_user_id: uid })
    .select('id')
    .single()
  if (error) throw new Error(`createOrganization: ${error.message}`)
  return data.id
}

/** Member toggles whether this box's coaches can see their training data. */
export async function setDataSharing(orgId: string, share: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_data_sharing', { org_id: orgId, share })
  if (error) throw new Error(`setDataSharing: ${error.message}`)
}
