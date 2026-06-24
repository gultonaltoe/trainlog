import { supabase } from './supabase'

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

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Classes of a box between two dates (inclusive), ordered by day then time. */
export async function getClassesInRange(orgId: string, fromISO: string, toISO: string): Promise<GymClass[]> {
  const { data, error } = await supabase.from('classes')
    .select('id, title, date, start_time, duration_min, capacity, coach_user_id')
    .eq('organization_id', orgId)
    .gte('date', fromISO).lte('date', toISO)
    .order('date', { ascending: true }).order('start_time', { ascending: true })
  if (error) throw new Error(`getClassesInRange: ${error.message}`)
  return (data ?? []).map(toClass)
}

// 0 = Monday … 6 = Sunday
export type WeeklySlot = { weekday: number; time: string }

export type WeeklyClassInput = {
  orgId: string
  title: string
  coachUserId: string | null
  capacity: number
  durationMin: number
  startMondayISO: string  // Monday of the first week to generate
  weeks: number           // how many weeks to repeat the slots
  slots: WeeklySlot[]      // e.g. [{weekday:0,time:'12:00'}, {weekday:1,time:'15:00'}]
}

/**
 * Create classes from weekly slots, materialized into one row per occurrence.
 * Lets a box set "Monday 12:00, Tuesday 15:00 …" repeating for N weeks in one go.
 */
export async function createClassesFromSlots(input: WeeklyClassInput): Promise<number> {
  const start = new Date(input.startMondayISO + 'T00:00:00')
  const weeks = Math.max(1, Math.min(52, input.weeks))
  const rows: {
    organization_id: string; title: string; date: string; start_time: string
    duration_min: number; capacity: number; coach_user_id: string | null
  }[] = []
  for (let w = 0; w < weeks; w++) {
    for (const slot of input.slots) {
      const d = new Date(start)
      d.setDate(start.getDate() + w * 7 + slot.weekday)
      rows.push({
        organization_id: input.orgId,
        title: input.title.trim(),
        date: iso(d),
        start_time: slot.time,
        duration_min: input.durationMin,
        capacity: input.capacity,
        coach_user_id: input.coachUserId,
      })
    }
  }
  if (rows.length === 0) return 0
  const { error } = await supabase.from('classes').insert(rows)
  if (error) throw new Error(`createClassesFromSlots: ${error.message}`)
  return rows.length
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id)
  if (error) throw new Error(`deleteClass: ${error.message}`)
}
