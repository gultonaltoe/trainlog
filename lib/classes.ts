import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// `classes` lands in the generated Database types once the migration is applied
// and `supabase gen types` is re-run. Until then, use an untyped handle for this
// one table so the rest of the app stays strictly typed.
// TODO(after regen): drop `db` and use `supabase.from('classes')` directly.
const db = supabase as unknown as SupabaseClient

export type GymClass = {
  id: string
  title: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:MM
  durationMin: number
  capacity: number | null
  coachUserId: string | null
}

type ClassRow = {
  id: string; title: string; date: string; start_time: string
  duration_min: number; capacity: number | null; coach_user_id: string | null
}

function toClass(r: ClassRow): GymClass {
  return {
    id: r.id, title: r.title, date: r.date,
    startTime: (r.start_time ?? '').slice(0, 5),
    durationMin: r.duration_min, capacity: r.capacity, coachUserId: r.coach_user_id,
  }
}

/** Classes of a box between two dates (inclusive), ordered by day then time. */
export async function getClassesForWeek(orgId: string, fromISO: string, toISO: string): Promise<GymClass[]> {
  const { data, error } = await db.from('classes')
    .select('id, title, date, start_time, duration_min, capacity, coach_user_id')
    .eq('organization_id', orgId)
    .gte('date', fromISO).lte('date', toISO)
    .order('date', { ascending: true }).order('start_time', { ascending: true })
  if (error) throw new Error(`getClassesForWeek: ${error.message}`)
  return ((data ?? []) as ClassRow[]).map(toClass)
}

export type NewClass = {
  orgId: string
  title: string
  date: string        // first occurrence, YYYY-MM-DD
  startTime: string   // HH:MM
  durationMin: number
  capacity: number | null
  coachUserId: string | null
  repeatWeeks: number // 1 = just this date; N = this + (N-1) following weeks
}

/** Create a class, materializing weekly recurrence into one row per week. */
export async function createClasses(input: NewClass): Promise<number> {
  const base = new Date(input.date + 'T00:00:00')
  const weeks = Math.max(1, Math.min(52, input.repeatWeeks))
  const rows = Array.from({ length: weeks }, (_, w) => {
    const d = new Date(base); d.setDate(base.getDate() + w * 7)
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      organization_id: input.orgId,
      title: input.title.trim(),
      date: ds,
      start_time: input.startTime,
      duration_min: input.durationMin,
      capacity: input.capacity,
      coach_user_id: input.coachUserId,
    }
  })
  const { error } = await db.from('classes').insert(rows)
  if (error) throw new Error(`createClasses: ${error.message}`)
  return rows.length
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await db.from('classes').delete().eq('id', id)
  if (error) throw new Error(`deleteClass: ${error.message}`)
}
