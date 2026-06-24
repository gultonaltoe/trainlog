import { supabase } from './supabase'
import { requireUserId } from './auth'
import type { Json } from './database.types'

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

/** The current user's memberships (active + pending) — their boxes + role/status. */
export async function getMyMemberships(): Promise<Membership[]> {
  const uid = await requireUserId()
  const { data, error } = await supabase
    .from('memberships')
    .select('id, organization_id, role, status, data_sharing, organizations(name)')
    .eq('user_id', uid)
    .in('status', ['active', 'pending'])
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

export type EmploymentStatus = 'active' | 'on_leave' | 'inactive'

export type OrgMember = {
  membershipId: string
  userId: string
  firstName: string | null
  role: Role
  status: MembershipStatus
  dataSharing: boolean
  employmentStatus: EmploymentStatus | null
}

/**
 * Member directory of a box (names + role + status), for owner/coach/staff.
 * Uses a SECURITY DEFINER function that exposes only names, not full profiles.
 */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase.rpc('get_org_member_directory', { p_org_id: orgId })
  if (error) throw new Error(`getOrgMembers: ${error.message}`)
  return (data ?? []).map(m => ({
    membershipId:     m.membership_id,
    userId:           m.user_id,
    firstName:        m.first_name,
    role:             m.role as Role,
    status:           m.status as MembershipStatus,
    dataSharing:      m.data_sharing,
    employmentStatus: (m.employment_status as EmploymentStatus | null) ?? null,
  }))
}

// A box-defined class type with default duration/capacity (pre-fills the builder).
export type SessionType = { name: string; defaultDurationMin: number; defaultCapacity: number }

export type OrgProfile = {
  id: string
  name: string
  description: string
  address: string
  phone: string
  website: string
  joinCode: string | null
  sessionTypes: SessionType[]
}

export const DEFAULT_DURATION_MIN = 60
export const DEFAULT_CAPACITY = 12

// Sensible starting set, shown by default until the box customizes its types.
export const DEFAULT_SESSION_TYPES: SessionType[] = [
  { name: 'CrossFit',      defaultDurationMin: 60, defaultCapacity: 14 },
  { name: 'Endurance',     defaultDurationMin: 60, defaultCapacity: 12 },
  { name: 'HIIT',          defaultDurationMin: 45, defaultCapacity: 16 },
  { name: 'Hyrox',         defaultDurationMin: 60, defaultCapacity: 12 },
  { name: 'Haltérophilie', defaultDurationMin: 90, defaultCapacity: 8 },
  { name: 'Team WOD',      defaultDurationMin: 60, defaultCapacity: 20 },
]

/** Box info + settings — readable by any active member of the box (via read_orgs RLS). */
export async function getOrganization(orgId: string): Promise<OrgProfile> {
  const { data, error } = await supabase
    .from('organizations').select('id, name, settings, join_code').eq('id', orgId).single()
  if (error) throw new Error(`getOrganization: ${error.message}`)
  const s = (data.settings ?? {}) as Record<string, unknown>
  return {
    id:           data.id,
    name:         data.name,
    description:  (s.description as string) ?? '',
    address:      (s.address as string) ?? '',
    phone:        (s.phone as string) ?? '',
    website:      (s.website as string) ?? '',
    joinCode:     data.join_code,
    sessionTypes: Array.isArray(s.sessionTypes) ? (s.sessionTypes as SessionType[]) : [],
  }
}

// Read the raw settings object so updates can merge instead of clobbering.
async function readSettings(orgId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('organizations').select('settings').eq('id', orgId).single()
  if (error) throw new Error(`readSettings: ${error.message}`)
  return (data.settings ?? {}) as Record<string, unknown>
}

/** Owner edits the box info (name + contact fields). Merges into settings. */
export async function updateOrgInfo(
  orgId: string,
  info: { name: string; description: string; address: string; phone: string; website: string },
): Promise<void> {
  const s = await readSettings(orgId)
  const settings = { ...s, description: info.description, address: info.address, phone: info.phone, website: info.website } as unknown as Json
  const { error } = await supabase.from('organizations').update({ name: info.name.trim(), settings }).eq('id', orgId)
  if (error) throw new Error(`updateOrgInfo: ${error.message}`)
}

/** Owner manages the box's session types. Merges into settings. */
export async function updateOrgSessionTypes(orgId: string, sessionTypes: SessionType[]): Promise<void> {
  const s = await readSettings(orgId)
  const settings = { ...s, sessionTypes } as unknown as Json
  const { error } = await supabase.from('organizations').update({ settings }).eq('id', orgId)
  if (error) throw new Error(`updateOrgSessionTypes: ${error.message}`)
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

/** Change a member's role within the box (owner/coach/staff/member). */
export async function updateMembershipRole(membershipId: string, role: Role): Promise<void> {
  const { error } = await supabase.from('memberships').update({ role }).eq('id', membershipId)
  if (error) throw new Error(`updateMembershipRole: ${error.message}`)
}

/** Set a staff member's employment status (active / on leave / inactive). */
export async function setEmploymentStatus(membershipId: string, employment: EmploymentStatus): Promise<void> {
  const { error } = await supabase.from('memberships').update({ employment_status: employment }).eq('id', membershipId)
  if (error) throw new Error(`setEmploymentStatus: ${error.message}`)
}

/** Remove someone from the box (soft — sets membership inactive). */
export async function removeMembership(membershipId: string): Promise<void> {
  const { error } = await supabase.from('memberships').update({ status: 'inactive' }).eq('id', membershipId)
  if (error) throw new Error(`removeMembership: ${error.message}`)
}

/** Member toggles whether this box's coaches can see their training data. */
export async function setDataSharing(orgId: string, share: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_data_sharing', { org_id: orgId, share })
  if (error) throw new Error(`setDataSharing: ${error.message}`)
}
