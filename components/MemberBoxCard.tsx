'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMyReservations, cancelDeadline, fmtDeadline, type MyReservation } from '@/lib/reservations'
import { getOrganization } from '@/lib/orgs'
import { endTime } from '@/lib/classes'

const fmtDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

// Member's box home card: next bookings + a Réserver CTA. Shown on the
// dashboard when the active view is a box (member context).
export default function MemberBoxCard({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [upcoming, setUpcoming] = useState<MyReservation[]>([])
  const [cancelCutoffMin, setCancelCutoffMin] = useState(120)

  useEffect(() => {
    let alive = true
    getMyReservations(orgId)
      .then(rs => {
        const now = new Date()
        const next = rs.filter(r => new Date(`${r.date}T${r.startTime}:00`) >= now).slice(0, 3)
        if (alive) setUpcoming(next)
      })
      .catch(() => {})
    getOrganization(orgId).then(info => { if (alive) setCancelCutoffMin(info.reservations.cancelCutoffMin) }).catch(() => {})
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
        <div className="space-y-2.5">
          {upcoming.map(r => {
            const deadline = cancelDeadline(r.date, r.startTime, cancelCutoffMin)
            const canCancel = new Date() < deadline
            return (
              <div key={`${r.scheduleId}|${r.date}`} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--ink)] truncate">{r.title}</p>
                  {r.status === 'waitlisted'
                    ? <p className="text-[11px] font-bold text-amber-600">{r.notified ? 'Place dispo — confirme !' : 'Liste d’attente'}</p>
                    : <p className={`text-[11px] font-semibold ${canCancel ? 'text-[var(--muted)]' : 'text-red-500'}`}>
                        {canCancel ? `Annulation jusqu’au ${fmtDeadline(deadline)}` : 'Annulation fermée'}
                      </p>}
                </div>
                <span className="text-xs font-bold text-[var(--sub)] flex-shrink-0 capitalize whitespace-nowrap">
                  {fmtDay(r.date)} · {r.startTime}–{endTime(r.startTime, r.durationMin)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
