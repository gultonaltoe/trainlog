import { supabase } from './supabase'
import { requireUserId } from './auth'
import type { Json } from './database.types'

// Organizations (boxes/gyms) + the current user's role in each.
// "Athlete" is not a role — every user owns their training data regardless.
// These functions only concern the org/role layer.

export type Role = 'owner' | 'coach' | 'member'
export type MembershipStatus = 'active' | 'invited' | 'pending' | 'inactive'

export type Membership = {
  id: string
  organizationId: string
  organizationName: string
  role: Role
  status: MembershipStatus
  dataSharing: boolean
  logoUrl: string | null
}

/** The current user's memberships (active + pending) — their boxes + role/status. */
export async function getMyMemberships(): Promise<Membership[]> {
  const uid = await requireUserId()
  const { data, error } = await supabase
    .from('memberships')
    .select('id, organization_id, role, status, data_sharing, organizations(name, settings)')
    .eq('user_id', uid)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: true })
  if (error) throw new Error(`getMyMemberships: ${error.message}`)
  return (data ?? []).map(m => {
    const s = (m.organizations?.settings ?? {}) as { brand?: { logoUrl?: string } }
    return {
      id:               m.id,
      organizationId:   m.organization_id,
      organizationName: m.organizations?.name ?? 'Box',
      role:             m.role as Role,
      status:           m.status as MembershipStatus,
      dataSharing:      m.data_sharing,
      logoUrl:          s.brand?.logoUrl?.trim() || null,
    }
  })
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

export type EmploymentStatus = 'active' | 'on_leave' | 'sick' | 'inactive'

export type OrgMember = {
  membershipId: string
  userId: string
  firstName: string | null
  role: Role
  status: MembershipStatus
  dataSharing: boolean
  employmentStatus: EmploymentStatus | null
  leaveStart: string | null     // YYYY-MM-DD when employmentStatus = on_leave
  leaveEnd: string | null
  avatarUrl: string | null
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
    leaveStart:       (m.leave_start as string | null) ?? null,
    leaveEnd:         (m.leave_end as string | null) ?? null,
    avatarUrl:        ((m as { avatar_url?: string | null }).avatar_url) ?? null,
  }))
}

// A box-defined class type with default duration/capacity (pre-fills the builder).
export type SessionType = { name: string; defaultDurationMin: number; defaultCapacity: number }

// Box-configurable reservation behaviour. Stored under settings.reservations.
export type WaitlistMode = 'auto_promote' | 'notify' | 'notify_all'
export type ReservationSettings = {
  waitlistEnabled: boolean
  waitlistMode: WaitlistMode    // auto-promote on a freed spot, or just notify
  waitlistCapacity: number      // default max waitlist size (per-class override on the schedule)
  cancelCutoffMin: number       // minutes before start within which booked spots can't be cancelled
  bookAheadDays: number         // how far ahead members can book (0 = no limit)
  bookCutoffMin: number         // minutes before start when booking closes (0 = until start)
  requirePlan: boolean          // members need a usable plan/credits to book (owner/coach exempt)
  maxActiveBookings: number     // max upcoming reservations per member (0 = unlimited)
}

export const DEFAULT_RESERVATION_SETTINGS: ReservationSettings = {
  waitlistEnabled: true,
  waitlistMode: 'auto_promote',
  waitlistCapacity: 5,
  cancelCutoffMin: 120,
  bookAheadDays: 0,
  bookCutoffMin: 0,
  requirePlan: false,
  maxActiveBookings: 0,
}

// Box branding shown to members in box context.
export type OrgBrand = { logoUrl: string; brandColor: string }
export const DEFAULT_BRAND: OrgBrand = { logoUrl: '', brandColor: '' }

export type OrgProfile = {
  id: string
  name: string
  description: string
  address: string
  phone: string
  website: string
  joinCode: string | null
  sessionTypes: SessionType[]
  reservations: ReservationSettings
  brand: OrgBrand
  cancellationPolicy: string    // no-show / late-cancel policy text shown on booking
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
  const r = (s.reservations ?? {}) as Partial<ReservationSettings>
  const b = (s.brand ?? {}) as Partial<OrgBrand>
  return {
    id:           data.id,
    name:         data.name,
    description:  (s.description as string) ?? '',
    address:      (s.address as string) ?? '',
    phone:        (s.phone as string) ?? '',
    website:      (s.website as string) ?? '',
    joinCode:     data.join_code,
    sessionTypes: Array.isArray(s.sessionTypes) ? (s.sessionTypes as SessionType[]) : [],
    reservations: { ...DEFAULT_RESERVATION_SETTINGS, ...r },
    brand:        { ...DEFAULT_BRAND, ...b },
    cancellationPolicy: (s.cancellationPolicy as string) ?? '',
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

/** Owner manages the box's reservation rules (waitlist + cancel cutoff). Merges into settings. */
export async function updateReservationSettings(orgId: string, reservations: ReservationSettings): Promise<void> {
  const s = await readSettings(orgId)
  const settings = { ...s, reservations } as unknown as Json
  const { error } = await supabase.from('organizations').update({ settings }).eq('id', orgId)
  if (error) throw new Error(`updateReservationSettings: ${error.message}`)
}

/** Owner manages box branding + cancellation policy. Merges into settings. */
export async function updateOrgBranding(orgId: string, brand: OrgBrand, cancellationPolicy: string): Promise<void> {
  const s = await readSettings(orgId)
  const settings = { ...s, brand, cancellationPolicy } as unknown as Json
  const { error } = await supabase.from('organizations').update({ settings }).eq('id', orgId)
  if (error) throw new Error(`updateOrgBranding: ${error.message}`)
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

/** Set a coach's employment status (+ leave window when 'on_leave'; cleared otherwise). */
export async function setEmploymentStatus(
  membershipId: string, employment: EmploymentStatus,
  leaveStart: string | null = null, leaveEnd: string | null = null,
): Promise<void> {
  const onLeave = employment === 'on_leave'
  const { error } = await supabase.from('memberships')
    .update({ employment_status: employment, leave_start: onLeave ? leaveStart : null, leave_end: onLeave ? leaveEnd : null })
    .eq('id', membershipId)
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
