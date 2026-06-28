import { supabase } from './supabase'

export type ClassSchedule = {
  id: string
  title: string
  sessionType: string | null
  weekday: number       // 0 = Monday
  startTime: string     // HH:MM
  durationMin: number
  capacity: number
  coachUserId: string | null
  startDate: string     // YYYY-MM-DD
  waitlistCapacity: number | null   // per-class override; null = use the box default
  kind: string          // 'class' (réservable) | 'event' | 'course' | 'kids' | 'cleaning' (ST-51)
  bookable: boolean     // false → calendar-only (no member booking)
}

// A concrete occurrence of a schedule on a given date (for display / future booking).
export type ClassOccurrence = ClassSchedule & { date: string }

// ST-51 — event kinds (label + emoji) for non-class calendar entries.
export const KIND_META: Record<string, { label: string; emoji: string }> = {
  class:    { label: 'Cours',           emoji: '🏋️' },
  event:    { label: 'Événement',       emoji: '📌' },
  course:   { label: 'Formation',       emoji: '🎓' },
  kids:     { label: 'Ados / pré-ados', emoji: '🧒' },
  cleaning: { label: 'Ménage',          emoji: '🧹' },
}
// Selectable kinds for a non-bookable event.
export const EVENT_KINDS = ['event', 'course', 'kids', 'cleaning'] as const

type SchedRow = {
  id: string; title: string; session_type: string | null; weekday: number; start_time: string
  duration_min: number; capacity: number; coach_user_id: string | null; start_date: string
  waitlist_capacity: number | null; kind: string; bookable: boolean
}

function toSchedule(r: SchedRow): ClassSchedule {
  return {
    id: r.id, title: r.title, sessionType: r.session_type, weekday: r.weekday,
    startTime: (r.start_time ?? '').slice(0, 5), durationMin: r.duration_min,
    capacity: r.capacity, coachUserId: r.coach_user_id, startDate: r.start_date,
    waitlistCapacity: r.waitlist_capacity, kind: r.kind ?? 'class', bookable: r.bookable ?? true,
  }
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** End time "HH:MM" given a start "HH:MM" + duration in minutes. */
export function endTime(start: string, durationMin: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = (h * 60 + m + durationMin) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Active recurring schedules of a box. */
export async function getSchedules(orgId: string): Promise<ClassSchedule[]> {
  const { data, error } = await supabase.from('class_schedules')
    .select('id, title, session_type, weekday, start_time, duration_min, capacity, coach_user_id, start_date, waitlist_capacity, kind, bookable')
    .eq('organization_id', orgId).eq('active', true)
  if (error) throw new Error(`getSchedules: ${error.message}`)
  return ((data ?? []) as SchedRow[]).map(toSchedule)
}

/** Expand schedules into concrete occurrences within [fromISO, toISO], sorted. */
export function occurrencesInRange(schedules: ClassSchedule[], fromISO: string, toISO: string): ClassOccurrence[] {
  const from = new Date(fromISO + 'T00:00:00')
  const to = new Date(toISO + 'T00:00:00')
  const out: ClassOccurrence[] = []
  for (const s of schedules) {
    const startD = new Date(s.startDate + 'T00:00:00')
    const begin = startD > from ? startD : from
    const beginWeekday = (begin.getDay() + 6) % 7          // 0 = Monday
    const d = new Date(begin)
    d.setDate(d.getDate() + ((s.weekday - beginWeekday + 7) % 7))
    while (d <= to) {
      out.push({ ...s, date: iso(d) })
      d.setDate(d.getDate() + 7)
    }
  }
  return out.sort((a, b) => a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))
}

export type WeeklySlot = { weekday: number; time: string }

export type NewSchedule = {
  orgId: string
  title: string
  sessionType: string | null
  coachUserId: string | null
  capacity: number
  durationMin: number
  waitlistCapacity: number | null   // per-class override; null = use the box default
  slots: WeeklySlot[]      // each slot becomes its own recurring schedule
  startDateISO: string     // recurs weekly from here, forever
  kind?: string            // default 'class'
  bookable?: boolean       // default true; false → calendar-only event
}

/** Create one recurring schedule per slot (recurs weekly until removed). */
export async function createSchedules(input: NewSchedule): Promise<number> {
  const rows = input.slots.map(s => ({
    organization_id: input.orgId,
    title: input.title.trim(),
    session_type: input.sessionType,
    weekday: s.weekday,
    start_time: s.time,
    duration_min: input.durationMin,
    capacity: input.capacity,
    coach_user_id: input.coachUserId,
    start_date: input.startDateISO,
    waitlist_capacity: input.waitlistCapacity,
    kind: input.kind ?? 'class',
    bookable: input.bookable ?? true,
  }))
  if (rows.length === 0) return 0
  const { error } = await supabase.from('class_schedules').insert(rows)
  if (error) throw new Error(`createSchedules: ${error.message}`)
  return rows.length
}

/** Remove a recurring schedule (stops all future occurrences). */
export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('class_schedules').delete().eq('id', id)
  if (error) throw new Error(`deleteSchedule: ${error.message}`)
}
