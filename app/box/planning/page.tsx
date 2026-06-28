'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrgMembers, getOrganization, DEFAULT_SESSION_TYPES, DEFAULT_CAPACITY, DEFAULT_DURATION_MIN, type OrgMember, type Role, type SessionType } from '@/lib/orgs'
import { getSchedules, occurrencesInRange, createSchedules, deleteSchedule, endTime, type ClassSchedule, type ClassOccurrence, type WeeklySlot } from '@/lib/classes'
import { getBookingsInRange, getOccurrenceAttendees, bookingKey, type OccBooking, type Attendee } from '@/lib/reservations'
import { BackButton } from '@/components/ui'
import { toast } from '@/lib/toast'

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAY_ABBR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_WK = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const DAY_HDR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const STAFF_ROLES: Role[] = ['owner', 'coach']

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function mondayOfWeek(d: Date) { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); m.setHours(0, 0, 0, 0); return m }
function monthCells(y: number, m: number): (number | null)[] {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const n = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= n; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
}

export default function PlanningPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [coaches, setCoaches] = useState<OrgMember[]>([])
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayView, setDayView] = useState<'list' | 'timeline'>('list')
  const [bookings, setBookings] = useState<Map<string, OccBooking>>(new Map())
  const [attendeesFor, setAttendeesFor] = useState<ClassOccurrence | null>(null)

  const range = useMemo(() => {
    if (view === 'week') {
      const m = mondayOfWeek(anchor); const s = new Date(m); s.setDate(m.getDate() + 6)
      return { fromISO: iso(m), toISO: iso(s), monday: m }
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { fromISO: iso(first), toISO: iso(last), monday: mondayOfWeek(anchor) }
  }, [view, anchor])

  const occurrences = useMemo(() => occurrencesInRange(schedules, range.fromISO, range.toISO), [schedules, range])

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const [sch, mem, info] = await Promise.all([getSchedules(orgId), getOrgMembers(orgId), getOrganization(orgId)])
    setSchedules(sch)
    setCoaches(mem.filter(m => m.status === 'active' && STAFF_ROLES.includes(m.role)))
    setSessionTypes(info.sessionTypes.length > 0 ? info.sessionTypes : DEFAULT_SESSION_TYPES)
    setLoading(false)
  }, [orgId])

  useEffect(() => { void load() }, [load])

  // Booking counts depend on the visible range, so reload them on navigation.
  useEffect(() => {
    if (!orgId) return
    let alive = true
    getBookingsInRange(orgId, range.fromISO, range.toISO)
      .then(m => { if (alive) setBookings(m) })
      .catch(() => { if (alive) setBookings(new Map()) })
    return () => { alive = false }
  }, [orgId, range.fromISO, range.toISO])

  const coachName = (id: string | null) => id ? (coaches.find(c => c.userId === id)?.firstName ?? 'Coach') : null
  const onDay = (ds: string) => occurrences.filter(c => c.date === ds)
  // Is the assigned coach unavailable (congé / maladie) on this date?
  const coachOnLeave = (coachUserId: string | null, dateISO: string) => {
    if (!coachUserId) return false
    const c = coaches.find(x => x.userId === coachUserId)
    if (!c || (c.employmentStatus !== 'on_leave' && c.employmentStatus !== 'sick')) return false
    if (c.leaveStart && dateISO < c.leaveStart) return false
    if (c.leaveEnd && dateISO > c.leaveEnd) return false
    return true
  }

  const onDelete = async (c: ClassOccurrence) => {
    if (!window.confirm(`Supprimer "${c.title}" du ${DAY_LABELS[c.weekday]} ? Tous les cours de cette série seront retirés.`)) return
    await deleteSchedule(c.id); toast.success('Série supprimée'); void load()
  }

  const shift = (dir: number) => {
    setSelectedDay(null)
    setAnchor(a => { const d = new Date(a); view === 'week' ? d.setDate(a.getDate() + dir * 7) : d.setMonth(a.getMonth() + dir); return d })
  }

  if (!org) return null

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(range.monday); d.setDate(range.monday.getDate() + i); return d })
  const todayISO = iso(new Date())
  const defaultDay = (todayISO >= range.fromISO && todayISO <= range.toISO) ? todayISO : range.fromISO
  const activeDay = selectedDay ?? defaultDay

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-5"><BackButton /></div>
        <div className="pt-2 pb-4 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">Planning</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">{org.orgName}</p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-xs font-bold">
            {(['week', 'month'] as const).map(v => (
              <button key={v} onClick={() => { setView(v); setSelectedDay(null) }} className="px-3 py-2"
                style={view === v ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { color: 'var(--sub)' }}>
                {v === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shift(-1)} className="w-9 h-9 rounded-full bg-[var(--card)] border border-[color:var(--border)] text-[var(--ink-soft)] text-lg leading-none">‹</button>
          <p className="text-sm font-bold text-[var(--ink-soft)] text-center">
            {view === 'week'
              ? `${range.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
              : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}
          </p>
          <button onClick={() => shift(1)} className="w-9 h-9 rounded-full bg-[var(--card)] border border-[color:var(--border)] text-[var(--ink-soft)] text-lg leading-none">›</button>
        </div>

        <button onClick={() => setShowForm(true)}
          className="w-full mb-5 py-3 rounded-2xl text-white font-bold text-sm" style={{ background: 'var(--theme-primary, #F97316)' }}>
          + Ajouter un cours récurrent
        </button>

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">Chargement…</p>
        ) : (
          <>
            {view === 'week' ? (
              <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-3 mb-4">
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((d, i) => {
                    const ds = iso(d); const count = onDay(ds).length; const sel = activeDay === ds
                    return (
                      <button key={i} onClick={() => setSelectedDay(ds)}
                        className="min-h-16 rounded-lg flex flex-col items-center justify-center gap-0.5"
                        style={{ background: sel ? 'var(--theme-primary, #F97316)' : count ? 'var(--accent-soft)' : 'var(--bg)' }}>
                        <span className={`text-[10px] font-bold ${sel ? 'text-white' : 'text-[var(--muted)]'}`}>{DAY_WK[i]}</span>
                        <span className={`text-sm font-black ${sel ? 'text-white' : 'text-[var(--ink-soft)]'}`}>{d.getDate()}</span>
                        {count > 0 && <span className={`text-[8px] font-bold ${sel ? 'text-white' : 'text-orange-500'}`}>{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-3 mb-4">
                <div className="grid grid-cols-7 mb-1">
                  {DAY_HDR.map((d, i) => <p key={i} className="text-center text-[10px] font-bold text-[var(--muted)]">{d}</p>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthCells(anchor.getFullYear(), anchor.getMonth()).map((day, i) => {
                    if (!day) return <div key={i} />
                    const ds = iso(new Date(anchor.getFullYear(), anchor.getMonth(), day))
                    const count = onDay(ds).length; const sel = activeDay === ds
                    return (
                      <button key={i} onClick={() => setSelectedDay(ds)} className="min-h-12 rounded-lg flex flex-col items-center justify-center"
                        style={{ background: sel ? 'var(--theme-primary, #F97316)' : count ? 'var(--accent-soft)' : 'var(--bg)' }}>
                        <span className={`text-xs font-bold ${sel ? 'text-white' : 'text-[var(--ink-soft)]'}`}>{day}</span>
                        {count > 0 && <span className={`text-[9px] font-bold ${sel ? 'text-white' : 'text-orange-500'}`}>{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Selected day's classes */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">
                {new Date(activeDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <div className="flex rounded-lg overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-[11px] font-bold">
                {(['list', 'timeline'] as const).map(v => (
                  <button key={v} onClick={() => setDayView(v)} className="px-2.5 py-1"
                    style={dayView === v ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { color: 'var(--sub)' }}>
                    {v === 'list' ? 'Liste' : 'Horaires'}
                  </button>
                ))}
              </div>
            </div>
            {onDay(activeDay).length === 0 ? (
              <p className="text-sm text-[var(--border-strong)] py-2">Aucun cours ce jour.</p>
            ) : dayView === 'list' ? (
              <div className="space-y-2">{onDay(activeDay).map(c => (
                <OccRow key={c.id + c.date} c={c} coachName={coachName} onDelete={onDelete}
                  booking={bookings.get(bookingKey(c.id, c.date))} onOpen={() => setAttendeesFor(c)}
                  onLeave={coachOnLeave(c.coachUserId, c.date)} />
              ))}</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(onDay(activeDay).reduce<Record<string, ClassOccurrence[]>>((acc, c) => {
                  (acc[c.startTime] ??= []).push(c); return acc
                }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([time, cs]) => (
                  <div key={time} className="flex gap-2">
                    <div className="w-11 flex-shrink-0 text-xs font-black text-[var(--muted)] pt-2">{time}</div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      {cs.map(c => {
                        const bk = bookings.get(bookingKey(c.id, c.date))
                        const booked = bk?.bookedCount ?? 0
                        const full = booked >= c.capacity
                        return (
                          <button key={c.id + c.date} onClick={() => setAttendeesFor(c)}
                            className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-2.5 text-left">
                            <p className="text-xs font-bold text-[var(--ink)] truncate">{c.title}</p>
                            <p className="text-[10px] text-[var(--muted)]">{c.startTime}–{endTime(c.startTime, c.durationMin)}</p>
                            <p className={`text-[10px] font-bold ${full ? 'text-red-500' : 'text-[var(--sub)]'}`}>{booked}/{c.capacity}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showForm && orgId && (
        <ScheduleForm orgId={orgId} coaches={coaches} sessionTypes={sessionTypes}
          onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load() }} />
      )}

      {attendeesFor && (
        <AttendeesSheet occ={attendeesFor} onClose={() => setAttendeesFor(null)} />
      )}
    </div>
  )
}

function OccRow({ c, coachName, onDelete, booking, onOpen, onLeave }: {
  c: ClassOccurrence; coachName: (id: string | null) => string | null
  onDelete: (c: ClassOccurrence) => void; booking?: OccBooking; onOpen: () => void; onLeave?: boolean
}) {
  const booked = booking?.bookedCount ?? 0
  const waiting = booking?.waitlistCount ?? 0
  const full = booked >= c.capacity
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3 flex items-center justify-between gap-2">
      <button onClick={onOpen} className="min-w-0 text-left flex-1">
        <p className="text-sm font-bold text-[var(--ink)] truncate">
          {c.title}
          {onLeave && <span className="ml-1.5 text-[10px] font-bold text-amber-600">⚠️ coach indisponible</span>}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {c.startTime}–{endTime(c.startTime, c.durationMin)} · {c.durationMin} min
          {coachName(c.coachUserId) && ` · ${coachName(c.coachUserId)}`}
        </p>
        <p className="text-xs mt-0.5">
          <span className={`font-bold ${full ? 'text-red-500' : 'text-[var(--ink-soft)]'}`}>{booked}/{c.capacity}</span>
          <span className="text-[var(--muted)]"> réservés</span>
          {waiting > 0 && <span className="text-amber-600 font-semibold"> · {waiting} en attente</span>}
        </p>
      </button>
      <button onClick={() => onDelete(c)} className="text-[var(--border-strong)] hover:text-red-500 text-xl px-2 flex-shrink-0">×</button>
    </div>
  )
}

function AttendeesSheet({ occ, onClose }: { occ: ClassOccurrence; onClose: () => void }) {
  const [att, setAtt] = useState<Attendee[] | null>(null)
  useEffect(() => {
    let alive = true
    getOccurrenceAttendees(occ.id, occ.date)
      .then(a => { if (alive) setAtt(a) })
      .catch(e => { toast.error(e instanceof Error ? e.message : 'Erreur'); if (alive) setAtt([]) })
    return () => { alive = false }
  }, [occ.id, occ.date])

  const booked = (att ?? []).filter(a => a.status === 'booked')
  const waiting = (att ?? []).filter(a => a.status === 'waitlisted')
  const dateLabel = new Date(occ.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-lg rounded-t-3xl p-5 pb-8 max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-black text-[var(--ink)]">{occ.title}</h2>
        <p className="text-xs text-[var(--muted)] mb-4">{dateLabel} · {occ.startTime}</p>

        {att === null ? (
          <p className="text-sm text-[var(--muted)] text-center py-6">Chargement…</p>
        ) : (
          <>
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wide mb-2">Inscrits ({booked.length}/{occ.capacity})</p>
            {booked.length === 0
              ? <p className="text-sm text-[var(--border-strong)] mb-3">Personne d’inscrit.</p>
              : <div className="space-y-1.5 mb-4">{booked.map(a => (
                  <div key={a.userId} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                    <span className="w-6 h-6 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold flex items-center justify-center">
                      {(a.firstName ?? '?').charAt(0).toUpperCase()}
                    </span>
                    {a.firstName ?? 'Membre'}
                  </div>
                ))}</div>}

            {waiting.length > 0 && (
              <>
                <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wide mb-2">Liste d’attente ({waiting.length})</p>
                <div className="space-y-1.5">{waiting.map(a => (
                  <div key={a.userId} className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                    <span className="w-6 h-6 rounded-full bg-[var(--track)] text-[var(--sub)] text-xs font-bold flex items-center justify-center">{a.position}</span>
                    {a.firstName ?? 'Membre'}
                    {a.notified && <span className="text-[11px] text-amber-600 font-semibold">· prévenu</span>}
                  </div>
                ))}</div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ScheduleForm({ orgId, coaches, sessionTypes, onClose, onSaved }: {
  orgId: string; coaches: OrgMember[]; sessionTypes: SessionType[]
  onClose: () => void; onSaved: () => void
}) {
  const [type, setType] = useState('')
  const [title, setTitle] = useState('')
  const [coach, setCoach] = useState('')
  const [capacity, setCapacity] = useState(String(DEFAULT_CAPACITY))
  const [duration, setDuration] = useState(DEFAULT_DURATION_MIN)
  const [waitlist, setWaitlist] = useState('')   // empty = use the box default
  const [slots, setSlots] = useState<WeeklySlot[]>([{ weekday: 0, time: '18:00' }])
  const [saving, setSaving] = useState(false)

  const fieldCls = 'w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-2.5 text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
  const labelCls = 'block text-xs font-bold text-[var(--sub)] uppercase tracking-wide mb-1.5'

  const types = sessionTypes.length > 0 ? sessionTypes : DEFAULT_SESSION_TYPES
  const pickType = (name: string) => {
    setType(name)
    const t = types.find(s => s.name === name)
    if (t) { setTitle(t.name); setDuration(t.defaultDurationMin); setCapacity(String(t.defaultCapacity)) }
  }
  const updSlot = (i: number, patch: Partial<WeeklySlot>) => setSlots(s => s.map((x, j) => j === i ? { ...x, ...patch } : x))

  const submit = async () => {
    if (!title.trim()) { toast.error('Titre requis'); return }
    const cap = parseInt(capacity)
    if (!cap || cap < 1) { toast.error('Nombre de places requis'); return }
    if (slots.length === 0) { toast.error('Ajoute au moins un créneau'); return }
    setSaving(true)
    try {
      const wl = waitlist.trim() === '' ? null : Math.max(0, parseInt(waitlist) || 0)
      const n = await createSchedules({
        orgId, title, sessionType: type || null, coachUserId: coach || null,
        capacity: cap, durationMin: duration, waitlistCapacity: wl, slots, startDateISO: iso(new Date()),
      })
      toast.success(`${n} créneau${n > 1 ? 'x' : ''} ajouté${n > 1 ? 's' : ''}`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur'); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-lg rounded-t-3xl p-5 pb-8 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-black text-[var(--ink)] mb-1">Cours récurrent</h2>
        <p className="text-xs text-[var(--muted)] mb-4">Se répète chaque semaine, jusqu’à ce que tu le supprimes.</p>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Type de séance</label>
            <select className={fieldCls} value={type} onChange={e => pickType(e.target.value)}>
              <option value="">— Choisir —</option>
              {types.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Titre</label>
            <input className={fieldCls} value={title} placeholder="WOD, Haltéro, Open gym…" onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Places *</label>
              <input type="number" min={1} className={fieldCls} value={capacity} onChange={e => setCapacity(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Durée (min)</label>
              <input type="number" min={15} step={15} className={fieldCls} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 60)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Liste d’attente</label>
            <input type="number" min={0} className={fieldCls} value={waitlist} placeholder="Défaut de la box"
              onChange={e => setWaitlist(e.target.value)} />
            <p className="text-[11px] text-[var(--muted)] mt-1">Laisse vide pour utiliser le réglage de la box.</p>
          </div>
          <div>
            <label className={labelCls}>Coach</label>
            <select className={fieldCls} value={coach} onChange={e => setCoach(e.target.value)}>
              <option value="">— Non assigné —</option>
              {coaches.map(c => <option key={c.userId} value={c.userId}>{c.firstName ?? 'Coach'}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Jours &amp; horaires</label>
            <div className="space-y-2">
              {slots.map((s, i) => (
                <div key={i} className="rounded-xl border border-[color:var(--border)] p-2.5">
                  <div className="flex gap-1 mb-2">
                    {DAY_ABBR.map((d, idx) => (
                      <button key={idx} onClick={() => updSlot(i, { weekday: idx })}
                        className="flex-1 h-8 rounded-lg text-[11px] font-bold transition"
                        style={s.weekday === idx ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { background: 'var(--track)', color: 'var(--sub)' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" className={`${fieldCls} flex-1`} value={s.time} onChange={e => updSlot(i, { time: e.target.value })} />
                    <span className="text-xs text-[var(--muted)] whitespace-nowrap">→ {endTime(s.time, duration)}</span>
                    {slots.length > 1 && (
                      <button onClick={() => setSlots(arr => arr.filter((_, j) => j !== i))} className="text-[var(--border-strong)] hover:text-red-500 text-xl px-2">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setSlots(s => [...s, { weekday: 0, time: '18:00' }])} className="mt-2 text-sm font-bold text-[var(--accent-text)]">+ Ajouter un créneau</button>
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full mt-5 py-3.5 rounded-2xl text-white font-black text-base disabled:opacity-50"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          {saving ? 'Ajout…' : 'Ajouter au planning'}
        </button>
      </div>
    </div>
  )
}
