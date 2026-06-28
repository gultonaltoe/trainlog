'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMyReservations, type MyReservation } from '@/lib/reservations'
import { endTime } from '@/lib/classes'

const fmtDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

// Member's box home card: next bookings + a Réserver CTA. Shown on the
// dashboard when the active view is a box (member context).
export default function MemberBoxCard({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [upcoming, setUpcoming] = useState<MyReservation[]>([])

  useEffect(() => {
    let alive = true
    getMyReservations(orgId)
      .then(rs => {
        const now = new Date()
        const next = rs.filter(r => new Date(`${r.date}T${r.startTime}:00`) >= now).slice(0, 3)
        if (alive) setUpcoming(next)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [orgId])

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--card)] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">Mes prochains cours</p>
          <p className="text-sm font-bold text-[var(--ink)] truncate">{orgName}</p>
        </div>
        <Link href={`/box/book?org=${orgId}#mine`} className="text-xs font-bold text-[var(--accent-text)] flex-shrink-0">Voir tout</Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-[var(--border-strong)]">Aucune réservation à venir.</p>
      ) : (
        <div className="space-y-1.5">
          {upcoming.map(r => (
            <div key={`${r.scheduleId}|${r.date}`} className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--ink)] truncate">{r.title}</span>
              <span className="text-xs text-[var(--sub)] flex-shrink-0 capitalize">
                {fmtDay(r.date)} · {r.startTime}–{endTime(r.startTime, r.durationMin)}
                {r.status === 'waitlisted' && <span className="text-amber-600 font-bold"> · attente</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
