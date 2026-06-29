'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionUserId } from '@/lib/auth'
import { toast } from '@/lib/toast'
import { getGoals, upsertGoal, deleteGoal, type Goal } from '@/lib/goals'
import MovementSearch from '@/components/MovementSearch'
import { PageHeader, Card, SectionTitle, NavRow, Button, Field, Select } from '@/components/ui'
import { getTrainingProfile, saveTrainingProfile, EMPTY_TP, TP_DAYS, TP_TIMES, TP_EQUIPMENT, TP_MOVEMENTS, TP_XP_LEVELS, type TrainingProfile } from '@/lib/trainingProfile'

const toggleIn = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

// ST-35 P1 — Performance hub overview. Aggregates records (personal_records) +
// sessions into cross-movement stats + category balance, links to the detailed
// Records (/prs) and Historique (/sessions) pages (kept), and nudges beta feedback.

type PR = { id: string; movement_id: string; movement_name: string; value: number; unit: string; date: string }

const CATS = [
  { key: 'force',   label: 'Force',       emoji: '🏋️', match: ['squat', 'deadlift', 'soulevé', 'press', 'développé', 'bench'] },
  { key: 'haltero', label: 'Haltéro',     emoji: '🥇', match: ['snatch', 'arraché', 'clean', 'épaulé', 'jerk', 'jeté'] },
  { key: 'gym',     label: 'Gymnastique', emoji: '🤸', match: ['muscle', 'hspu', 'handstand', 'pull', 'traction', 'dip', 'toes', 'pistol', 'rope', 'corde'] },
  { key: 'engine',  label: 'Endurance',   emoji: '🫁', match: ['run', 'course', 'row', 'rameur', 'bike', 'vélo', 'assault', 'ski', 'swim', 'natation', 'km'] },
]
const catOf = (name: string) => { const n = name.toLowerCase(); return CATS.find(c => c.match.some(m => n.includes(m)))?.key ?? 'autre' }
const fmtVal = (v: number, u: string) => u === 'sec' ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : `${v}`
const unitLbl = (u: string) => u === 'sec' ? '' : u === 'reps' ? 'reps' : 'kg'
const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

export default function PerformancePage() {
  const [prs, setPrs] = useState<PR[] | null>(null)
  const [sessMonth, setSessMonth] = useState(0)
  const [tipsEligible, setTipsEligible] = useState(false)   // ST-79: enough real data for AI tips
  const [profile, setProfile] = useState<{ training_profile?: unknown; weight_kg?: number | null } | null>(null)
  const [tp, setTp] = useState<TrainingProfile>(EMPTY_TP)
  const [tpSaved, setTpSaved] = useState<TrainingProfile>(EMPTY_TP)
  const [tpOpen, setTpOpen] = useState(false)
  const [tpSaving, setTpSaving] = useState(false)
  const [tips, setTips] = useState<string[] | null>(null)
  const [tipsAt, setTipsAt] = useState<number | null>(null)
  const [tipsLoading, setTipsLoading] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalMovId, setGoalMovId] = useState('')
  const [goalMovName, setGoalMovName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalBusy, setGoalBusy] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  const loadGoals = () => { getGoals().then(setGoals).catch(() => {}) }
  useEffect(() => { loadGoals() }, [])

  useEffect(() => {
    const run = async () => {
      const uid = await getSessionUserId()
      if (!uid) { setPrs([]); return }
      const ym = new Date().toISOString().slice(0, 7)
      const [prRes, sRes, pRes] = await Promise.all([
        supabase.from('personal_records').select('id, movement_id, movement_name, value, unit, date').eq('user_id', uid).order('date', { ascending: true }),
        supabase.from('sessions').select('id, date, is_demo').eq('user_id', uid),
        supabase.from('user_profile').select('training_profile, weight_kg').eq('user_id', uid).maybeSingle(),
      ])
      setPrs((prRes.data ?? []) as PR[])
      const allS = (sRes.data ?? []) as { date: string; is_demo?: boolean }[]
      setSessMonth(allS.filter(s => s.date?.startsWith(ym)).length)
      // ST-79: AI tips need real (non-demo) substance — ≥3 sessions AND ≥2 weeks of history.
      const real = allS.filter(s => !s.is_demo && s.date)
      const earliest = real.map(s => s.date).sort()[0]
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
      setTipsEligible(real.length >= 3 && !!earliest && earliest <= twoWeeksAgo)
      setProfile(pRes.data ?? null)
      const tpLoaded = { ...EMPTY_TP, ...((pRes.data?.training_profile as Partial<TrainingProfile> | null) ?? {}) }
      setTp(tpLoaded); setTpSaved(tpLoaded)
    }
    void run()
  }, [])

  // Restore cached tips (on-demand only — keeps AI cost negligible).
  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem('perf_tips') || 'null'); if (c?.tips) { setTips(c.tips); setTipsAt(c.at) } } catch {}
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

  // Best per movement (for goal progress).
  const bestByMov = new Map<string, { name: string; best: number; unit: string }>()
  prs.forEach(p => { const e = bestByMov.get(p.movement_id); if (!e) bestByMov.set(p.movement_id, { name: p.movement_name, best: p.value, unit: p.unit }); else if (p.value > e.best) e.best = p.value })

  const saveGoal = async () => {
    const target = parseFloat(goalTarget)
    if (!goalMovId || !goalMovName || isNaN(target) || target <= 0) { toast.error('Choisis un mouvement et un objectif valide'); return }
    const unit = bestByMov.get(goalMovId)?.unit ?? 'kg'
    setGoalBusy(true)
    try { await upsertGoal(goalMovId, goalMovName, target, unit); toast.success('Objectif enregistré'); setShowAddGoal(false); setGoalMovId(''); setGoalMovName(''); setGoalTarget(''); loadGoals() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setGoalBusy(false)
  }
  const removeGoal = async (id: string) => {
    try { await deleteGoal(id); loadGoals() } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  const updTp = (patch: Partial<TrainingProfile>) => setTp(prev => ({ ...prev, ...patch }))
  const tpDirty = JSON.stringify(tp) !== JSON.stringify(tpSaved)
  const saveTp = async () => {
    setTpSaving(true)
    try { await saveTrainingProfile(tp); setTpSaved(tp); toast.success('Profil sportif enregistré') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setTpSaving(false)
  }

  const buildSummary = () => {
    const byMov = new Map<string, { name: string; best: number; count: number; last: string; unit: string; cat: string }>()
    prs.forEach(p => {
      const e = byMov.get(p.movement_id)
      if (!e) byMov.set(p.movement_id, { name: p.movement_name, best: p.value, count: 1, last: p.date, unit: p.unit, cat: catOf(p.movement_name) })
      else { e.count++; if (p.value > e.best) e.best = p.value; if ((p.date ?? '') > e.last) e.last = p.date }
    })
    const movements = [...byMov.values()].sort((a, b) => b.count - a.count).slice(0, 20)
    return { sessionsThisMonth: sessMonth, prsThisMonth: prsMonth, categoryCounts: catCount, movements,
      bodyweightKg: profile?.weight_kg ?? null, trainingProfile: tpSaved }
  }

  const generateTips = async () => {
    setTipsLoading(true)
    try {
      const res = await fetch('/api/performance-tips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: buildSummary() }),
      })
      const data = await res.json()
      if (!res.ok || !Array.isArray(data.tips)) throw new Error(data.message || 'Erreur')
      setTips(data.tips); const at = Date.now(); setTipsAt(at)
      try { localStorage.setItem('perf_tips', JSON.stringify({ at, tips: data.tips })) } catch {}
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setTipsLoading(false)
  }

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
          <Card className="p-4 mb-5 text-center">
            <p className="text-sm text-[var(--muted)] mb-3">Aucun record pour l’instant — logge une séance pour suivre tes progrès.</p>
            <Link href="/log" className="inline-block text-white text-sm font-bold px-5 py-2.5 rounded-xl"
              style={{ background: 'var(--theme-primary, #F97316)' }}>
              + Enregistrer une séance
            </Link>
          </Card>
        ) : (
          <Card className="p-2 mb-5">
            {recent.map(p => (
              <Link key={p.id} href={`/prs/${encodeURIComponent(p.movement_id)}`} className="ds-hover flex items-center justify-between gap-2 p-2.5 rounded-xl">
                <span className="text-sm font-semibold text-[var(--ink)] truncate min-w-0">{p.movement_name}</span>
                <span className="flex flex-col items-end leading-tight flex-shrink-0">
                  <span className="text-sm font-black text-[var(--ink)]">{fmtVal(p.value, p.unit)} <span className="text-xs font-semibold text-[var(--muted)]">{unitLbl(p.unit)}</span></span>
                  <span className="text-[11px] text-[var(--muted)]">{fmtDay(p.date)}</span>
                </span>
              </Link>
            ))}
          </Card>
        )}

        <SectionTitle>Conseils personnalisés</SectionTitle>
        <Card className="p-4 mb-5">
          {!tipsEligible ? (
            <div className="py-1">
              <p className="text-sm font-bold text-[var(--ink)] mb-1.5">🧠 Conseils IA — bientôt pour toi</p>
              <p className="text-sm text-[var(--muted)] leading-relaxed mb-2">
                On analysera tes séances et tes records pour te proposer des pistes de progression concrètes
                (équilibre, points faibles, charge). Pour des conseils <span className="font-semibold text-[var(--ink-soft)]">fiables</span>,
                il faut un minimum de données : au moins <span className="font-semibold text-[var(--ink-soft)]">3 séances</span> et
                <span className="font-semibold text-[var(--ink-soft)]"> 2 semaines</span> d’historique. Continue à logger 💪
              </p>
              <p className="text-xs text-[var(--muted)]">
                On construit cette fonctionnalité avec vous — dis-nous ce que tu en attends via le bouton Feedback 💬 en bas à droite.
              </p>
            </div>
          ) : tips && tips.length > 0 ? (
            <>
              <ul className="space-y-2">
                {tips.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[var(--ink-soft)]">
                    <span className="flex-shrink-0" style={{ color: 'var(--theme-primary, #F97316)' }}>•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[color:var(--track)]">
                <span className="text-[10px] text-[var(--muted)]">IA · indicatif{tipsAt ? ` · ${new Date(tipsAt).toLocaleDateString('fr-FR')}` : ''}</span>
                <button onClick={generateTips} disabled={tipsLoading}
                  className="text-xs font-bold cursor-pointer disabled:opacity-50" style={{ color: 'var(--theme-primary, #F97316)' }}>
                  {tipsLoading ? '…' : 'Rafraîchir'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-1">
              <p className="text-sm text-[var(--muted)] mb-3">Reçois 3–5 conseils personnalisés basés sur tes perfs et ton profil.</p>
              <Button onClick={generateTips} disabled={tipsLoading || prs.length === 0}>
                {tipsLoading ? 'Génération…' : 'Voir mes conseils'}
              </Button>
            </div>
          )}
        </Card>

        <SectionTitle>Profil sportif</SectionTitle>
        <Card className="p-2 mb-5">
          <button onClick={() => setTpOpen(o => !o)} className="ds-hover w-full flex items-center justify-between gap-2 p-2.5 rounded-xl cursor-pointer">
            <span className="min-w-0 text-left">
              <span className="block text-sm font-bold text-[var(--ink)]">Blessures, dispos, matériel, niveau…</span>
              <span className="block text-[11px] text-[var(--muted)]">Alimente tes recommandations IA</span>
            </span>
            <span className="text-[var(--muted)] text-sm flex-shrink-0">{tpOpen ? '▲' : '▼'}</span>
          </button>

          {tpOpen && (
            <div className="px-2.5 pb-2.5 pt-1 space-y-5">
              <div>
                <label className="block text-xs font-bold text-[var(--sub)] mb-1.5">Blessures / limitations</label>
                <textarea rows={2} value={tp.injuries} onChange={e => updTp({ injuries: e.target.value })}
                  placeholder="Ex : épaule droite fragile, éviter le rachis chargé…" className="ds-field resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--sub)] mb-1.5">Jours dispo</label>
                <div className="flex flex-wrap gap-1.5">
                  {TP_DAYS.map(([v, l]) => {
                    const on = tp.available_days.includes(v)
                    return (
                      <button key={v} type="button" onClick={() => updTp({ available_days: toggleIn(tp.available_days, v) })}
                        className="px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition"
                        style={on ? { background: 'var(--theme-primary, #F97316)', color: '#fff', borderColor: 'transparent' } : { color: 'var(--sub)', borderColor: 'var(--border)' }}>
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--sub)] mb-1.5">Moment préféré</label>
                <Select value={tp.preferred_times} onChange={v => updTp({ preferred_times: v })} options={TP_TIMES} placeholder="Choisir" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--sub)] mb-1.5">Matériel accessible</label>
                <div className="flex flex-wrap gap-1.5">
                  {TP_EQUIPMENT.map(e => {
                    const on = tp.equipment.includes(e)
                    return (
                      <button key={e} type="button" onClick={() => updTp({ equipment: toggleIn(tp.equipment, e) })}
                        className="px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition"
                        style={on ? { background: 'var(--theme-primary, #F97316)', color: '#fff', borderColor: 'transparent' } : { color: 'var(--sub)', borderColor: 'var(--border)' }}>
                        {e}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--sub)] mb-1.5">Objectif détaillé</label>
                <textarea rows={2} value={tp.goal_detail} onChange={e => updTp({ goal_detail: e.target.value })}
                  placeholder="Ex : enchaîner 10 muscle-ups, courir 5 km sous 25 min…" className="ds-field resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--sub)] mb-1.5">Niveau par mouvement</label>
                <div className="space-y-2">
                  {TP_MOVEMENTS.map(([v, l]) => (
                    <div key={v} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--ink-soft)] flex-1 min-w-0">{l}</span>
                      <div className="w-40 flex-shrink-0">
                        <Select value={tp.experience[v] ?? ''} onChange={lvl => updTp({ experience: { ...tp.experience, [v]: lvl } })}
                          options={TP_XP_LEVELS} placeholder="—" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={saveTp} disabled={tpSaving || !tpDirty} full>
                {tpSaving ? 'Enregistrement…' : tpDirty ? 'Enregistrer le profil sportif' : 'Profil à jour ✓'}
              </Button>
            </div>
          )}
        </Card>

        <SectionTitle>Objectifs</SectionTitle>
        <Card className="p-4 mb-5 space-y-3">
          {goals.length === 0 && !showAddGoal && (
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Fixe un objectif par mouvement et suis ta progression.{' '}
              <span className="text-[var(--ink-soft)]">Bêta — dis-nous via Feedback ce que tu aimerais ici (échéances, rappels, suggestions IA…).</span>
            </p>
          )}
          {goals.map(g => {
            const cur = bestByMov.get(g.movementId)?.best ?? 0
            const pct = g.target > 0 ? Math.min(100, Math.round((cur / g.target) * 100)) : 0
            const done = cur >= g.target
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[var(--ink)] truncate pr-2">{g.movementName}{done && ' ✅'}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-[var(--sub)]">{fmtVal(cur, g.unit)} / {fmtVal(g.target, g.unit)} {unitLbl(g.unit)}</span>
                    <button onClick={() => removeGoal(g.id)} className="text-[var(--border-strong)] hover:text-red-500 text-lg leading-none cursor-pointer">×</button>
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-[var(--track)]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#22C55E' : 'var(--theme-primary, #F97316)' }} />
                </div>
              </div>
            )
          })}

          {showAddGoal ? (
            <div className="space-y-2 pt-1">
              <Field label="Mouvement">
                <MovementSearch value={goalMovName} onChange={m => { setGoalMovId(m.id); setGoalMovName(m.name) }} />
              </Field>
              <Field label="Objectif"><input type="number" className="ds-field" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="ex. 120" /></Field>
              <div className="flex items-center gap-2">
                <Button onClick={saveGoal} disabled={goalBusy}>{goalBusy ? '…' : 'Enregistrer'}</Button>
                <button onClick={() => { setShowAddGoal(false); setGoalMovId(''); setGoalMovName('') }} className="text-sm font-bold text-[var(--muted)] px-3 cursor-pointer">Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddGoal(true)}
              className="text-sm font-bold cursor-pointer" style={{ color: 'var(--theme-primary, #F97316)' }}>+ Ajouter un objectif</button>
          )}
        </Card>

        <SectionTitle>Explorer</SectionTitle>
        <div className="space-y-2 mb-5">
          <NavRow href="/prs" icon="🏆" title="Records (PRs)" hint="Tous tes mouvements + analyses détaillées" />
          <NavRow href="/sessions" icon="📒" title="Historique des séances" hint="Toutes tes séances loggées" />
        </div>

        <Card className="p-4">
          <p className="text-sm font-bold text-[var(--ink)]">🧪 Bêta — ton avis compte</p>
          <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
            On construit un vrai suivi de performance : tendances, <span className="font-semibold text-[var(--ink-soft)]">recommandations personnalisées</span> et objectifs.
            Dis-nous ce qui te serait le plus utile via le bouton Feedback 💬 en bas à droite.
          </p>
        </Card>
      </div>
    </div>
  )
}
