'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrgMembers, type OrgMember, type Role } from '@/lib/orgs'
import { getClassesForWeek, createClasses, deleteClass, type GymClass } from '@/lib/classes'
import { toast } from '@/lib/toast'

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const STAFF_ROLES: Role[] = ['owner', 'coach', 'staff']

function mondayOf(offsetWeeks: number): Date {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offsetWeeks * 7)
  mon.setHours(0, 0, 0, 0)
  return mon
}
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PlanningPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const [weekOffset, setWeekOffset] = useState(0)
  const [classes, setClasses] = useState<GymClass[]>([])
  const [coaches, setCoaches] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const monday = useMemo(() => mondayOf(weekOffset), [weekOffset])
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d }),
    [monday],
  )
  const sunday = days[6]

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const [cls, mem] = await Promise.all([
      getClassesForWeek(orgId, iso(monday), iso(sunday)),
      getOrgMembers(orgId),
    ])
    setClasses(cls)
    setCoaches(mem.filter(m => m.status === 'active' && STAFF_ROLES.includes(m.role)))
    setLoading(false)
  }, [orgId, monday, sunday])

  useEffect(() => { void load() }, [load])

  const coachName = (id: string | null) =>
    id ? (coaches.find(c => c.userId === id)?.firstName ?? 'Coach') : null
  const byDay = (d: Date) => classes.filter(c => c.date === iso(d))

  const onDelete = async (c: GymClass) => {
    await deleteClass(c.id); toast.success('Cours supprimé'); void load()
  }

  if (!org) return null

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Planning</h1>
          <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 text-lg leading-none">‹</button>
          <p className="text-sm font-bold text-gray-700 text-center">
            {monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – {sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            {weekOffset === 0 && <span className="text-orange-500"> · cette semaine</span>}
          </p>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 text-lg leading-none">›</button>
        </div>

        <button onClick={() => setShowForm(true)}
          className="w-full mb-5 py-3 rounded-2xl text-white font-bold text-sm"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          + Créer un cours
        </button>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
        ) : (
          <div className="space-y-4">
            {days.map((d, i) => {
              const items = byDay(d)
              return (
                <div key={i}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {DAY_LABELS[i]} <span className="text-gray-300">{d.getDate()}</span>
                  </p>
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-300 pl-1">—</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map(c => (
                        <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{c.title}</p>
                            <p className="text-xs text-gray-400">
                              {c.startTime} · {c.durationMin} min
                              {coachName(c.coachUserId) && ` · ${coachName(c.coachUserId)}`}
                              {c.capacity != null && ` · ${c.capacity} places`}
                            </p>
                          </div>
                          <button onClick={() => onDelete(c)}
                            className="text-gray-300 hover:text-red-500 text-xl px-2 flex-shrink-0">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && orgId && (
        <ClassForm orgId={orgId} coaches={coaches} defaultDate={iso(days[0])}
          onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load() }} />
      )}
    </div>
  )
}

function ClassForm({ orgId, coaches, defaultDate, onClose, onSaved }: {
  orgId: string; coaches: OrgMember[]; defaultDate: string
  onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('18:00')
  const [duration, setDuration] = useState(60)
  const [capacity, setCapacity] = useState('')
  const [coach, setCoach] = useState('')
  const [repeat, setRepeat] = useState(1)
  const [saving, setSaving] = useState(false)

  const fieldCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
  const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5'

  const submit = async () => {
    if (!title.trim()) { toast.error('Titre requis'); return }
    setSaving(true)
    try {
      const n = await createClasses({
        orgId, title, date, startTime, durationMin: duration,
        capacity: capacity ? parseInt(capacity) : null,
        coachUserId: coach || null, repeatWeeks: repeat,
      })
      toast.success(n > 1 ? `${n} cours créés` : 'Cours créé')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-black text-gray-900 mb-4">Nouveau cours</h2>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Titre</label>
            <input className={fieldCls} value={title} autoFocus placeholder="WOD du soir, Haltéro, Open gym…"
              onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={fieldCls} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Heure</label>
              <input type="time" className={fieldCls} value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Durée (min)</label>
              <input type="number" className={fieldCls} value={duration} min={15} step={15}
                onChange={e => setDuration(parseInt(e.target.value) || 60)} />
            </div>
            <div>
              <label className={labelCls}>Places (optionnel)</label>
              <input type="number" className={fieldCls} value={capacity} min={1} placeholder="∞"
                onChange={e => setCapacity(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Coach</label>
            <select className={fieldCls} value={coach} onChange={e => setCoach(e.target.value)}>
              <option value="">— Non assigné —</option>
              {coaches.map(c => (
                <option key={c.userId} value={c.userId}>{c.firstName ?? 'Coach'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Répéter chaque semaine</label>
            <div className="flex items-center gap-2">
              <input type="number" className={`${fieldCls} w-24`} value={repeat} min={1} max={52}
                onChange={e => setRepeat(Math.max(1, parseInt(e.target.value) || 1))} />
              <span className="text-sm text-gray-400">semaine{repeat > 1 ? 's' : ''} {repeat > 1 && `(${repeat} cours)`}</span>
            </div>
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full mt-5 py-3.5 rounded-2xl text-white font-black text-base disabled:opacity-50"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          {saving ? 'Création…' : 'Créer le cours'}
        </button>
      </div>
    </div>
  )
}
