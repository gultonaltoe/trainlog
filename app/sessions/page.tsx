'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Session = {
  id: string; date: string; rpe: number | null; duration_min: number | null
  session_types: { name: string; emoji: string; color: string }
  session_pain_alerts: Array<{ id: string }>
}

function formatDate(str: string) {
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

const RPE_COLORS = ['','#3B82F6','#3B82F6','#3B82F6','#F59E0B','#F59E0B','#D97706','#EA580C','#EA580C','#EF4444','#DC2626']
const TYPE_FILTERS = ['Tout', 'CrossFit', 'Run', 'Haltéro', 'Endurance', 'Renfo', 'Hyrox']

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('Tout')

  useEffect(() => {
    supabase.from('sessions')
      .select(`id, date, rpe, duration_min,
        session_types (name, emoji, color),
        session_pain_alerts (id)`)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setSessions((data ?? []) as unknown as Session[])
        setLoading(false)
      })
  }, [])

  const filtered = filter === 'Tout'
    ? sessions
    : sessions.filter(s => s.session_types.name === filter)

  // Grouper par mois
  const groups: Record<string, Session[]> = {}
  filtered.forEach(s => {
    const m = getMonth(s.date)
    if (!groups[m]) groups[m] = []
    groups[m].push(s)
  })

  // Types présents pour le filtre
  const presentTypes = ['Tout', ...Array.from(new Set(sessions.map(s => s.session_types.name)))]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4">

        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Historique</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {sessions.length} séance{sessions.length > 1 ? 's' : ''} au total
          </p>
        </div>

        {/* Filtre par type */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {presentTypes.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition flex-shrink-0 ${
                filter === t
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">Aucune séance trouvée</p>
            <p className="text-xs text-gray-400 mb-4">Essaie un autre filtre ou log ta première séance.</p>
            <Link href="/log"
              className="inline-block bg-orange-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">
              + Nouvelle séance
            </Link>
          </div>
        ) : (
          Object.entries(groups).map(([month, items]) => (
            <div key={month} className="mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                {capitalize(month)}
              </p>
              <div className="space-y-1.5">
                {items.map(s => (
                  <Link key={s.id} href={`/sessions/${s.id}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 hover:shadow-sm transition active:scale-98">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: s.session_types.color + '15', border: `1.5px solid ${s.session_types.color}30` }}>
                      {s.session_types.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{s.session_types.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatDate(s.date)}{s.duration_min ? ` · ${s.duration_min} min` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.session_pain_alerts?.length > 0 && <span className="text-sm">⚠️</span>}
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
      </div>
    </div>
  )
}
