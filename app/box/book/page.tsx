'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/components/AppContext'
import { getSchedules, occurrencesInRange, type ClassSchedule, type ClassOccurrence } from '@/lib/classes'
import { getBookingsInRange, bookClass, cancelClass, claimWaitlistSpot, bookingKey, type OccBooking } from '@/lib/reservations'
import { getOrganization, DEFAULT_BRAND, type OrgBrand } from '@/lib/orgs'
import { getMyPlans, isUsable, type MemberPlan } from '@/lib/memberPlans'
import { PLAN_KIND_LABEL } from '@/lib/plans'
import MyReservations from '@/components/MyReservations'
import { toast } from '@/lib/toast'

const DAY_WK = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const DAY_HDR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

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

export default function BookPage() {
  const { active, memberships, loading: ctxLoading } = useAppContext()
  const router = useRouter()
  // Which box to book in: the active org if we're in one; else (athlete view)
  // a ?org= param, else the user's first active box membership. Lets owners/
  // coaches and members book from their athlete view too.
  const [paramOrg] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('org') : null)
  const activeBoxes = memberships.filter(m => m.status === 'active')
  const box = active.type === 'org'
    ? { orgId: active.orgId, orgName: active.orgName, role: active.role }
    : (() => {
        const m = activeBoxes.find(x => x.organizationId === paramOrg) ?? activeBoxes[0]
        return m ? { orgId: m.organizationId, orgName: m.organizationName, role: m.role } : null
      })()
  const orgId = box?.orgId
  const orgName = box?.orgName ?? 'Box'
  const role = box?.role ?? 'member'
  useEffect(() => { if (!ctxLoading && !orgId) router.replace('/') }, [ctxLoading, orgId, router])

  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [bookings, setBookings] = useState<Map<string, OccBooking>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)   // key being booked/cancelled
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [brand, setBrand] = useState<OrgBrand>(DEFAULT_BRAND)
  const [policy, setPolicy] = useState('')
  const [showPolicy, setShowPolicy] = useState(false)
  const [tab, setTab] = useState<'browse' | 'mine'>('browse')
  useEffect(() => { if (window.location.hash === '#mine') setTab('mine') }, [])

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

  const loadSchedules = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try { setSchedules(await getSchedules(orgId)) } catch { setSchedules([]) }
    setLoading(false)
  }, [orgId])
  useEffect(() => { void loadSchedules() }, [loadSchedules])

  // Box branding + cancellation policy (member-facing).
  useEffect(() => {
    if (!orgId) return
    getOrganization(orgId).then(info => { setBrand(info.brand); setPolicy(info.cancellationPolicy) }).catch(() => {})
  }, [orgId])

  // The member's own plan(s) — show their active plan / remaining credits.
  const [myPlans, setMyPlans] = useState<MemberPlan[]>([])
  useEffect(() => {
    if (!orgId) return
    getMyPlans(orgId).then(setMyPlans).catch(() => setMyPlans([]))
  }, [orgId])

  const refreshBookings = useCallback(async () => {
    if (!orgId) return
    try { setBookings(await getBookingsInRange(orgId, range.fromISO, range.toISO)) }
    catch { setBookings(new Map()) }
  }, [orgId, range.fromISO, range.toISO])
  useEffect(() => { void refreshBookings() }, [refreshBookings])

  const onDay = (ds: string) => occurrences.filter(c => c.date === ds)

  const act = async (c: ClassOccurrence, action: 'book' | 'cancel' | 'claim') => {
    const key = bookingKey(c.id, c.date)
    setBusy(key)
    try {
      if (action === 'book') {
        const status = await bookClass(c.id, c.date)
        toast.success(status === 'booked' ? 'Réservé ✅' : 'Ajouté en liste d’attente')
      } else if (action === 'claim') {
        await claimWaitlistSpot(c.id, c.date)
        toast.success('Place confirmée ✅')
      } else {
        await cancelClass(c.id, c.date)
        toast.success('Annulé')
      }
      await refreshBookings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  if (!orgId) return null

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(range.monday); d.setDate(range.monday.getDate() + i); return d })
  const todayISO = iso(new Date())
  const defaultDay = (todayISO >= range.fromISO && todayISO <= range.toISO) ? todayISO : range.fromISO
  const activeDay = selectedDay ?? defaultDay

  const shift = (dir: number) => {
    setSelectedDay(null)
    setAnchor(a => { const d = new Date(a); view === 'week' ? d.setDate(a.getDate() + dir * 7) : d.setMonth(a.getMonth() + dir); return d })
  }

  // Apply the box brand color to this surface (members see the box's color).
  const brandStyle = brand.brandColor ? ({ ['--theme-primary' as string]: brand.brandColor } as React.CSSProperties) : undefined

  return (
    <div className="bg-gray-50" style={brandStyle}>
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4 flex items-end justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {brand.logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={brand.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Réserver</h1>
              <p className="text-sm text-gray-400 mt-0.5 truncate">{orgName}</p>
            </div>
          </div>
          {tab === 'browse' && (
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white text-xs font-bold flex-shrink-0">
              {(['week', 'month'] as const).map(v => (
                <button key={v} onClick={() => { setView(v); setSelectedDay(null) }} className="px-3 py-2"
                  style={view === v ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { color: '#6B7280' }}>
                  {v === 'week' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hub toggle: browse & book vs my reservations */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white text-sm font-bold mb-4">
          {([['browse', 'Réserver'], ['mine', 'Mes réservations']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-2.5"
              style={tab === t ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { color: '#6B7280' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'mine' ? (
          <MyReservations orgId={orgId!} />
        ) : (
        <>{/* ── Réserver (browse + book) ── */}

        {/* Member's plan / credits (members only; owner/coach are exempt) */}
        {role === 'member' && (() => {
          const usable = myPlans.find(p => isUsable(p, todayISO))
          if (usable) return (
            <div className="mb-3 rounded-xl bg-white border border-gray-200 p-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800 truncate">{usable.planName}</p>
              <p className="text-xs text-gray-500 flex-shrink-0">
                {usable.creditsRemaining != null ? `${usable.creditsRemaining} crédits` : PLAN_KIND_LABEL[usable.planKind]}
                {usable.endsOn ? ` · jusqu’au ${usable.endsOn}` : ''}
              </p>
            </div>
          )
          return (
            <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-700">Aucun abonnement actif — contacte ta box pour t’inscrire.</p>
            </div>
          )
        })()}

        {policy.trim() && (
          <div className="mb-4">
            <button onClick={() => setShowPolicy(s => !s)} className="text-xs font-bold text-gray-500 flex items-center gap-1">
              ⓘ Politique d’annulation <span className="text-gray-300">{showPolicy ? '▴' : '▾'}</span>
            </button>
            {showPolicy && (
              <p className="text-xs text-gray-500 mt-1.5 whitespace-pre-line bg-white border border-gray-200 rounded-xl p-3">{policy}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shift(-1)} className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 text-lg leading-none">‹</button>
          <p className="text-sm font-bold text-gray-700 text-center">
            {view === 'week'
              ? `${range.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
              : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}
          </p>
          <button onClick={() => shift(1)} className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 text-lg leading-none">›</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
        ) : (
          <>
            {view === 'week' ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-3 mb-4">
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((d, i) => {
                    const ds = iso(d); const count = onDay(ds).length; const sel = activeDay === ds
                    return (
                      <button key={i} onClick={() => setSelectedDay(ds)}
                        className="min-h-16 rounded-lg flex flex-col items-center justify-center gap-0.5"
                        style={{ background: sel ? 'var(--theme-primary, #F97316)' : count ? '#FFF7ED' : '#F9FAFB' }}>
                        <span className={`text-[10px] font-bold ${sel ? 'text-white' : 'text-gray-400'}`}>{DAY_WK[i]}</span>
                        <span className={`text-sm font-black ${sel ? 'text-white' : 'text-gray-700'}`}>{d.getDate()}</span>
                        {count > 0 && <span className={`text-[8px] font-bold ${sel ? 'text-white' : 'text-orange-500'}`}>{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-3 mb-4">
                <div className="grid grid-cols-7 mb-1">
                  {DAY_HDR.map((d, i) => <p key={i} className="text-center text-[10px] font-bold text-gray-400">{d}</p>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthCells(anchor.getFullYear(), anchor.getMonth()).map((day, i) => {
                    if (!day) return <div key={i} />
                    const ds = iso(new Date(anchor.getFullYear(), anchor.getMonth(), day))
                    const count = onDay(ds).length; const sel = activeDay === ds
                    return (
                      <button key={i} onClick={() => setSelectedDay(ds)} className="min-h-12 rounded-lg flex flex-col items-center justify-center"
                        style={{ background: sel ? 'var(--theme-primary, #F97316)' : count ? '#FFF7ED' : '#F9FAFB' }}>
                        <span className={`text-xs font-bold ${sel ? 'text-white' : 'text-gray-700'}`}>{day}</span>
                        {count > 0 && <span className={`text-[9px] font-bold ${sel ? 'text-white' : 'text-orange-500'}`}>{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              {new Date(activeDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {onDay(activeDay).length === 0
              ? <p className="text-sm text-gray-300 py-2">Aucun cours ce jour.</p>
              : <div className="space-y-2">{onDay(activeDay).map(c => (
                  <BookRow key={c.id + c.date} c={c} booking={bookings.get(bookingKey(c.id, c.date))}
                    busy={busy === bookingKey(c.id, c.date)} onAct={act} />
                ))}</div>}
          </>
        )}
        </>
        )}
      </div>
    </div>
  )
}

function BookRow({ c, booking, busy, onAct }: {
  c: ClassOccurrence; booking?: OccBooking; busy: boolean
  onAct: (c: ClassOccurrence, action: 'book' | 'cancel' | 'claim') => void
}) {
  const booked = booking?.bookedCount ?? 0
  const my = booking?.myStatus ?? null
  const full = booked >= c.capacity
  const past = new Date(`${c.date}T${c.startTime}:00`) < new Date()

  let badge: React.ReactNode = null
  if (my === 'booked') badge = <span className="text-[11px] font-bold text-green-600">Réservé ✓</span>
  else if (my === 'waitlisted') badge = <span className="text-[11px] font-bold text-amber-600">Liste d’attente · {booking?.myPosition ?? '–'}e</span>

  // Action button: depends on the member's current state for this occurrence.
  let action: React.ReactNode
  const canClaim = my === 'waitlisted' && booking?.myNotified && !full
  if (past) {
    action = <span className="text-[11px] text-gray-300 px-2">Passé</span>
  } else if (canClaim) {
    action = (
      <div className="flex flex-col gap-1.5">
        <button onClick={() => onAct(c, 'claim')} disabled={busy}
          className="text-xs font-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          {busy ? '…' : 'Confirmer'}
        </button>
        <button onClick={() => onAct(c, 'cancel')} disabled={busy}
          className="text-[11px] font-bold text-gray-400">Annuler</button>
      </div>
    )
  } else if (my) {
    action = (
      <button onClick={() => onAct(c, 'cancel')} disabled={busy}
        className="text-xs font-bold text-red-500 border border-red-200 rounded-lg px-3 py-2 disabled:opacity-50">
        {busy ? '…' : 'Annuler'}
      </button>
    )
  } else if (full) {
    action = (
      <button onClick={() => onAct(c, 'book')} disabled={busy}
        className="text-xs font-bold text-amber-700 bg-amber-100 rounded-lg px-3 py-2 disabled:opacity-50 whitespace-nowrap">
        {busy ? '…' : 'Liste d’attente'}
      </button>
    )
  } else {
    action = (
      <button onClick={() => onAct(c, 'book')} disabled={busy}
        className="text-xs font-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
        style={{ background: 'var(--theme-primary, #F97316)' }}>
        {busy ? '…' : 'Réserver'}
      </button>
    )
  }

  return (
    <div className={`bg-white rounded-xl border p-3 flex items-center justify-between gap-2 ${booking?.myNotified ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{c.title}</p>
        <p className="text-xs text-gray-400">{c.startTime} · {c.durationMin} min</p>
        <p className="text-xs mt-0.5">
          <span className={`font-bold ${full ? 'text-red-500' : 'text-gray-600'}`}>{booked}/{c.capacity}</span>
          <span className="text-gray-400"> places</span>
          {badge && <> · {badge}</>}
        </p>
        {booking?.myNotified && my === 'waitlisted' && (
          <p className="text-[11px] font-semibold text-amber-600 mt-0.5">Une place s’est libérée — confirme vite !</p>
        )}
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  )
}
