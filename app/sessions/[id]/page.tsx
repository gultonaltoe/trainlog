'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Session = {
  id: string; date: string; rpe: number | null; duration_min: number | null
  session_types: { name: string; emoji: string; color: string }
  session_pain_alerts: Array<{ id: string }>
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['L','M','M','J','V','S','D']
const RPE_COLORS = ['','#3B82F6','#3B82F6','#3B82F6','#F59E0B','#F59E0B','#D97706','#EA580C','#EA580C','#EF4444','#DC2626']

function toDateStr(d: Date) { return d.toISOString().split('T')[0] }
function formatDateShort(str: string) {
  const d = new Date(str + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
function getMonth(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function getCalendarDays(year: number, month: number): (number | null)[] {
  const first   = new Date(year, month, 1)
  const last    = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const days: (number | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<'calendar' | 'list'>('calendar')
  const [filter, setFilter]     = useState('Tout')

  const now   = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  useEffect(() => {
    supabase.from('sessions')
      .select('id, date, rpe, duration_min, session_types(name, emoji, color), session_pain_alerts(id)')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setSessions((data ?? []) as unknown as Session[])
        setLoading(false)
      })
  }, [])

  const filtered = filter === 'Tout' ? sessions : sessions.filter(s => s.session_types.name === filter)
  const presentTypes = ['Tout', ...Array.from(new Set(sessions.map(s => s.session_types.name)))]

  // ── Calendar helpers ────────────────────────────────────
  const sessionsByDate: Record<string, Session[]> = {}
  sessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = []
    sessionsByDate[s.date].push(s)
  })

  const calDays  = getCalendarDays(calYear, calMonth)
  const todayStr = toDateStr(now)
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }
  const calMonthSessions = sessions.filter(s => {
    const d = new Date(s.date + 'T00:00:00')
    return d.getFullYear() === calYear && d.getMonth() === calMonth
  })

  // ── List helpers ────────────────────────────────────────
  const groups: Record<string, Session[]> = {}
  filtered.forEach(s => {
    const m = getMonth(s.date)
    if (!groups[m]) groups[m] = []
    groups[m].push(s)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4">

        {/* Header */}
        <div className="pt-8 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Historique</h1>
            <p className="text-sm text-gray-400 mt-0.5">{sessions.length} séance{sessions.length > 1 ? 's' : ''} au total</p>
          </div>
          {/* Toggle vue */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'calendar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
              📅 Mois
            </button>
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${view === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
              📋 Liste
            </button>
          </div>
        </div>

        {/* ── VUE CALENDRIER ── */}
        {view === 'calendar' && (
          <div>
            {/* Navigation mois */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition text-lg">←</button>
                <h2 className="text-base font-black text-gray-900">{MONTHS_FR[calMonth]} {calYear}</h2>
                <button onClick={nextMonth} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition text-lg">→</button>
              </div>

              {/* Jours de la semaine */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_FR.map((d, i) => (
                  <div key={i} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Grille jours */}
              <div className="grid grid-cols-7 gap-1">
                {calDays.map((day, i) => {
                  if (!day) return <div key={i} />
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const daySessions = sessionsByDate[dateStr] ?? []
                  const isToday = dateStr === todayStr
                  const hasSessions = daySessions.length > 0
                  const mainSession = daySessions[0]

                  return (
                    <div key={i} className="aspect-square flex flex-col items-center justify-center relative">
                      {hasSessions ? (
                        <Link href={daySessions.length === 1 ? `/sessions/${mainSession.id}` : '#'}
                          className="w-full h-full flex flex-col items-center justify-center rounded-xl transition hover:opacity-80"
                          style={{ background: mainSession.session_types.color + '20', border: `1.5px solid ${mainSession.session_types.color}40` }}>
                          <span className="text-lg leading-none">{mainSession.session_types.emoji}</span>
                          {daySessions.length > 1 && (
                            <span className="text-xs font-bold" style={{ color: mainSession.session_types.color }}>+{daySessions.length - 1}</span>
                          )}
                          <span className={`text-xs font-semibold mt-0.5 ${isToday ? 'text-orange-500' : 'text-gray-500'}`}>{day}</span>
                        </Link>
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center rounded-xl ${isToday ? 'ring-2 ring-orange-400' : ''}`}>
                          <span className={`text-sm font-medium ${isToday ? 'text-orange-500 font-bold' : 'text-gray-300'}`}>{day}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Résumé du mois */}
            {calMonthSessions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  {MONTHS_FR[calMonth]} — {calMonthSessions.length} séance{calMonthSessions.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-1.5">
                  {calMonthSessions.map(s => (
                    <Link key={s.id} href={`/sessions/${s.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: s.session_types.color + '15' }}>
                        {s.session_types.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">{s.session_types.name}</p>
                        <p className="text-xs text-gray-400">{formatDateShort(s.date)}{s.duration_min ? ` · ${s.duration_min} min` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(s.session_pain_alerts?.length ?? 0) > 0 && <span className="text-xs">⚠️</span>}
                        {s.rpe !== null && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: RPE_COLORS[s.rpe] }}>
                            {s.rpe}
                          </span>
                        )}
                        <span className="text-gray-300">›</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {calMonthSessions.length === 0 && !loading && (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">😴</p>
                <p className="text-sm text-gray-400">Aucune séance ce mois-ci.</p>
              </div>
            )}
          </div>
        )}

        {/* ── VUE LISTE ── */}
        {view === 'list' && (
          <div>
            {/* Filtre */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {presentTypes.map(t => (
                <button key={t} onClick={() => setFilter(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0 transition ${
                    filter === t ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-500'
                  }`}>{t}</button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-sm font-semibold text-gray-700 mb-4">Aucune séance trouvée</p>
                <Link href="/log" className="inline-block bg-orange-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">
                  + Nouvelle séance
                </Link>
              </div>
            ) : (
              Object.entries(groups).map(([month, items]) => (
                <div key={month} className="mb-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{capitalize(month)}</p>
                  <div className="space-y-1.5">
                    {items.map(s => (
                      <Link key={s.id} href={`/sessions/${s.id}`}
                        className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: s.session_types.color + '15', border: `1.5px solid ${s.session_types.color}30` }}>
                          {s.session_types.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800">{s.session_types.name}</p>
                          <p className="text-xs text-gray-400">{formatDateShort(s.date)}{s.duration_min ? ` · ${s.duration_min} min` : ''}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(s.session_pain_alerts?.length ?? 0) > 0 && <span className="text-xs">⚠️</span>}
                          {s.rpe !== null && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: RPE_COLORS[s.rpe] }}>
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
          </div>
        )}
      </div>
    </div>
  )
}
