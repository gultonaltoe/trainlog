'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getSessionUserId } from '@/lib/auth'
import { getOrgMembers, type OrgMember } from '@/lib/orgs'
import { getSchedules, occurrencesInRange, endTime, type ClassSchedule, type ClassOccurrence } from '@/lib/classes'
import { PageHeader, Card, Segmented } from '@/components/ui'

// ST-50 — shared coach agenda. Week/month view of all classes, colour-coded by
// coach, with per-coach filters (default = all). Distinct from member booking.

const DAY_WK = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const DAY_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAY_HDR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const PALETTE = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#EAB308', '#EF4444']
const UNASSIGNED = 'unassigned'

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

export default function AgendaPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const [me, setMe] = useState<string | null>(null)
  const [coaches, setCoaches] = useState<OrgMember[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string> | null>(null)   // null = all

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const [uid, members, sch] = await Promise.all([getSessionUserId(), getOrgMembers(orgId), getSchedules(orgId)])
    setMe(uid)
    setCoaches(members.filter(m => m.status === 'active' && (m.role === 'owner' || m.role === 'coach')))
    setSchedules(sch)
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

  // Colour per coach (stable by index).
  const colorByCoach = useMemo(() => {
    const m = new Map<string, string>()
    coaches.forEach((c, i) => m.set(c.userId, PALETTE[i % PALETTE.length]))
    return m
  }, [coaches])
  const coachName = (id: string | null) => id ? (coaches.find(c => c.userId === id)?.firstName ?? 'Coach') : 'Non assigné'
  const coachColor = (id: string | null) => (id && colorByCoach.get(id)) || 'var(--border-strong)'

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
  const isShown = (o: ClassOccurrence) => !selected || selected.has(o.coachUserId ?? UNASSIGNED)
  const shown = occurrences.filter(isShown)

  const toggleCoach = (key: string) => {
    const all = new Set<string>([...coaches.map(c => c.userId), UNASSIGNED])
    const cur = selected ?? all
    const next = new Set(cur)
    if (next.has(key)) next.delete(key); else next.add(key)
    setSelected(next.size === all.size ? null : next)
  }
  const isActive = (key: string) => !selected || selected.has(key)

  if (!org) return null
  const todayISO = iso(new Date())
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(range.monday); d.setDate(range.monday.getDate() + i); return d })
  const shift = (dir: number) => { setSelectedDay(null); setAnchor(a => { const d = new Date(a); view === 'week' ? d.setDate(a.getDate() + dir * 7) : d.setMonth(a.getMonth() + dir); return d }) }
  const onDay = (ds: string) => shown.filter(o => o.date === ds).sort((a, b) => a.startTime.localeCompare(b.startTime))

  const EventRow = ({ o }: { o: ClassOccurrence }) => (
    <div className="flex items-stretch gap-2.5 bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3">
      <span className="w-1.5 rounded-full flex-shrink-0" style={{ background: coachColor(o.coachUserId) }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--ink)] truncate">{o.title}</p>
        <p className="text-xs text-[var(--muted)]">{o.startTime}–{endTime(o.startTime, o.durationMin)} · {o.capacity} pl.</p>
      </div>
      <span className="text-[11px] font-bold flex-shrink-0 self-center" style={{ color: coachColor(o.coachUserId) }}>{coachName(o.coachUserId)}</span>
    </div>
  )

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="flex items-end justify-between">
          <PageHeader title="Agenda" subtitle="Planning des coachs" backHref="/" />
          <div className="pb-4 flex-shrink-0">
            <Segmented value={view} onChange={v => { setView(v); setSelectedDay(null) }} options={[['week', 'Semaine'], ['month', 'Mois']]} />
          </div>
        </div>

        {/* Coach filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button onClick={() => setSelected(null)}
            className="px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer border"
            style={!selected ? { background: 'var(--theme-primary,#F97316)', color: '#fff', borderColor: 'transparent' } : { color: 'var(--sub)', borderColor: 'var(--border)' }}>
            Tous
          </button>
          {me && coaches.some(c => c.userId === me) && (
            <button onClick={() => setSelected(new Set([me]))}
              className="px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer border"
              style={selected && selected.size === 1 && selected.has(me) ? { background: 'var(--theme-primary,#F97316)', color: '#fff', borderColor: 'transparent' } : { color: 'var(--sub)', borderColor: 'var(--border)' }}>
              Moi
            </button>
          )}
          {coaches.map(c => (
            <button key={c.userId} onClick={() => toggleCoach(c.userId)}
              className="px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer border inline-flex items-center gap-1.5"
              style={isActive(c.userId) ? { borderColor: coachColor(c.userId), color: coachColor(c.userId) } : { color: 'var(--muted)', borderColor: 'var(--border)', opacity: 0.6 }}>
              <span className="w-2 h-2 rounded-full" style={{ background: coachColor(c.userId) }} />
              {c.firstName ?? 'Coach'}
            </button>
          ))}
        </div>

        {/* Period nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shift(-1)} className="ds-hover w-9 h-9 rounded-full bg-[var(--card)] border border-[color:var(--border)] text-[var(--ink-soft)] text-lg leading-none">‹</button>
          <p className="text-sm font-bold text-[var(--ink-soft)]">
            {view === 'week'
              ? `${range.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
              : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}
          </p>
          <button onClick={() => shift(1)} className="ds-hover w-9 h-9 rounded-full bg-[var(--card)] border border-[color:var(--border)] text-[var(--ink-soft)] text-lg leading-none">›</button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
        ) : view === 'week' ? (
          <div className="space-y-4">
            {weekDays.map((d, i) => {
              const ds = iso(d); const evs = onDay(ds)
              if (evs.length === 0) return null
              const today = ds === todayISO
              return (
                <div key={i}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${today ? 'text-[var(--accent-text)]' : 'text-[var(--sub)]'}`}>
                    {DAY_FULL[i]} {d.getDate()}{today ? ' · aujourd’hui' : ''}
                  </p>
                  <div className="space-y-2">{evs.map(o => <EventRow key={o.id + o.date} o={o} />)}</div>
                </div>
              )
            })}
            {weekDays.every(d => onDay(iso(d)).length === 0) && (
              <p className="text-sm text-[var(--border-strong)] text-center py-8">Aucun cours cette semaine.</p>
            )}
          </div>
        ) : (
          <>
            <Card className="p-3 mb-4">
              <div className="grid grid-cols-7 mb-1">{DAY_HDR.map((d, i) => <p key={i} className="text-center text-[10px] font-bold text-[var(--muted)]">{d}</p>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells(anchor.getFullYear(), anchor.getMonth()).map((day, i) => {
                  if (!day) return <div key={i} />
                  const ds = iso(new Date(anchor.getFullYear(), anchor.getMonth(), day))
                  const evs = onDay(ds)
                  const colors = [...new Set(evs.map(o => coachColor(o.coachUserId)))].slice(0, 4)
                  const sel = selectedDay === ds; const today = ds === todayISO
                  return (
                    <button key={i} onClick={() => setSelectedDay(ds)}
                      className="min-h-12 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer border"
                      style={sel ? { background: 'var(--theme-primary,#F97316)', borderColor: 'transparent' } : { borderColor: today ? 'var(--theme-primary,#F97316)' : 'transparent' }}>
                      <span className={`text-xs font-bold ${sel ? 'text-white' : 'text-[var(--ink-soft)]'}`}>{day}</span>
                      <span className="flex gap-0.5 h-1.5">
                        {colors.map((c, j) => <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: sel ? '#fff' : c }} />)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Card>
            {selectedDay ? (
              <>
                <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {onDay(selectedDay).length === 0
                  ? <p className="text-sm text-[var(--border-strong)] py-2">Aucun cours ce jour.</p>
                  : <div className="space-y-2">{onDay(selectedDay).map(o => <EventRow key={o.id + o.date} o={o} />)}</div>}
              </>
            ) : (
              <p className="text-xs text-[var(--muted)] text-center">Touche un jour pour voir les cours.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
