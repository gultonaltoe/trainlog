import { supabase } from './supabase'

// Member reservations against class occurrences. All mutations go through
// SECURITY DEFINER RPCs (book_class / cancel_class) so capacity, the cancel
// cutoff and waitlist promotion are enforced server-side.

export type ReservationStatus = 'booked' | 'waitlisted'

// Booking state of a single occurrence, keyed by `${scheduleId}|${date}`.
export type OccBooking = {
  scheduleId: string
  date: string
  bookedCount: number
  waitlistCount: number
  myStatus: ReservationStatus | null
  myPosition: number | null      // 1-based rank within my status (waitlist position)
  myNotified: boolean            // a freed spot was offered to me (notify mode)
}

export type Attendee = {
  userId: string
  firstName: string | null
  status: ReservationStatus
  position: number
  notified: boolean
}

export const bookingKey = (scheduleId: string, date: string) => `${scheduleId}|${date}`

/** Book or waitlist the current user onto an occurrence. Returns the resulting status. */
export async function bookClass(scheduleId: string, date: string): Promise<ReservationStatus> {
  const { data, error } = await supabase.rpc('book_class', { p_schedule_id: scheduleId, p_date: date })
  if (error) throw new Error(error.message)
  return data as ReservationStatus
}

/** Cancel the current user's reservation for an occurrence. */
export async function cancelClass(scheduleId: string, date: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_class', { p_schedule_id: scheduleId, p_date: date })
  if (error) throw new Error(error.message)
}

/** Claim a freed spot offered to a waitlisted member (notify mode). Returns 'booked'. */
export async function claimWaitlistSpot(scheduleId: string, date: string): Promise<ReservationStatus> {
  const { data, error } = await supabase.rpc('claim_waitlist_spot', { p_schedule_id: scheduleId, p_date: date })
  if (error) throw new Error(error.message)
  return data as ReservationStatus
}

type RangeRow = {
  schedule_id: string; occurrence_date: string; booked_count: number; waitlist_count: number
  my_status: ReservationStatus | null; my_position: number | null; my_notified: boolean
}

/** Booking counts + the caller's own status for every occurrence in [fromISO, toISO]. */
export async function getBookingsInRange(orgId: string, fromISO: string, toISO: string): Promise<Map<string, OccBooking>> {
  const { data, error } = await supabase.rpc('get_bookings_in_range', { p_org_id: orgId, p_from: fromISO, p_to: toISO })
  if (error) throw new Error(`getBookingsInRange: ${error.message}`)
  const map = new Map<string, OccBooking>()
  for (const r of (data ?? []) as RangeRow[]) {
    map.set(bookingKey(r.schedule_id, r.occurrence_date), {
      scheduleId:    r.schedule_id,
      date:          r.occurrence_date,
      bookedCount:   r.booked_count,
      waitlistCount: r.waitlist_count,
      myStatus:      r.my_status,
      myPosition:    r.my_position,
      myNotified:    r.my_notified,
    })
  }
  return map
}

type AttendeeRow = { user_id: string; first_name: string | null; status: ReservationStatus; wl_position: number; notified: boolean }

/** Attendee list for one occurrence (staff only). */
export async function getOccurrenceAttendees(scheduleId: string, date: string): Promise<Attendee[]> {
  const { data, error } = await supabase.rpc('get_occurrence_attendees', { p_schedule_id: scheduleId, p_date: date })
  if (error) throw new Error(`getOccurrenceAttendees: ${error.message}`)
  return ((data ?? []) as AttendeeRow[]).map(r => ({
    userId: r.user_id, firstName: r.first_name, status: r.status, position: r.wl_position, notified: r.notified,
  }))
}
