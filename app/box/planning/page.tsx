'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrgMembers, getOrganization, DEFAULT_DURATION_MIN, DEFAULT_CAPACITY, type OrgMember, type Role, type SessionType } from '@/lib/orgs'
import { getClassesInRange, createClassesFromSlots, deleteClass, type GymClass, type WeeklySlot } from '@/lib/classes'
import { toast } from '@/lib/toast'

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAY_HDR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const STAFF_ROLES: Role[] = ['owner', 'coach', 'staff']

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
  const [classes, setClasses] = useState<GymClass[]>([])
  const [coaches, setCoaches] = useState<OrgMember[]>([])
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const range = useMemo(() => {
    if (view === 'week') {
      const m = mondayOfWeek(anchor); const s = new Date(m); s.setDate(m.getDate() + 6)
      return { fromISO: iso(m), toISO: iso(s), monday: m }
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { fromISO: iso(first), toISO: iso(last), monday: mondayOfWeek(anchor) }
  }, [view, anchor])

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const [cls, mem, info] = await Promise.all([
      getClassesInRange(orgId, range.fromISO, range.toISO),
      getOrgMembers(orgId),
      getOrganization(orgId),
    ])
    setClasses(cls)
    setCoaches(mem.filter(m => m.status === 'active' && STAFF_ROLES.includes(m.role)))
    setSessionTypes(info.sessionTypes)
    setLoading(false)
  }, [orgId, range.fromISO, range.toISO])

  useEffect(() => { void load() }, [load])

  const coachName = (id: string | null) => id ? (coaches.find(c => c.userId === id)?.firstName ?? 'Coach') : null
  const onDay = (ds: string) => classes.filter(c => c.date === ds)
  const onDelete = async (c: GymClass) => { await deleteClass(c.id); toast.success('Cours supprimé'); void load() }

  const shift = (dir: number) => {
    setSelectedDay(null)
    setAnchor(a => { const d = new Date(a); view === 'week' ? d.setDate(a.getDate() + dir * 7) : d.setMonth(a.getMonth() + dir); return d })
  }

  if (!org) return null

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(range.monday); d.setDate(range.monday.getDate() + i); return d })

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Planning</h1>
            <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white text-xs font-bold">
            {(['week', 'month'] as const).map(v => (
              <button key={v} onClick={() => { setView(v); setSelectedDay(null) }}
                className="px-3 py-2"
                style={view === v ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { color: '#6B7280' }}>
                {v === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
        </div>

        {/* Period nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shift(-1)} className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 text-lg leading-none">‹</button>
          <p className="text-sm font-bold text-gray-700 text-center">
            {view === 'week'
              ? `${range.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
              : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}
          </p>
          <button onClick={() => shift(1)} className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 text-lg leading-none">›</button>
        </div>

        <button onClick={() => setShowForm(true)}
          className="w-full mb-5 py-3 rounded-2xl text-white font-bold text-sm" style={{ background: 'var(--theme-primary, #F97316)' }}>
          + Créer des cours
        </button>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
        ) : view === 'week' ? (
          <div className="space-y-4">
            {weekDays.map((d, i) => {
              const items = onDay(iso(d))
              return (
                <div key={i}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {DAY_LABELS[i]} <span className="text-gray-300">{d.getDate()}</span>
                  </p>
                  {items.length === 0 ? <p className="text-xs text-gray-300 pl-1">—</p> : (
                    <div className="space-y-2">{items.map(c => <ClassRow key={c.id} c={c} coachName={coachName} onDelete={onDelete} />)}</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {/* Month calendar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-3 mb-4">
              <div className="grid grid-cols-7 mb-1">
                {DAY_HDR.map((d, i) => <p key={i} className="text-center text-[10px] font-bold text-gray-400">{d}</p>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells(anchor.getFullYear(), anchor.getMonth()).map((day, i) => {
                  if (!day) return <div key={i} />
                  const ds = iso(new Date(anchor.getFullYear(), anchor.getMonth(), day))
                  const count = onDay(ds).length
                  const sel = selectedDay === ds
                  return (
                    <button key={i} onClick={() => setSelectedDay(ds)}
                      className="min-h-12 rounded-lg flex flex-col items-center justify-center"
                      style={{ background: sel ? 'var(--theme-primary, #F97316)' : count ? '#FFF7ED' : '#F9FAFB' }}>
                      <span className={`text-xs font-bold ${sel ? 'text-white' : 'text-gray-700'}`}>{day}</span>
                      {count > 0 && <span className={`text-[9px] font-bold ${sel ? 'text-white' : 'text-orange-500'}`}>{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            {selectedDay && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {onDay(selectedDay).length === 0
                  ? <p className="text-xs text-gray-300">Aucun cours ce jour.</p>
                  : onDay(selectedDay).map(c => <ClassRow key={c.id} c={c} coachName={coachName} onDelete={onDelete} />)}
              </div>
            )}
          </>
        )}
      </div>

      {showForm && orgId && (
        <ClassForm orgId={orgId} coaches={coaches} monday={range.monday} sessionTypes={sessionTypes}
          onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load() }} />
      )}
    </div>
  )
}

function ClassRow({ c, coachName, onDelete }: { c: GymClass; coachName: (id: string | null) => string | null; onDelete: (c: GymClass) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{c.title}</p>
        <p className="text-xs text-gray-400">
          {c.startTime} · {c.durationMin} min
          {coachName(c.coachUserId) && ` · ${coachName(c.coachUserId)}`}
          {c.capacity != null && ` · ${c.capacity} places`}
        </p>
      </div>
      <button onClick={() => onDelete(c)} className="text-gray-300 hover:text-red-500 text-xl px-2 flex-shrink-0">×</button>
    </div>
  )
}

function ClassForm({ orgId, coaches, monday, sessionTypes, onClose, onSaved }: {
  orgId: string; coaches: OrgMember[]; monday: Date; sessionTypes: SessionType[]
  onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [coach, setCoach] = useState('')
  const [capacity, setCapacity] = useState(String(DEFAULT_CAPACITY))
  const [duration, setDuration] = useState(DEFAULT_DURATION_MIN)
  const [weeks, setWeeks] = useState(4)

  // Picking a session type pre-fills title, duration and capacity.
  const pickType = (name: string) => {
    const t = sessionTypes.find(s => s.name === name)
    if (!t) return
    setTitle(t.name); setDuration(t.defaultDurationMin); setCapacity(String(t.defaultCapacity))
  }
  const [slots, setSlots] = useState<WeeklySlot[]>([{ weekday: 0, time: '18:00' }])
  const [saving, setSaving] = useState(false)

  const fieldCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
  const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5'

  const updSlot = (i: number, patch: Partial<WeeklySlot>) => setSlots(s => s.map((x, j) => j === i ? { ...x, ...patch } : x))

  const submit = async () => {
    if (!title.trim()) { toast.error('Titre requis'); return }
    const cap = parseInt(capacity)
    if (!cap || cap < 1) { toast.error('Nombre de places requis'); return }
    if (slots.length === 0) { toast.error('Ajoute au moins un créneau'); return }
    setSaving(true)
    try {
      const n = await createClassesFromSlots({
        orgId, title, coachUserId: coach || null, capacity: cap, durationMin: duration,
        startMondayISO: iso(monday), weeks, slots,
      })
      toast.success(`${n} cours créé${n > 1 ? 's' : ''}`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur'); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-8 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-black text-gray-900 mb-4">Créer des cours</h2>

        <div className="space-y-3">
          {sessionTypes.length > 0 && (
            <div>
              <label className={labelCls}>Type de séance</label>
              <select className={fieldCls} defaultValue="" onChange={e => pickType(e.target.value)}>
                <option value="">— Choisir (pré-remplit) —</option>
                {sessionTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Titre</label>
            <input className={fieldCls} value={title} autoFocus placeholder="WOD, Haltéro, Open gym…" onChange={e => setTitle(e.target.value)} />
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
            <label className={labelCls}>Coach</label>
            <select className={fieldCls} value={coach} onChange={e => setCoach(e.target.value)}>
              <option value="">— Non assigné —</option>
              {coaches.map(c => <option key={c.userId} value={c.userId}>{c.firstName ?? 'Coach'}</option>)}
            </select>
          </div>

          {/* Weekly slots */}
          <div>
            <label className={labelCls}>Créneaux hebdomadaires</label>
            <div className="space-y-2">
              {slots.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className={`${fieldCls} flex-1`} value={s.weekday} onChange={e => updSlot(i, { weekday: parseInt(e.target.value) })}>
                    {DAY_LABELS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                  </select>
                  <input type="time" className={`${fieldCls} w-28`} value={s.time} onChange={e => updSlot(i, { time: e.target.value })} />
                  {slots.length > 1 && (
                    <button onClick={() => setSlots(arr => arr.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 text-xl px-1">×</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setSlots(s => [...s, { weekday: 0, time: '18:00' }])}
              className="mt-2 text-sm font-bold text-orange-600">+ Ajouter un créneau</button>
          </div>

          <div>
            <label className={labelCls}>Répéter pendant</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={52} className={`${fieldCls} w-24`} value={weeks}
                onChange={e => setWeeks(Math.max(1, parseInt(e.target.value) || 1))} />
              <span className="text-sm text-gray-400">semaine{weeks > 1 ? 's' : ''} · {slots.length * weeks} cours au total</span>
            </div>
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full mt-5 py-3.5 rounded-2xl text-white font-black text-base disabled:opacity-50"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          {saving ? 'Création…' : 'Créer les cours'}
        </button>
      </div>
    </div>
  )
}
