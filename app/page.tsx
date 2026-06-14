'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getRecentSessions, getProfile } from '@/lib/api'
import type { SessionSummary, UserProfile } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────
function getWeekDays(): Date[] {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d
  })
}
function toDateStr(d: Date) { return d.toISOString().split('T')[0] }
function formatDate(str: string) {
  const today     = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86400000))
  if (str === today)     return "Aujourd'hui"
  if (str === yesterday) return 'Hier'
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function rpeColor(rpe: number | null) {
  if (!rpe) return '#9CA3AF'
  if (rpe <= 4) return '#3B82F6'
  if (rpe <= 6) return '#F59E0B'
  if (rpe <= 8) return '#EA580C'
  return '#EF4444'
}

function getFatigueScore(sessions: SessionSummary[]) {
  const cutoff = Date.now() - 7 * 86400000
  const recent = sessions.filter(s => new Date(s.date + 'T00:00:00').getTime() >= cutoff)
  const rpes   = recent.map(s => s.rpe).filter((r): r is number => r !== null)
  if (!rpes.length) return null
  const avgRpe = rpes.reduce((a, b) => a + b, 0) / rpes.length
  const score  = Math.round((avgRpe / 10) * 100)
  if (score < 35) return { score, label: 'Récupéré',  color: '#10B981', bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700'  }
  if (score < 60) return { score, label: 'Modéré',    color: '#F59E0B', bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700'  }
  if (score < 80) return { score, label: 'Fatigué',   color: '#EA580C', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' }
  return           { score, label: 'Surcharge',  color: '#EF4444', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'    }
}

function getStreak(sessions: SessionSummary[], target: number): number {
  if (!target) return 0
  let streak = 0
  const mon = new Date(getWeekDays()[0])
  mon.setDate(mon.getDate() - 7) // start from last week
  for (let w = 0; w < 52; w++) {
    const start = new Date(mon); start.setDate(mon.getDate() - w * 7)
    const end   = new Date(start); end.setDate(start.getDate() + 7)
    const count = sessions.filter(s => {
      const d = new Date(s.date + 'T00:00:00')
      return d >= start && d < end
    }).length
    if (count >= target) streak++
    else break
  }
  return streak
}

const DAY_LABELS = ['L','M','M','J','V','S','D']

// ── Skeleton ──────────────────────────────────────────────
function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
      <div className="skeleton h-3 w-24 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center mb-3 last:mb-0">
          <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [sessions, setSessions]   = useState<SessionSummary[]>([])
  const [profile, setProfile]     = useState<UserProfile | null>(null)
  const [loading, setLoading]     = useState(true)
  const weekDays                  = getWeekDays()

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([getRecentSessions(60), getProfile()])
    if (!p?.first_name) { router.push('/welcome'); return }
    setSessions(s)
    setProfile(p)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  // Appliquer la couleur de thème
  useEffect(() => {
    if (profile?.theme_color) {
      document.documentElement.style.setProperty('--theme-primary', profile.theme_color)
    }
  }, [profile?.theme_color])

  const weekDayStrs  = weekDays.map(toDateStr)
  const weekSessions = sessions.filter(s => weekDayStrs.includes(s.date))
  const sessionsByDay: Record<string, SessionSummary[]> = {}
  weekDayStrs.forEach(d => { sessionsByDay[d] = weekSessions.filter(s => s.date === d) })

  const weekCount   = weekSessions.length
  const weekTarget  = profile?.weekly_target ?? 0
  const weekRpes    = weekSessions.map(s => s.rpe).filter((r): r is number => r !== null)
  const weekAvgRpe  = weekRpes.length ? (weekRpes.reduce((a, b) => a + b, 0) / weekRpes.length).toFixed(1) : '—'
  const streak      = getStreak(sessions, weekTarget)
  const fatigue     = getFatigueScore(sessions)
  const recent      = sessions.slice(0, 5)

  const thirtyAgo   = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)
  const monthSessions = sessions.filter(s => new Date(s.date) >= thirtyAgo)
  const typeCounts: Record<string, number> = {}
  monthSessions.forEach(s => { typeCounts[s.session_type] = (typeCounts[s.session_type] ?? 0) + 1 })

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">

        {/* ── Header ── */}
        <div className="pt-8 pb-5 flex items-start justify-between">
          <div>
            {loading
              ? <div className="skeleton h-7 w-40 mb-1.5 rounded-lg" />
              : <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Bonjour {profile?.first_name} 👋
                </h1>
            }
            <p className="text-sm text-gray-400 mt-0.5">{capitalize(today)}</p>
          </div>
          <Link href="/log"
            className="bg-orange-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-orange-600 transition shadow-sm whitespace-nowrap">
            + Nouvelle séance
          </Link>
        </div>

        {/* ── Score de fatigue ── */}
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
              <p className={`text-xs mt-0.5 ${fatigue.text} opacity-70`}>
                Basé sur le RPE des 7 derniers jours
              </p>
            </div>
          </div>
        )}

        {/* ── Semaine ── */}
        {loading ? <SkeletonCard rows={2} /> : (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cette semaine</p>
              {streak > 0 && (
                <span className="text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                  🔥 {streak} sem. consécutive{streak > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex gap-1 mb-4">
              {weekDays.map((d, i) => {
                const str        = toDateStr(d)
                const daySessions = sessionsByDay[str] ?? []
                const isToday    = str === toDateStr(new Date())
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
              {/* Séances vs objectif */}
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-gray-900">
                  {weekCount}{weekTarget ? <span className="text-base text-gray-400 font-semibold">/{weekTarget}</span> : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">séance{weekCount > 1 ? 's' : ''}</p>
                {weekTarget > 0 && (
                  <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (weekCount / weekTarget) * 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-gray-900">{weekAvgRpe}</p>
                <p className="text-xs text-gray-400 mt-0.5">RPE moyen</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-gray-900">{streak}</p>
                <p className="text-xs text-gray-400 mt-0.5">semaines</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Séances récentes ── */}
        {loading ? <SkeletonCard rows={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Séances récentes</p>
              <Link href="/sessions" className="text-xs font-semibold text-orange-500 hover:text-orange-600">
                Voir tout →
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-3">🏋️</p>
                <p className="text-sm font-semibold text-gray-700 mb-1">Aucune séance pour l'instant</p>
                <p className="text-xs text-gray-400 mb-4">Ta première séance t'attend.</p>
                <Link href="/log"
                  className="inline-block bg-orange-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-orange-600 transition">
                  + Enregistrer une séance
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {recent.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: s.type_color + '15', border: `1.5px solid ${s.type_color}30` }}>
                      {s.type_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{s.session_type}</p>
                      <p className="text-xs text-gray-400">{formatDate(s.date)}{s.duration_min ? ` · ${s.duration_min} min` : ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {s.rpe !== null && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: rpeColor(s.rpe) }}>
                          {s.rpe}
                        </span>
                      )}
                      {s.pain_alerts_count > 0 && <span className="text-xs">⚠️</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 30 jours ── */}
        {!loading && monthSessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">30 derniers jours</p>
            <div className="space-y-2">
              {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const pct = Math.round((count / monthSessions.length) * 100)
                const s   = monthSessions.find(s => s.session_type === type)
                return (
                  <div key={type} className="flex items-center gap-2.5">
                    <span className="text-base w-5">{s?.type_emoji}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: s?.type_color ?? '#FF6235' }} />
                    </div>
                    <span className="text-xs text-gray-400 w-20 text-right">{type} · {count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
