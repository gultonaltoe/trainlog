import { supabase } from './supabase'
import { requireUserId } from './auth'

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
}

export const emptyProgramming = (date: string): Programming => ({
  date, title: '', warmup: '', strength: '', wodFormat: '', wodDescription: '', timeCapMin: null, notes: '',
})

export function hasContent(p: Programming | null): boolean {
  return !!p && !!(p.title || p.warmup || p.strength || p.wodDescription || p.notes)
}

export async function getProgramming(orgId: string, date: string): Promise<Programming | null> {
  const { data, error } = await supabase.from('box_programming')
    .select('id, date, title, warmup, strength, wod_format, wod_description, time_cap_min, notes')
    .eq('organization_id', orgId).eq('date', date).maybeSingle()
  if (error) throw new Error(`getProgramming: ${error.message}`)
  if (!data) return null
  return {
    id: data.id, date: data.date, title: data.title ?? '', warmup: data.warmup ?? '', strength: data.strength ?? '',
    wodFormat: data.wod_format ?? '', wodDescription: data.wod_description ?? '', timeCapMin: data.time_cap_min, notes: data.notes ?? '',
  }
}

export async function upsertProgramming(orgId: string, p: Programming): Promise<void> {
  const uid = await requireUserId()
  const row = {
    organization_id: orgId, date: p.date,
    title: p.title.trim() || null, warmup: p.warmup.trim() || null, strength: p.strength.trim() || null,
    wod_format: p.wodFormat.trim() || null, wod_description: p.wodDescription.trim() || null,
    time_cap_min: p.timeCapMin, notes: p.notes.trim() || null,
    created_by: uid, updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('box_programming').upsert(row, { onConflict: 'organization_id,date' })
  if (error) throw new Error(`upsertProgramming: ${error.message}`)
}
