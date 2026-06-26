import { supabase } from './supabase'

// A box's membership plan catalogue (ST-10 stage 1). Payments come later;
// this is the definition + owner management only.

export type PlanKind = 'unlimited' | 'pack' | 'drop_in' | 'trial'

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  unlimited: 'Illimité',
  pack: 'Carnet (crédits)',
  drop_in: 'Séance à l’unité',
  trial: 'Essai',
}

export type MembershipPlan = {
  id: string
  name: string
  kind: PlanKind
  priceCents: number
  currency: string
  credits: number | null
  durationDays: number | null
  recurring: boolean
  active: boolean
  sortOrder: number
}

export type NewPlan = Omit<MembershipPlan, 'id'>

type Row = {
  id: string; name: string; kind: string; price_cents: number; currency: string
  credits: number | null; duration_days: number | null; recurring: boolean
  active: boolean; sort_order: number
}

const toPlan = (r: Row): MembershipPlan => ({
  id: r.id, name: r.name, kind: r.kind as PlanKind, priceCents: r.price_cents, currency: r.currency,
  credits: r.credits, durationDays: r.duration_days, recurring: r.recurring, active: r.active, sortOrder: r.sort_order,
})

const toRow = (p: NewPlan) => ({
  name: p.name.trim(), kind: p.kind, price_cents: Math.max(0, Math.round(p.priceCents)), currency: p.currency,
  credits: p.kind === 'pack' ? (p.credits ?? null) : null,
  duration_days: p.durationDays ?? null, recurring: p.recurring, active: p.active, sort_order: p.sortOrder,
})

/** All plans of a box (owner sees active + inactive), ordered. */
export async function getPlans(orgId: string): Promise<MembershipPlan[]> {
  const { data, error } = await supabase.from('membership_plans')
    .select('id, name, kind, price_cents, currency, credits, duration_days, recurring, active, sort_order')
    .eq('organization_id', orgId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) throw new Error(`getPlans: ${error.message}`)
  return ((data ?? []) as Row[]).map(toPlan)
}

export async function createPlan(orgId: string, plan: NewPlan): Promise<void> {
  const { error } = await supabase.from('membership_plans').insert({ organization_id: orgId, ...toRow(plan) })
  if (error) throw new Error(`createPlan: ${error.message}`)
}

export async function updatePlan(id: string, plan: NewPlan): Promise<void> {
  const { error } = await supabase.from('membership_plans').update(toRow(plan)).eq('id', id)
  if (error) throw new Error(`updatePlan: ${error.message}`)
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from('membership_plans').delete().eq('id', id)
  if (error) throw new Error(`deletePlan: ${error.message}`)
}

/** Format cents + currency for display, e.g. 4500 EUR -> "45 €". */
export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)
  } catch { return `${(cents / 100).toFixed(2)} ${currency}` }
}
