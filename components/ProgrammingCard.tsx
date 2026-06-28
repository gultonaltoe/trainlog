'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProgramming, hasContent, type Programming } from '@/lib/programming'
import { getOrganization, type ProgrammingSettings } from '@/lib/orgs'

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

// ST-34 P1 — member-facing "WOD du jour" for a box (today's programming).
export default function ProgrammingCard({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter()
  const [p, setP] = useState<Programming | null>(null)
  const [vis, setVis] = useState<ProgrammingSettings | null>(null)
  // Only fetch the org visibility setting when there's actually a WOD to gate
  // (avoids an extra round-trip on the home when nothing is published).
  useEffect(() => {
    if (!hasContent(p)) return
    let alive = true
    getOrganization(orgId).then(o => { if (alive) setVis(o.programming) }).catch(() => {})
    return () => { alive = false }
  }, [orgId, p])

  const logThisWod = () => {
    if (!p) return
    try {
      sessionStorage.setItem('log_prefill', JSON.stringify({
        warmup: p.warmup, strength: p.strength, wodFormat: p.wodFormat,
        wodTimeCap: p.timeCapMin, wodDescription: p.wodDescription,
      }))
    } catch {}
    router.push('/log')
  }
  useEffect(() => {
    let alive = true
    getProgramming(orgId, todayISO()).then(r => { if (alive) setP(r) }).catch(() => {})
    return () => { alive = false }
  }, [orgId])

  if (!hasContent(p)) return null
  // Respect the box's reveal setting (ST-34): hide content until revealTime when 'after'.
  if (vis?.wodVisibility === 'after' && nowHHMM() < (vis.revealTime || '00:00')) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--card)] p-4 mb-4">
        <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">🔒 WOD du jour · {orgName}</p>
        <p className="text-sm text-[var(--muted)] mt-1">Dévoilé à {vis.revealTime}.</p>
      </div>
    )
  }
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
      <button onClick={logThisWod}
        className="mt-3 w-full py-2.5 rounded-xl text-white font-black text-sm cursor-pointer"
        style={{ background: 'var(--theme-primary, #F97316)' }}>
        Logger ce WOD
      </button>
    </div>
  )
}
