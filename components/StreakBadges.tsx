'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { weekStreaks, computeBadges } from '@/lib/streaks'
import type { SessionSummary } from '@/lib/api'

const WEEK = 7 * 86400000
const mondayTs = (iso: string) => {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d.getTime()
}

// ST-108 — motivational streak + badges from the athlete's logged sessions.
export default function StreakBadges({ sessions, weeklyTarget }: { sessions: SessionSummary[]; weeklyTarget: number }) {
  const [prs, setPrs] = useState(0)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { count } = await supabase.from('block_sets').select('id', { count: 'exact', head: true }).eq('is_pr', true)
        if (alive && typeof count === 'number') setPrs(count)
      } catch { /* non-fatal */ }
    })()
    return () => { alive = false }
  }, [])

  if (sessions.length === 0) return null

  const dates = sessions.map(s => s.date)
  const { current, longest } = weekStreaks(dates)
  const thisMon = mondayTs(new Date().toISOString().slice(0, 10))
  const thisWeek = dates.filter(d => mondayTs(d) === thisMon).length
  const badges = computeBadges({ total: sessions.length, current, longest, thisWeek, weeklyTarget, prs })

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--card)] px-4 py-3 mb-4 flex items-center justify-between gap-3">
      <p className="text-sm font-black text-[var(--ink)] flex-shrink-0">
        🔥 Ma série · {current} <span className="text-[var(--muted)]">sem.</span>
      </p>
      <div className="flex gap-1.5">
        {badges.slice(0, 5).map(b => (
          <span key={b.key} title={b.hint}
            className="w-7 h-7 rounded-lg grid place-items-center text-sm flex-shrink-0"
            style={b.earned
              ? { background: 'var(--accent-soft)' }
              : { background: 'var(--track)', filter: 'grayscale(1)', opacity: 0.45 }}>
            {b.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}
