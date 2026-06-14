'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getRecentSessions } from '@/lib/api'
import type { SessionSummary } from '@/lib/api'

function formatDate(str: string) {
  const d         = new Date(str + 'T00:00:00')
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (str === today)     return "Aujourd'hui"
  if (str === yesterday) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function rpeColor(rpe: number | null) {
  if (!rpe) return '#9CA3AF'
  if (rpe <= 4) return '#3B82F6'
  if (rpe <= 6) return '#F59E0B'
  if (rpe <= 8) return '#EA580C'
  return '#EF4444'
}

const SESSION_TYPES_FILTER = ['Tous','CrossFit','Haltéro','Run','Renfo','Endurance','Technique','Team WOD']

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('Tous')

  useEffect(() => {
    getRecentSessions(200).then(s => { setSessions(s); setLoading(false) })
  }, [])

  const filtered = filter === 'Tous' ? sessions : sessions.filter(s => s.session_type === filter)

  // Grouper par mois
  const grouped: Record<string, SessionSummary[]> = {}
  filtered.forEach(s => {
    const key = new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400 text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-12">

        {/* ── Header ── */}
        <div className="flex items-center justify-between pt-6 pb-4 border-b border-gray-100">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition">← Tableau de bord</Link>
          <span className="text-sm font-semibold text-gray-700">Toutes les séances</span>
          <span className="text-xs text-gray-400">{filtered.length}</span>
        </div>

        {/* ── Filtre par type ── */}
        <div className="flex gap-2 overflow-x-auto py-4 no-scrollbar">
          {SESSION_TYPES_FILTER.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition flex-shrink-0 ${
                filter === t ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 bg-white text-gray-500'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Liste groupée par mois ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">Aucune séance pour ce filtre.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([month, monthSessions]) => (
            <div key={month} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {month.charAt(0).toUpperCase() + month.slice(1)}
                </p>
                <p className="text-xs text-gray-400">{monthSessions.length} séance{monthSessions.length > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {monthSessions.map((s, i) => (
                  <div key={s.id}
                    className={`flex items-center gap-3 p-4 ${i < monthSessions.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: s.type_color + '15', border: `1.5px solid ${s.type_color}30` }}>
                      {s.type_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{s.session_type}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400">{formatDate(s.date)}</p>
                        {s.duration_min && <span className="text-xs text-gray-300">·</span>}
                        {s.duration_min && <p className="text-xs text-gray-400">{s.duration_min} min</p>}
                        {s.blocks_count > 0 && <span className="text-xs text-gray-300">·</span>}
                        {s.blocks_count > 0 && <p className="text-xs text-gray-400">{s.blocks_count} bloc{s.blocks_count > 1 ? 's' : ''}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {s.rpe !== null && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: rpeColor(s.rpe) }}>
                          RPE {s.rpe}
                        </span>
                      )}
                      {s.pain_alerts_count > 0 && (
                        <span className="text-xs text-red-400 font-medium">⚠️ {s.pain_alerts_count}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <Link href="/log"
          className="block w-full py-3.5 rounded-xl bg-orange-500 text-white text-sm font-bold text-center hover:bg-orange-600 transition mt-2">
          + Nouvelle séance
        </Link>

      </div>
    </div>
  )
}
