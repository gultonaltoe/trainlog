'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserId } from '@/lib/user'

type Session = {
  id: string; date: string; rpe: number | null; duration_min: number | null
  session_types: { name: string; emoji: string; color: string }
  session_pain_alerts: Array<{ id: string }>
}

const DAYS_HDR = ['L','M','M','J','V','S','D']
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const RPE_COLORS = ['','#3B82F6','#3B82F6','#3B82F6','#F59E0B','#F59E0B','#D97706','#EA580C','#EA580C','#EF4444','#DC2626']

function calCells(y: number, m: number): (number | null)[] {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const n = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= n; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
}

function p2(n: number) { return String(n).padStart(2, '0') }
function ds(y: number, m: number, d: number) { return `${y}-${p2(m + 1)}-${p2(d)}` }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function relDate(str: string) {
  const d = new Date(str + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const diff = Math.round((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function byMonth(list: Session[]) {
  const groups: Record<string, Session[]> = {}
  list.forEach(s => {
    const key = cap(new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export default function SessionsPage() {
  const router = useRouter()
  const now = new Date()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<'cal' | 'list'>('cal')
  const [calY, setCalY]         = useState(now.getFullYear())
  const [calM, setCalM]         = useState(now.getMonth())
  const [filter, setFilter]     = useState('Tout')

  useEffect(() => {
    supabase.from('sessions')
      .select('id, date, rpe, duration_min, session_types(name,emoji,color), session_pain_alerts(id)')
      .eq('user_id', getUserId())
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(500)
      .then(({ data }) => { setSessions((data ?? []) as unknown as Session[]); setLoading(false) })
  }, [])

  const todayStr = ds(now.getFullYear(), now.getMonth(), now.getDate())
  const isNow    = calY === now.getFullYear() && calM === now.getMonth()

  const prevM = () => {
    if (calM === 0) { setCalY(y => y - 1); setCalM(11) }
    else setCalM(m => m - 1)
  }
  const nextM = () => {
    if (isNow) return
    if (calM === 11) { setCalY(y => y + 1); setCalM(0) }
    else setCalM(m => m + 1)
  }

  const monthSessions = sessions.filter(s => {
    const d = new Date(s.date + 'T00:00:00')
    return d.getFullYear() === calY && d.getMonth() === calM
  })
  const byDate: Record<string, Session[]> = {}
  monthSessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  })
  const cells = calCells(calY, calM)

  const filtered = filter === 'Tout' ? sessions : sessions.filter(s => s.session_types.name === filter)
  const groups   = byMonth(filtered)
  const types    = ['Tout', ...Array.from(new Set(sessions.map(s => s.session_types.name)))]

  // Types uniques ce mois
  const monthTypes = Array.from(
    new Map(monthSessions.map(s => [s.session_types.name, s.session_types])).entries()
  ).slice(0, 4)

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4">

        {/* Back button */}
        <div className="pt-5">
          <button onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Accueil
          </button>
        </div>

        {/* Header */}
        <div className="pt-2 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Historique</h1>
            <p className="text-sm text-gray-400 mt-0.5">{sessions.length} séance{sessions.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
            <button onClick={() => setView('cal')}
              className="px-3 py-2 text-sm font-semibold transition"
              style={view === 'cal' ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { color: '#6B7280' }}>
              📅
            </button>
            <button onClick={() => setView('list')}
              className="px-3 py-2 text-sm font-semibold transition"
              style={view === 'list' ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { color: '#6B7280' }}>
              ☰
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton h-80 rounded-2xl mb-4" />
        ) : view === 'cal' ? (

          /* ── Vue calendrier ──────────────────────────────── */
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">

            {/* Navigation mois */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevM}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-xl leading-none">
                ‹
              </button>
              <h2 className="text-sm font-bold text-gray-800">{MONTHS_FR[calM]} {calY}</h2>
              <button onClick={nextM} disabled={isNow}
                className={`w-9 h-9 flex items-center justify-center rounded-full text-xl leading-none transition ${
                  isNow ? 'text-gray-200 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'
                }`}>
                ›
              </button>
            </div>

            {/* Entêtes jours */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_HDR.map((d, i) => (
                <p key={i} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</p>
              ))}
            </div>

            {/* Grille */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr = ds(calY, calM, day)
                const items   = byDate[dateStr] ?? []
                const first   = items[0]
                const isToday = dateStr === todayStr
                return (
                  <button key={i}
                    onClick={() => items.length > 0 && router.push(`/sessions/${items[0].id}?from=sessions`)}
                    className={`flex flex-col items-center justify-center rounded-xl transition ${
                      items.length > 0 ? 'active:scale-95' : 'cursor-default'
                    }`}
                    style={{
                      minHeight: 50,
                      background: first ? first.session_types.color + '20' : undefined,
                      outline: isToday ? '2px solid var(--theme-primary, #F97316)' : undefined,
                    }}>
                    <span className={`text-[11px] font-bold leading-none mb-0.5 ${
                      isToday ? 'text-orange-500' : items.length > 0 ? 'text-gray-700' : 'text-gray-300'
                    }`}>
                      {day}
                    </span>
                    {first && (
                      <span className="text-sm leading-none">{first.session_types.emoji}</span>
                    )}
                    {items.length > 1 && (
                      <span className="text-[9px] font-bold text-gray-400 leading-none mt-0.5">+{items.length - 1}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Résumé du mois */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-700 whitespace-nowrap">
                  {monthSessions.length} séance{monthSessions.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2 overflow-x-auto">
                  {monthTypes.map(([name, type]) => (
                    <span key={name} className="text-[11px] text-gray-400 whitespace-nowrap flex items-center gap-0.5">
                      <span>{type.emoji}</span>
                      <span>{name}</span>
                    </span>
                  ))}
                  {Array.from(new Map(monthSessions.map(s => [s.session_types.name, s.session_types])).entries()).length > 4 && (
                    <span className="text-[11px] text-gray-300 whitespace-nowrap">…</span>
                  )}
                </div>
              </div>
            </div>
          </div>

        ) : (

          /* ── Vue liste ───────────────────────────────────── */
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {types.map(t => (
                <button key={t} onClick={() => setFilter(t)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0 transition"
                  style={filter === t
                    ? { background: 'var(--theme-primary, #F97316)', borderColor: 'var(--theme-primary, #F97316)', color: '#fff' }
                    : { background: '#fff', borderColor: '#E5E7EB', color: '#6B7280' }}>
                  {t}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-sm font-semibold text-gray-700 mb-1">Aucune séance trouvée</p>
                <Link href="/log"
                  className="inline-block text-white text-sm font-bold px-5 py-2.5 rounded-xl mt-2"
                  style={{ background: 'var(--theme-primary, #F97316)' }}>
                  + Nouvelle séance
                </Link>
              </div>
            ) : (
              Object.entries(groups).map(([month, items]) => (
                <div key={month} className="mb-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{month}</p>
                  <div className="space-y-1.5">
                    {items.map(s => (
                      <Link key={s.id} href={`/sessions/${s.id}?from=sessions`}
                        className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: s.session_types.color + '15', border: `1.5px solid ${s.session_types.color}30` }}>
                          {s.session_types.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800">{s.session_types.name}</p>
                          <p className="text-xs text-gray-400">
                            {relDate(s.date)}{s.duration_min ? ` · ${s.duration_min} min` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.session_pain_alerts?.length > 0 && <span>⚠️</span>}
                          {s.rpe !== null && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ background: RPE_COLORS[s.rpe] }}>
                              {s.rpe}
                            </span>
                          )}
                          <span className="text-gray-300 text-sm">›</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
        <div className="h-4" />
      </div>
    </div>
  )
}
