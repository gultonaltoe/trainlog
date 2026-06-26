import { supabase } from './supabase'
import type { MembershipPlan, PlanKind } from './plans'

// A member's assigned plans (ST-10 stage 2). Joined with the plan catalogue
// for display. Assignment is owner/coach-only via RLS.

export type MemberPlanStatus = 'active' | 'expired' | 'cancelled'

export type MemberPlan = {
  id: string
  userId: string
  planId: string
  planName: string
  planKind: PlanKind
  status: MemberPlanStatus
  startsOn: string
  endsOn: string | null
  creditsRemaining: number | null
}

type Row = {
  id: string; user_id: string; plan_id: string; status: string
  starts_on: string; ends_on: string | null; credits_remaining: number | null
  membership_plans: { name: string; kind: string } | null
}

const toMemberPlan = (r: Row): MemberPlan => ({
  id: r.id, userId: r.user_id, planId: r.plan_id,
  planName: r.membership_plans?.name ?? 'Plan',
  planKind: (r.membership_plans?.kind ?? 'unlimited') as PlanKind,
  status: r.status as MemberPlanStatus,
  startsOn: r.starts_on, endsOn: r.ends_on, creditsRemaining: r.credits_remaining,
})

const SELECT = 'id, user_id, plan_id, status, starts_on, ends_on, credits_remaining, membership_plans(name, kind)'

/** A specific member's plans in a box (owner/coach), newest first. */
export async function getMemberPlans(orgId: string, userId: string): Promise<MemberPlan[]> {
  const { data, error } = await supabase.from('member_plans').select(SELECT)
    .eq('organization_id', orgId).eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`getMemberPlans: ${error.message}`)
  return ((data ?? []) as unknown as Row[]).map(toMemberPlan)
}

/** The current user's own plans in a box (for the booking screen). */
export async function getMyPlans(orgId: string): Promise<MemberPlan[]> {
  const { data, error } = await supabase.from('member_plans').select(SELECT)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`getMyPlans: ${error.message}`)
  return ((data ?? []) as unknown as Row[]).map(toMemberPlan)
}

/** Owner/coach assigns a plan to a member. Derives end date + credits from the plan. */
export async function assignPlan(orgId: string, userId: string, plan: MembershipPlan): Promise<void> {
  const startsOn = new Date()
  const endsOn = plan.durationDays
    ? new Date(startsOn.getTime() + plan.durationDays * 86400000).toISOString().slice(0, 10)
    : null
  const { error } = await supabase.from('member_plans').insert({
    organization_id: orgId,
    user_id: userId,
    plan_id: plan.id,
    status: 'active',
    starts_on: startsOn.toISOString().slice(0, 10),
    ends_on: endsOn,
    credits_remaining: plan.kind === 'pack' ? (plan.credits ?? null) : null,
  })
  if (error) throw new Error(`assignPlan: ${error.message}`)
}

/** Owner/coach cancels a member plan. */
export async function cancelMemberPlan(id: string): Promise<void> {
  const { error } = await supabase.from('member_plans').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw new Error(`cancelMemberPlan: ${error.message}`)
}

/** True if a member plan currently entitles booking (active, not expired, credits left if a pack). */
export function isUsable(mp: MemberPlan, todayISO: string): boolean {
  if (mp.status !== 'active') return false
  if (mp.endsOn && mp.endsOn < todayISO) return false
  if (mp.planKind === 'pack' && (mp.creditsRemaining ?? 0) <= 0) return false
  return true
}
