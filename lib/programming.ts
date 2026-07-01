import { supabase } from './supabase'
import { requireUserId } from './auth'
import type { ScoreType } from './leaderboard'

// ST-34 — box daily programming (the "WOD du jour").
export type Programming = {
  id?: string
  date: string            // YYYY-MM-DD
  title: string
  warmup: string
  strength: string
  wodFormat: string
  wodDescription: string
  timeCapMin: number | null
  notes: string
  scoreType: ScoreType | null   // ST-102: drives leaderboard ranking (null = not ranked)
}

export const emptyProgramming = (date: string): Programming => ({
  date, title: '', warmup: '', strength: '', wodFormat: '', wodDescription: '', timeCapMin: null, notes: '', scoreType: null,
})

export function hasContent(p: Programming | null): boolean {
  return !!p && !!(p.title || p.warmup || p.strength || p.wodDescription || p.notes)
}

export async function getProgramming(orgId: string, date: string): Promise<Programming | null> {
  const { data, error } = await supabase.from('box_programming')
    .select('id, date, title, warmup, strength, wod_format, wod_description, time_cap_min, notes, score_type')
    .eq('organization_id', orgId).eq('date', date).maybeSingle()
  if (error) throw new Error(`getProgramming: ${error.message}`)
  if (!data) return null
  const d = data as typeof data & { score_type: ScoreType | null }
  return {
    id: d.id, date: d.date, title: d.title ?? '', warmup: d.warmup ?? '', strength: d.strength ?? '',
    wodFormat: d.wod_format ?? '', wodDescription: d.wod_description ?? '', timeCapMin: d.time_cap_min, notes: d.notes ?? '',
    scoreType: d.score_type ?? null,
  }
}

export async function upsertProgramming(orgId: string, p: Programming): Promise<void> {
  const uid = await requireUserId()
  const row = {
    organization_id: orgId, date: p.date,
    title: p.title.trim() || null, warmup: p.warmup.trim() || null, strength: p.strength.trim() || null,
    wod_format: p.wodFormat.trim() || null, wod_description: p.wodDescription.trim() || null,
    time_cap_min: p.timeCapMin, notes: p.notes.trim() || null, score_type: p.scoreType,
    created_by: uid, updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('box_programming').upsert(row, { onConflict: 'organization_id,date' })
  if (error) throw new Error(`upsertProgramming: ${error.message}`)
}
