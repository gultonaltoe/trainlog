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
  const earnedCount = badges.filter(b => b.earned).length

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--card)] p-4 mb-4">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">Ma série</p>
          <p className="text-2xl font-black text-[var(--ink)] leading-tight">
            🔥 {current} <span className="text-base font-bold text-[var(--muted)]">{current > 1 ? 'semaines' : 'semaine'}</span>
          </p>
        </div>
        <p className="text-xs text-[var(--muted)] font-semibold">Record : {longest} · {earnedCount}/{badges.length} badges</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {badges.map(b => (
          <div key={b.key} title={b.hint} className="flex flex-col items-center text-center gap-1">
            <div className="w-11 h-11 rounded-2xl grid place-items-center text-xl"
              style={b.earned
                ? { background: 'var(--accent-soft)', filter: 'none' }
                : { background: 'var(--track)', filter: 'grayscale(1)', opacity: 0.5 }}>
              {b.emoji}
            </div>
            <span className={`text-[9px] font-bold leading-tight ${b.earned ? 'text-[var(--ink-soft)]' : 'text-[var(--muted)]'}`}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
