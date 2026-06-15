'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getRecentSessions, getProfile } from '@/lib/api'
import type { SessionSummary, UserProfile } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────
function toDateStr(d: Date) { return d.toISOString().split('T')[0] }
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function getWeekStart(offsetWeeks = 0): Date {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - offsetWeeks * 7)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function getMonthRange(offsetMonths = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1)
  const end   = new Date(now.getFullYear(), now.getMonth() - offsetMonths + 1, 0)
  return { start, end }
}

function sessionsBetween(sessions: SessionSummary[], start: Date, end: Date) {
  return sessions.filter(s => {
    const d = new Date(s.date + 'T00:00:00')
    return d >= start && d <= end
  })
}

function avgRpe(sessions: SessionSummary[]) {
  const rpes = sessions.map(s => s.rpe).filter((r): r is number => r !== null)
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null
}

function getFatigueScore(sessions: SessionSummary[]) {
  const cutoff = Date.now() - 7 * 86400000
  const recent = sessions.filter(s => new Date(s.date + 'T00:00:00').getTime() >= cutoff)
  const rpes   = recent.map(s => s.rpe).filter((r): r is number => r !== null)
  if (!rpes.length) return null
  const score = Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length / 10) * 100)
  if (score < 35) return { score, label: 'Récupéré',  color: '#10B981', bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700'  }
  if (score < 60) return { score, label: 'Modéré',    color: '#F59E0B', bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700'  }
  if (score < 80) return { score, label: 'Fatigué',   color: '#EA580C', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' }
  return           { score, label: 'Surcharge',  color: '#EF4444', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'    }
}

function formatDate(str: string) {
  const today     = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86400000))
  if (str === today)     return "Aujourd'hui"
  if (str === yesterday) return 'Hier'
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function rpeColor(rpe: number | null) {
  if (!rpe) return '#9CA3AF'
  if (rpe <= 4) return '#3B82F6'
  if (rpe <= 6) return '#F59E0B'
  if (rpe <= 8) return '#EA580C'
  return '#EF4444'
}

const DAY_LABELS = ['L','M','M','J','V','S','D']
type Period = '7j' | '30j' | '3m' | 'tout'

// ── Composants ─────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

// ── Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const router  = useRouter()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [period, setPeriod]     = useState<Period>('30j')

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([getRecentSessions(200), getProfile()])
    if (!p?.first_name) { router.push('/welcome'); return }
    setSessions(s); setProfile(p); setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (profile?.theme_color)
      document.documentElement.style.setProperty('--theme-primary', profile.theme_color)
  }, [profile?.theme_color])

  // ── Données semaine courante ──────────────────────────────
  const weekStart   = getWeekStart(0)
  const weekEnd     = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekDays    = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d })
  const weekDayStrs = weekDays.map(toDateStr)
  const weekSessions = sessionsBetween(sessions, weekStart, weekEnd)
  const weekCount    = weekSessions.length
  const weekTarget   = profile?.weekly_target ?? 0
  const weekAvgRpe   = avgRpe(weekSessions)
  const fatigue      = getFatigueScore(sessions)

  const sessionsByDay: Record<string, SessionSummary[]> = {}
  weekDayStrs.forEach(d => { sessionsByDay[d] = weekSessions.filter(s => s.date === d) })

  // ── Données 4 semaines (barres) ───────────────────────────
  const weekBars = Array.from({ length: 4 }, (_, i) => {
    const start = getWeekStart(3 - i)
    const end   = new Date(start); end.setDate(start.getDate() + 6)
    const count = sessionsBetween(sessions, start, end).length
    const label = i === 3 ? 'Sem.' : `S-${3 - i}`
    return { label, count }
  })
  const maxBar = Math.max(...weekBars.map(w => w.count), weekTarget, 1)

  // ── Comparaison mois ──────────────────────────────────────
  const thisMo   = getMonthRange(0)
  const lastMo   = getMonthRange(1)
  const thisMoS  = sessionsBetween(sessions, thisMo.start, thisMo.end)
  const lastMoS  = sessionsBetween(sessions, lastMo.start, lastMo.end)
  const deltaCount = thisMoS.length - lastMoS.length
  const thisRpe  = avgRpe(thisMoS)
  const lastRpe  = avgRpe(lastMoS)
  const deltaRpe = thisRpe !== null && lastRpe !== null ? (thisRpe - lastRpe) : null

  // ── Distribution par période ──────────────────────────────
  const now = new Date()
  const periodStart: Record<Period, Date> = {
    '7j':   new Date(now.getTime() - 7  * 86400000),
    '30j':  new Date(now.getTime() - 30 * 86400000),
    '3m':   new Date(now.getTime() - 90 * 86400000),
    'tout': new Date('2000-01-01'),
  }
  const periodSessions = sessions.filter(s => new Date(s.date + 'T00:00:00') >= periodStart[period])
  const typeCounts: Record<string, { count: number; color: string; emoji: string }> = {}
  periodSessions.forEach(s => {
    if (!typeCounts[s.session_type]) typeCounts[s.session_type] = { count: 0, color: s.type_color, emoji: s.type_emoji }
    typeCounts[s.session_type].count++
  })
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1].count - a[1].count)

  const recent = sessions.slice(0, 5)
  const today  = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">

        {/* Header */}
        <div className="pt-8 pb-5 flex items-start justify-between">
          <div>
            {loading
              ? <Skeleton className="h-7 w-40 mb-1.5" />
              : <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Bonjour {profile?.first_name} 👋
                </h1>
            }
            <p className="text-sm text-gray-400 mt-0.5">{capitalize(today)}</p>
          </div>
          <Link href="/log"
            className="text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm whitespace-nowrap"
            style={{ background: 'var(--theme-primary, #F97316)' }}>
            + Séance
          </Link>
        </div>

        {/* Fatigue */}
        {!loading && fatigue && (
          <div className={`rounded-2xl border p-4 mb-4 flex items-center gap-4 ${fatigue.bg} ${fatigue.border}`}>
            <div className="relative w-12 h-12 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke={fatigue.color} strokeWidth="3"
                  strokeDasharray={`${(fatigue.score / 100) * 94} 94`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black" style={{ color: fatigue.color }}>
                {fatigue.score}
              </span>
            </div>
            <div>
              <p className={`text-sm font-bold ${fatigue.text}`}>Charge actuelle · {fatigue.label}</p>
              <p className={`text-xs mt-0.5 ${fatigue.text} opacity-70`}>RPE moyen des 7 derniers jours</p>
            </div>
          </div>
        )}

        {/* Semaine courante */}
        {loading ? <Skeleton className="h-44 mb-4" /> : (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Cette semaine</p>
            <div className="flex gap-1 mb-4">
              {weekDays.map((d, i) => {
                const str = toDateStr(d)
                const daySessions = sessionsByDay[str] ?? []
                const isToday = str === toDateStr(new Date())
                return (
                  <div key={str} className="flex-1 flex flex-col items-center gap-1">
                    <span className={`text-xs font-semibold ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>
                      {DAY_LABELS[i]}
                    </span>
                    {daySessions.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {daySessions.slice(0, 2).map((s, idx) => (
                          <div key={idx} className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                            style={{ background: s.type_color + '20', border: `1.5px solid ${s.type_color}` }}>
                            {s.type_emoji}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`w-8 h-8 rounded-lg border-2 border-dashed ${isToday ? 'border-orange-300' : 'border-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-gray-900">
                  {weekCount}{weekTarget > 0 && <span className="text-base text-gray-400 font-semibold">/{weekTarget}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">séances</p>
                {weekTarget > 0 && (
                  <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (weekCount / weekTarget) * 100)}%`, background: 'var(--theme-primary, #F97316)' }} />
                  </div>
                )}
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-gray-900">
                  {weekAvgRpe !== null ? weekAvgRpe.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">RPE moyen</p>
              </div>
            </div>
          </div>
        )}

        {/* 4 dernières semaines — barres */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">4 dernières semaines</p>
            <div className="flex items-end gap-3" style={{ height: 80 }}>
              {weekBars.map((w, i) => {
                const h = maxBar > 0 ? Math.max(8, Math.round((w.count / maxBar) * 68)) : 8
                const atTarget = weekTarget > 0 && w.count >= weekTarget
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-black text-gray-700">{w.count || ''}</span>
                    <div className="w-full rounded-lg transition-all"
                      style={{
                        height: h,
                        background: w.count === 0 ? '#F3F4F6' : atTarget ? 'var(--theme-primary, #F97316)' : '#FED7AA'
                      }} />
                    <span className="text-xs text-gray-400">{w.label}</span>
                  </div>
                )
              })}
            </div>
            {weekTarget > 0 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                🎯 Objectif : {weekTarget} séances/semaine
              </p>
            )}
          </div>
        )}

        {/* Comparaison mois */}
        {!loading && (thisMoS.length > 0 || lastMoS.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Mois en cours vs précédent</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: capitalize(thisMo.start.toLocaleDateString('fr-FR', { month: 'long' })),
                  count: thisMoS.length,
                  rpe:   thisRpe,
                  main:  true
                },
                {
                  label: capitalize(lastMo.start.toLocaleDateString('fr-FR', { month: 'long' })),
                  count: lastMoS.length,
                  rpe:   lastRpe,
                  main:  false
                },
              ].map(m => (
                <div key={m.label} className={`rounded-xl p-3 ${m.main ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-gray-100'}`}>
                  <p className={`text-xs font-bold mb-2 ${m.main ? 'text-orange-600' : 'text-gray-400'}`}>{m.label}</p>
                  <p className={`text-2xl font-black ${m.main ? 'text-orange-700' : 'text-gray-700'}`}>{m.count}</p>
                  <p className="text-xs text-gray-400">séances</p>
                  {m.rpe !== null && (
                    <p className="text-xs text-gray-500 mt-1">RPE {m.rpe.toFixed(1)}</p>
                  )}
                </div>
              ))}
            </div>
            {(deltaCount !== 0 || deltaRpe !== null) && (
              <div className="mt-3 flex gap-4">
                {deltaCount !== 0 && (
                  <div className={`flex items-center gap-1 text-xs font-semibold ${deltaCount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    <span>{deltaCount > 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(deltaCount)} séance{Math.abs(deltaCount) > 1 ? 's' : ''}</span>
                  </div>
                )}
                {deltaRpe !== null && Math.abs(deltaRpe) > 0.2 && (
                  <div className={`flex items-center gap-1 text-xs font-semibold ${deltaRpe < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    <span>{deltaRpe < 0 ? '↓' : '↑'}</span>
                    <span>RPE {deltaRpe > 0 ? '+' : ''}{deltaRpe.toFixed(1)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Séances récentes */}
        {loading ? <Skeleton className="h-48 mb-4" /> : (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Séances récentes</p>
              <Link href="/sessions" className="text-xs font-semibold text-orange-500">Voir tout →</Link>
            </div>
            {recent.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-3">🏋️</p>
                <p className="text-sm font-semibold text-gray-700 mb-1">Aucune séance pour l'instant</p>
                <Link href="/log"
                  className="inline-block text-white text-sm font-bold px-5 py-2.5 rounded-xl mt-2"
                  style={{ background: 'var(--theme-primary, #F97316)' }}>
                  + Enregistrer une séance
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {recent.map(s => (
                  <Link key={s.id} href={`/sessions/${s.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: s.type_color + '15', border: `1.5px solid ${s.type_color}30` }}>
                      {s.type_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{s.session_type}</p>
                      <p className="text-xs text-gray-400">{formatDate(s.date)}{s.duration_min ? ` · ${s.duration_min} min` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.pain_alerts_count > 0 && <span className="text-xs">⚠️</span>}
                      {s.rpe !== null && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: rpeColor(s.rpe) }}>
                          {s.rpe}
                        </span>
                      )}
                      <span className="text-gray-300 text-sm">›</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Distribution par période */}
        {!loading && sessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Répartition</p>
              <div className="flex gap-1">
                {(['7j','30j','3m','tout'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      period === p
                        ? 'text-white'
                        : 'text-gray-400 bg-gray-50'
                    }`}
                    style={period === p ? { background: 'var(--theme-primary, #F97316)' } : {}}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {sortedTypes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Aucune séance sur cette période</p>
            ) : (
              <div className="space-y-2.5">
                {sortedTypes.map(([type, { count, color, emoji }]) => {
                  const pct = Math.round((count / periodSessions.length) * 100)
                  return (
                    <div key={type} className="flex items-center gap-2.5">
                      <span className="text-base w-5 flex-shrink-0">{emoji}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap text-right w-24">
                        {type} · {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
