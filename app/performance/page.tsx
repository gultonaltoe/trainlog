'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionUserId } from '@/lib/auth'
import { PageHeader, Card, SectionTitle, NavRow } from '@/components/ui'

// ST-35 P1 — Performance hub overview. Aggregates records (personal_records) +
// sessions into cross-movement stats + category balance, links to the detailed
// Records (/prs) and Historique (/sessions) pages (kept), and nudges beta feedback.

type PR = { id: string; movement_id: string; movement_name: string; value: number; unit: string; date: string }

const CATS = [
  { key: 'force',   label: 'Force',       emoji: '🏋️', match: ['squat', 'deadlift', 'soulevé', 'press', 'développé', 'bench'] },
  { key: 'haltero', label: 'Haltéro',     emoji: '🥇', match: ['snatch', 'arraché', 'clean', 'épaulé', 'jerk', 'jeté'] },
  { key: 'gym',     label: 'Gymnastique', emoji: '🤸', match: ['muscle', 'hspu', 'handstand', 'pull', 'traction', 'dip', 'toes', 'pistol', 'rope', 'corde'] },
  { key: 'engine',  label: 'Engine',      emoji: '🫁', match: ['run', 'course', 'row', 'rameur', 'bike', 'vélo', 'assault', 'ski', 'swim', 'natation', 'km'] },
]
const catOf = (name: string) => { const n = name.toLowerCase(); return CATS.find(c => c.match.some(m => n.includes(m)))?.key ?? 'autre' }
const fmtVal = (v: number, u: string) => u === 'sec' ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : `${v}`
const unitLbl = (u: string) => u === 'sec' ? '' : u === 'reps' ? 'reps' : 'kg'
const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

export default function PerformancePage() {
  const [prs, setPrs] = useState<PR[] | null>(null)
  const [sessMonth, setSessMonth] = useState(0)

  useEffect(() => {
    const run = async () => {
      const uid = await getSessionUserId()
      if (!uid) { setPrs([]); return }
      const ym = new Date().toISOString().slice(0, 7)
      const [prRes, sRes] = await Promise.all([
        supabase.from('personal_records').select('id, movement_id, movement_name, value, unit, date').eq('user_id', uid).order('date', { ascending: true }),
        supabase.from('sessions').select('id, date').eq('user_id', uid),
      ])
      setPrs((prRes.data ?? []) as PR[])
      setSessMonth(((sRes.data ?? []) as { date: string }[]).filter(s => s.date?.startsWith(ym)).length)
    }
    void run()
  }, [])

  if (prs === null) return (
    <div className="bg-[var(--bg)] min-h-screen"><div className="max-w-lg mx-auto px-4">
      <PageHeader title="Progression" /><p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
    </div></div>
  )

  const ym = new Date().toISOString().slice(0, 7)
  const prsMonth = prs.filter(p => p.date?.startsWith(ym)).length
  const movements = new Set(prs.map(p => p.movement_id)).size
  const recent = [...prs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 6)
  const catCount: Record<string, number> = {}
  prs.forEach(p => { const k = catOf(p.movement_name); catCount[k] = (catCount[k] ?? 0) + 1 })

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <PageHeader title="Progression" subtitle="Tes performances, records et historique" />

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[[String(sessMonth), 'Séances (mois)'], [String(prsMonth), 'PRs (mois)'], [String(movements), 'Mouvements']].map(([v, l]) => (
            <Card key={l} className="p-4 text-center">
              <p className="text-2xl font-black text-[var(--ink)]">{v}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">{l}</p>
            </Card>
          ))}
        </div>

        <SectionTitle>Équilibre par catégorie</SectionTitle>
        <Card className="p-4 mb-5 grid grid-cols-2 gap-y-3 gap-x-4">
          {CATS.map(c => (
            <div key={c.key} className="flex items-center gap-2.5">
              <span className="text-xl flex-shrink-0">{c.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--ink)]">{c.label}</p>
                <p className="text-[11px] text-[var(--muted)]">{catCount[c.key] ?? 0} record{(catCount[c.key] ?? 0) > 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </Card>

        <SectionTitle>Progrès récents</SectionTitle>
        {recent.length === 0 ? (
          <Card className="p-4 mb-5"><p className="text-sm text-[var(--muted)]">Aucun record pour l’instant. Logge une séance ou ajoute un PR.</p></Card>
        ) : (
          <Card className="p-2 mb-5">
            {recent.map(p => (
              <Link key={p.id} href={`/prs/${encodeURIComponent(p.movement_id)}`} className="ds-hover flex items-center justify-between p-2.5 rounded-xl">
                <span className="text-sm font-semibold text-[var(--ink)] truncate pr-2">{p.movement_name}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-black text-[var(--ink)]">{fmtVal(p.value, p.unit)} <span className="text-xs font-semibold text-[var(--muted)]">{unitLbl(p.unit)}</span></span>
                  <span className="text-[11px] text-[var(--muted)]">{fmtDay(p.date)}</span>
                </span>
              </Link>
            ))}
          </Card>
        )}

        <SectionTitle>Explorer</SectionTitle>
        <div className="space-y-2 mb-5">
          <NavRow href="/prs" icon="🏆" title="Records (PRs)" hint="Tous tes mouvements + analyses détaillées" />
          <NavRow href="/sessions" icon="📒" title="Historique des séances" hint="Toutes tes séances loggées" />
        </div>

        <Card className="p-4">
          <p className="text-sm font-bold text-[var(--ink)]">🧪 Bêta — ton avis compte</p>
          <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
            On construit un vrai suivi de performance : tendances, <span className="font-semibold text-[var(--ink-soft)]">recommandations personnalisées</span> et objectifs.
            Dis-nous ce qui te serait le plus utile via le bouton retour 💬 en bas à droite.
          </p>
        </Card>
      </div>
    </div>
  )
}
