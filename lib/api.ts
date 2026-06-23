import { supabase } from './supabase'
import { requireUserId, NotAuthenticatedError } from './auth'
import type { Json } from './database.types'

const getUid = requireUserId

export type SessionType   = { id: string; name: string; color: string; emoji: string; category: string }
export type Movement      = { id: string; name: string; category: string; subcategory?: string; equipment?: string[] }
export type SetInput      = { reps?: number; weight_kg?: number; tempo?: string; pct_rm?: number; execution?: string; is_pr?: boolean }
export type BlockInput    = {
  movement_id?: string; movement_label: string
  block_type?: 'strength' | 'skill' | 'technique' | 'accessory' | 'warmup' | 'cooldown'
  is_complex?: boolean; complex_label?: string
  sets: SetInput[]
}
export type WodInput = {
  format_label:   string
  time_cap?:      number    // ← ajouter
  description?:   string
  result_detail?: string
  is_rx:          boolean
}
export type PainEntry     = { label: string; severity: 1 | 2 | 3 }
export type SessionInput  = {
  date: string; session_type_id: string; duration_min?: number
  sleep_hours?: number; energy_level?: number
  rpe?: number; feeling_post?: number; notes?: string
  blocks?: BlockInput[]; wod?: WodInput; pain_entries?: PainEntry[]
  meta?: Record<string, unknown>   // run data, future extensions
}
export type SessionSummary = {
  id: string; date: string; duration_min: number | null
  session_type: string; type_color: string; type_emoji: string
  rpe: number | null; feeling_post: number | null
  sleep_hours: number | null; energy_level: number | null
  blocks_count: number; wods_count: number; pain_alerts_count: number
  is_competition: boolean; notes: string | null; is_demo: boolean
}

export async function getSessionTypes(): Promise<SessionType[]> {
  const { data, error } = await supabase.from('session_types')
    .select('id, name, color, emoji, category').eq('is_active', true).order('name')
  if (error) throw new Error(`getSessionTypes: ${error.message}`)
  return (data ?? []).map(t => ({
    id: t.id, name: t.name,
    color:    t.color    ?? '#F97316',
    emoji:    t.emoji    ?? '🏋️',
    category: t.category ?? '',
  }))
}

export async function searchMovements(query: string, category?: string): Promise<Movement[]> {
  if (query.trim().length < 2) return []
  let q = supabase.from('movements').select('id, name, category, subcategory, equipment')
    .ilike('name', `%${query}%`).order('name').limit(12)
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) throw new Error(`searchMovements: ${error.message}`)
  return (data ?? []).map(toMovement)
}

function toMovement(m: { id: string; name: string; category: string | null; subcategory: string | null; equipment: string[] | null }): Movement {
  return {
    id: m.id, name: m.name,
    category:    m.category    ?? '',
    subcategory: m.subcategory ?? undefined,
    equipment:   m.equipment   ?? undefined,
  }
}

export async function getMovementsByCategory(category: string): Promise<Movement[]> {
  const { data, error } = await supabase.from('movements')
    .select('id, name, category, subcategory, equipment').eq('category', category).order('name').limit(30)
  if (error) throw new Error(`getMovementsByCategory: ${error.message}`)
  return (data ?? []).map(toMovement)
}

export async function saveSession(input: SessionInput): Promise<string> {
  const uid = await getUid()
  const { data: session, error: sessionError } = await supabase.from('sessions')
    .insert({
      date: input.date, session_type_id: input.session_type_id,
      duration_min:  input.duration_min  ?? null,
      sleep_hours:   input.sleep_hours   ?? null,
      energy_level:  input.energy_level  ?? null,
      rpe:           input.rpe           ?? null,
      feeling_post:  input.feeling_post  ?? null,
      notes:         input.notes         ?? null,
      meta:          (input.meta ?? {}) as Json,
      user_id:       uid,
    }).select('id').single()
  if (sessionError) throw new Error(`saveSession: ${sessionError.message}`)
  const sessionId = session.id

  for (let i = 0; i < (input.blocks ?? []).length; i++) {
    const block = input.blocks![i]
    if (!block.movement_id && !block.is_complex) continue
    const { data: blockRow, error: blockError } = await supabase.from('session_blocks')
      .insert({
        session_id: sessionId, block_order: i + 1, title: block.movement_label,
        block_type: block.block_type ?? 'strength',
        is_complex: block.is_complex ?? false,
        complex_label: block.complex_label ?? null,
      })
      .select('id').single()
    if (blockError) throw new Error(`saveBlock[${i}]: ${blockError.message}`)
    const sets = block.sets.filter(s => s.reps || s.weight_kg).map((s, si) => ({
      block_id: blockRow.id, movement_id: block.movement_id ?? null,
      movement_label: block.movement_label, set_number: si + 1,
      reps: s.reps ?? null, weight_kg: s.weight_kg ?? null, is_pr: s.is_pr ?? false,
      tempo: s.tempo ?? null, pct_rm: s.pct_rm ?? null, execution: s.execution ?? null,
    }))
    if (sets.length > 0) {
      const { error } = await supabase.from('block_sets').insert(sets)
      if (error) throw new Error(`saveSets[${i}]: ${error.message}`)
    }
  }

  if (input.wod?.format_label) {
    const { data: fmt } = await supabase.from('wod_formats').select('id')
      .eq('name', input.wod.format_label).maybeSingle()
    const { error } = await supabase.from('wods').insert({
      session_id: sessionId, format_id: fmt?.id ?? null,
      format_label: input.wod.format_label,
      description: input.wod.description ?? null, result_detail: input.wod.result_detail ?? null,
is_rx: input.wod.is_rx, time_cap_min: input.wod.time_cap ?? null,
    })
    if (error) throw new Error(`saveWod: ${error.message}`)
  }

  if ((input.pain_entries ?? []).length > 0) {
    const { error } = await supabase.from('session_pain_alerts').insert(
      input.pain_entries!.map(e => ({ session_id: sessionId, body_part_label: e.label, severity: e.severity }))
    )
    if (error) throw new Error(`savePain: ${error.message}`)
  }

  return sessionId
}

export async function getRecentSessions(limit = 30): Promise<SessionSummary[]> {
  try {
    const uid = await getUid()
    type Row = { id: string; date: string; duration_min: number | null; rpe: number | null; feeling_post: number | null; sleep_hours: number | null; energy_level: number | null; notes: string | null; is_demo: boolean; session_types: { name: string; color: string; emoji: string } }
    const toSummary = (rows: Row[]): SessionSummary[] => rows.map(s => ({
      id:                s.id,
      date:              s.date,
      duration_min:      s.duration_min,
      rpe:               s.rpe,
      feeling_post:      s.feeling_post,
      sleep_hours:       s.sleep_hours,
      energy_level:      s.energy_level,
      notes:             s.notes,
      is_demo:           s.is_demo ?? false,
      session_type:      s.session_types?.name  ?? '',
      type_color:        s.session_types?.color ?? '#F97316',
      type_emoji:        s.session_types?.emoji ?? '🏋️',
      blocks_count:      0,
      wods_count:        0,
      pain_alerts_count: 0,
      is_competition:    false,
    }))
    const SEL = 'id, date, duration_min, rpe, feeling_post, sleep_hours, energy_level, notes, is_demo, session_types!inner(name, color, emoji)'
    const { data, error } = await supabase.from('sessions')
      .select(SEL).eq('user_id', uid).is('deleted_at', null)
      .order('date', { ascending: false }).limit(limit)
    if (error) throw new Error(error.message)
    return toSummary((data ?? []) as unknown as Row[])
  } catch (e) {
    if (e instanceof NotAuthenticatedError) return []  // logged out — expected
    throw e  // real failure — don't hide it
  }
}

export async function getWeeklyVolume(weeks = 12) {
  const since = new Date(); since.setDate(since.getDate() - weeks * 7)
  const { data, error } = await supabase.from('v_weekly_volume')
    .select('week, sessions_count, avg_rpe, avg_sleep, avg_energy, total_minutes')
    .gte('week', since.toISOString().split('T')[0]).order('week', { ascending: true })
  if (error) throw new Error(`getWeeklyVolume: ${error.message}`)
  return data ?? []
}
// ── Ajouter ces fonctions à la fin de lib/api.ts ──────────

export type UserProfile = {
  id?: string
  first_name?: string
  birth_date?: string
  weight_kg?: number
  height_cm?: number
  level?: string
  goal?: string
  weekly_target?: number
  box_name?: string
  sports?: string[]
  notes?: string
  theme_color?: string
}

export async function getProfile(): Promise<UserProfile | null> {
  try {
    const uid = await getUid()
    const { data, error } = await supabase.from('user_profile').select('*').eq('user_id', uid).limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    return data as UserProfile | null
  } catch (e) {
    if (e instanceof NotAuthenticatedError) return null  // logged out — expected
    throw e  // real failure — don't hide it
  }
}

export async function deleteDemoData(): Promise<void> {
  const uid = await getUid()
  await supabase.from('personal_records').delete().eq('user_id', uid).eq('is_demo', true)
  await supabase.from('sessions').delete().eq('user_id', uid).eq('is_demo', true)
}

export async function upsertProfile(profile: UserProfile, id?: string): Promise<void> {
  const uid = await getUid()
  if (id) {
    await supabase.from('user_profile').update({ ...profile, updated_at: new Date().toISOString() }).eq('id', id)
  } else {
    await supabase.from('user_profile').insert({ ...profile, user_id: uid })
  }
}
// ── Ajouter à la fin de lib/api.ts ────────────────────────

export type NewPR = { movementName: string; weight: number; unit: string }

export async function detectAndSavePRs(
  sessionId: string,
  blocks: BlockInput[]
): Promise<NewPR[]> {
  const uid     = await getUid()
  const today   = new Date().toISOString().split('T')[0]
  const newPRs: NewPR[] = []
  if (!blocks?.length) return newPRs

  for (const block of blocks) {
    if (!block.movement_id || !block.sets?.length) continue

    const weights = block.sets.map(s => s.weight_kg ?? 0).filter(w => w > 0)
    if (!weights.length) continue
    const maxWeight = Math.max(...weights)

    const { data: currentPR } = await supabase
      .from('personal_records')
      .select('value')
      .eq('movement_id', block.movement_id)
      .eq('user_id', uid)
      .order('value', { ascending: false })
      .limit(1)
      .maybeSingle()

    const isNew = !currentPR || maxWeight > currentPR.value
    await supabase.from('personal_records').insert({
      movement_id: block.movement_id, movement_name: block.movement_label,
      value: maxWeight, unit: 'kg', date: today,
      session_id: sessionId, user_id: uid,
    })
    if (isNew) newPRs.push({ movementName: block.movement_label, weight: maxWeight, unit: 'kg' })
  }
  return newPRs
}
