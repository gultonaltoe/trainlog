'use client'
import { useEffect, useState } from 'react'
import { getProgramming, hasContent, type Programming } from '@/lib/programming'

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ST-34 P1 — member-facing "WOD du jour" for a box (today's programming).
export default function ProgrammingCard({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [p, setP] = useState<Programming | null>(null)
  useEffect(() => {
    let alive = true
    getProgramming(orgId, todayISO()).then(r => { if (alive) setP(r) }).catch(() => {})
    return () => { alive = false }
  }, [orgId])

  if (!hasContent(p)) return null
  const prog = p!
  const Row = ({ label, value }: { label: string; value: string }) => value ? (
    <div>
      <p className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">{label}</p>
      <p className="text-sm text-[var(--ink-soft)] whitespace-pre-line">{value}</p>
    </div>
  ) : null

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--card)] p-4 mb-4">
      <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">🔥 WOD du jour · {orgName}</p>
      {prog.title && <p className="text-base font-black text-[var(--ink)] mb-2">{prog.title}</p>}
      <div className="space-y-2.5">
        <Row label="Échauffement" value={prog.warmup} />
        <Row label="Force / Skill" value={prog.strength} />
        {(prog.wodFormat || prog.wodDescription) && (
          <div>
            <p className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">
              WOD{prog.wodFormat ? ` · ${prog.wodFormat}` : ''}{prog.timeCapMin ? ` · cap ${prog.timeCapMin}'` : ''}
            </p>
            <p className="text-sm text-[var(--ink-soft)] whitespace-pre-line">{prog.wodDescription}</p>
          </div>
        )}
        <Row label="Notes" value={prog.notes} />
      </div>
    </div>
  )
}
