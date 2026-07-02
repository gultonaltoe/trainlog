'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { seedDemoData } from '@/lib/seedDemoData'
import Wordmark from '@/components/Wordmark'

const SPORTS = [
  { id: 'crossfit',      label: 'CrossFit',       icon: '🏋️', desc: 'WOD, AMRAP, For Time' },
  { id: 'haltérophilie', label: 'Haltérophilie',  icon: '🥇', desc: 'Arraché, épaulé-jeté, complexes' },
  { id: 'run',           label: 'Run / Endurance', icon: '🏃', desc: 'Route, trail, fractionné' },
  { id: 'hyrox',         label: 'Hyrox',           icon: '🔥', desc: '8 stations + run' },
  { id: 'renfo',         label: 'Renfo / Muscu',   icon: '💪', desc: 'Poids, séries, progression' },
  { id: 'natation',      label: 'Natation',         icon: '🏊', desc: 'Longueurs, zones cardio' },
]

const LEVELS = [
  { id: 'débutant',       label: 'Débutant',      desc: 'Je commence ou moins d\'1 an de pratique', icon: '🌱' },
  { id: 'intermédiaire',  label: 'Intermédiaire', desc: '1 à 3 ans — je progresse régulièrement',    icon: '📈' },
  { id: 'avancé',         label: 'Avancé',        desc: 'Plus de 3 ans — je cherche à optimiser',    icon: '🏆' },
]

const GOALS = [
  { id: 'performance',    label: 'Performance',    icon: '🎯', desc: 'Battre mes PRs, progresser' },
  { id: 'santé',          label: 'Santé / Forme',  icon: '💚', desc: 'Rester actif, me sentir bien' },
  { id: 'compétition',    label: 'Compétition',    icon: '🥇', desc: 'Préparer des événements' },
  { id: 'remise_en_forme',label: 'Transformation', icon: '🔥', desc: 'Composition corporelle' },
]

export default function WelcomePage() {
  const router = useRouter()
  const [step, setStep]       = useState(0)
  const [name, setName]       = useState('')
  const [sports, setSports]   = useState<string[]>([])
  const [level, setLevel]     = useState('')
  const [goal, setGoal]       = useState('')
  const [weekly, setWeekly]   = useState(4)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Self-correct: if an onboarded user lands here (e.g. a stray redirect),
  // bounce them straight to the dashboard instead of re-running onboarding.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return  // UserInit handles the unauthenticated case
      const { data } = await supabase
        .from('user_profile').select('id').eq('user_id', user.id).limit(1).maybeSingle()
      if (!cancelled && data) router.replace('/')
    })()
    return () => { cancelled = true }
  }, [router])

  const toggleSport = (id: string) =>
    setSports(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const handleFinish = async () => {
    if (!name.trim()) { setError('Entre ton prénom.'); return }
    setSaving(true)
    setError('')
    try {
      // getUser() validates with the auth server and guarantees the access token
      // is attached to PostgREST. getSession() could return a stored session a tick
      // before the token is wired — the insert's RLS (auth.uid() = user_id) then
      // rejected it, leaving the user stuck re-onboarding forever (ST-125).
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié — réessaie de te connecter.')

      const uid = user.id

      // Idempotent: update an existing row (e.g. a prior partial onboarding),
      // else insert — never fail on a duplicate / re-run.
      const { data: existing } = await supabase.from('user_profile').select('id').eq('user_id', uid).maybeSingle()
      const payload = {
        first_name:    name.trim(),
        sports:        sports,
        level:         level || null,
        goal:          goal  || null,
        weekly_target: weekly,
        user_id:       uid,
      }
      const { error: saveError } = existing
        ? await supabase.from('user_profile').update(payload).eq('id', existing.id)
        : await supabase.from('user_profile').insert(payload)
      if (saveError) throw new Error(saveError.message)

      const { count } = await supabase
        .from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', uid)
      if (!count) await seedDemoData(sports, uid)

      router.push('/')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setSaving(false)
    }
  }

  // ── Step 0: Welcome ──────────────────────────────────────
  if (step === 0) return (
    <div className="bg-[var(--card)] flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">

        <div className="text-center mb-10">
          <Wordmark size={44} className="text-4xl mb-4" />
          <p className="text-base text-[var(--sub)] leading-relaxed">
            Le journal d'entraînement intelligent pour CrossFit, Haltérophilie, Run et Hyrox.
          </p>
        </div>

        {/* Beta badge */}
        <div className="bg-[var(--accent-soft)] border border-[color:var(--accent-soft)] rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider">BÊTA PRIVÉE</span>
          </div>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            Tu fais partie des premiers testeurs. Tes retours façonnent l'app — utilise le bouton <strong>Feedback</strong> à tout moment.
          </p>
        </div>

        {/* Value props */}
        <div className="space-y-3 mb-10">
          {[
            { icon: '📸', title: 'Photo → séance en 2s',     desc: 'Prends le tableau en photo, l\'IA pré-remplit tout' },
            { icon: '🏆', title: 'PRs automatiques',          desc: 'Tes records sont détectés et trackés en temps réel' },
            { icon: '📊', title: 'Analyse de progression',    desc: 'Trend, 1RM estimé, volume, stagnation — tout est visible' },
            { icon: '🎯', title: 'Flows spécifiques',         desc: 'Haltéro, Hyrox, Fractionné — chaque sport a son UI' },
          ].map(f => (
            <div key={f.title} className="flex items-center gap-3 bg-[var(--bg)] rounded-xl px-4 py-3">
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-bold text-[var(--ink)]">{f.title}</p>
                <p className="text-xs text-[var(--sub)] leading-snug">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setStep(1)}
          className="w-full py-4 rounded-2xl text-white font-black text-base shadow-sm transition"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
          Commencer →
        </button>
        <p className="text-xs text-[var(--muted)] mt-3 text-center">Accès bêta gratuit · 2 min pour démarrer</p>
        {/* Escape hatch: a logged-in account with no profile lands here. Let them
            sign out and reconnect with the right account instead of being stuck. */}
        <button
          onClick={async () => { await supabase.auth.signOut(); router.replace('/auth') }}
          className="w-full mt-4 text-xs font-semibold text-[var(--muted)] underline">
          Ce n’est pas toi ? Se déconnecter et changer de compte
        </button>
      </div>
    </div>
  )

  // ── Step 1: Sports ───────────────────────────────────────
  if (step === 1) return (
    <div className="bg-[var(--card)] flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 px-6 pt-12 pb-8 max-w-sm mx-auto w-full">

        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[0,1,2,3].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i <= 0 ? '#F97316' : 'var(--border)' }} />
          ))}
        </div>

        <h2 className="text-2xl font-black text-[var(--ink)] mb-1">Tes sports</h2>
        <p className="text-sm text-[var(--muted)] mb-6">Sélectionne tout ce que tu pratiques. L'app adaptera les flows et suggestions.</p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {SPORTS.map(s => (
            <button key={s.id} onClick={() => toggleSport(s.id)}
              className={`p-4 rounded-2xl border text-left transition ${
                sports.includes(s.id)
                  ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)]'
                  : 'border-[color:var(--border)] bg-[var(--card)]'
              }`}>
              <div className="text-2xl mb-1.5">{s.icon}</div>
              <p className={`text-sm font-bold mb-0.5 ${sports.includes(s.id) ? 'text-[var(--accent-text)]' : 'text-[var(--ink)]'}`}>{s.label}</p>
              <p className="text-[11px] text-[var(--muted)] leading-snug">{s.desc}</p>
              {sports.includes(s.id) && (
                <div className="mt-2 flex items-center gap-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-orange-500 flex items-center justify-center">
                    <span className="text-[8px] text-white font-black">✓</span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep(0)}
            className="px-5 py-3.5 rounded-xl border border-[color:var(--border)] text-sm font-bold text-[var(--sub)]">
            ←
          </button>
          <button onClick={() => setStep(2)} disabled={sports.length === 0}
            className={`flex-1 py-3.5 rounded-xl text-white font-bold text-sm transition ${
              sports.length > 0 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-200 cursor-not-allowed'
            }`}>
            Suivant → {sports.length > 0 && `(${sports.length} sélectionné${sports.length > 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Step 2: Level + Goal ─────────────────────────────────
  if (step === 2) return (
    <div className="bg-[var(--card)] flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 px-6 pt-12 pb-8 max-w-sm mx-auto w-full">

        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[0,1,2,3].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i <= 1 ? '#F97316' : 'var(--border)' }} />
          ))}
        </div>

        <h2 className="text-2xl font-black text-[var(--ink)] mb-1">Niveau & Objectif</h2>
        <p className="text-sm text-[var(--muted)] mb-6">Pour personnaliser les recommandations de charge et les analytics.</p>

        <div className="mb-6">
          <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-3">Ton niveau actuel</p>
          <div className="space-y-2">
            {LEVELS.map(l => (
              <button key={l.id} onClick={() => setLevel(l.id)}
                className={`w-full p-4 rounded-xl border text-left flex items-center gap-3 transition ${
                  level === l.id ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)]' : 'border-[color:var(--border)] bg-[var(--card)]'
                }`}>
                <span className="text-2xl flex-shrink-0">{l.icon}</span>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${level === l.id ? 'text-[var(--accent-text)]' : 'text-[var(--ink)]'}`}>{l.label}</p>
                  <p className="text-xs text-[var(--muted)]">{l.desc}</p>
                </div>
                {level === l.id && <span className="text-[color:var(--theme-primary)] font-black">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-3">Objectif principal</p>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map(g => (
              <button key={g.id} onClick={() => setGoal(g.id)}
                className={`p-3 rounded-xl border text-left transition ${
                  goal === g.id ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)]' : 'border-[color:var(--border)] bg-[var(--card)]'
                }`}>
                <div className="text-xl mb-1">{g.icon}</div>
                <p className={`text-xs font-bold mb-0.5 ${goal === g.id ? 'text-[var(--accent-text)]' : 'text-[var(--ink)]'}`}>{g.label}</p>
                <p className="text-[10px] text-[var(--muted)] leading-snug">{g.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-3">Séances par semaine — {weekly}</p>
          <input type="range" min={1} max={7} step={1} value={weekly}
            onChange={e => setWeekly(parseInt(e.target.value))}
            className="w-full accent-[var(--theme-primary)] mb-1" />
          <div className="flex justify-between text-xs text-[var(--muted)]"><span>1×</span><span>7×</span></div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep(1)}
            className="px-5 py-3.5 rounded-xl border border-[color:var(--border)] text-sm font-bold text-[var(--sub)]">
            ←
          </button>
          <button onClick={() => setStep(3)} disabled={!level || !goal}
            className={`flex-1 py-3.5 rounded-xl text-white font-bold text-sm transition ${
              level && goal ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-200 cursor-not-allowed'
            }`}>
            Suivant →
          </button>
        </div>
      </div>
    </div>
  )

  // ── Step 3: Profil + Launch ──────────────────────────────
  return (
    <div className="bg-[var(--card)] flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 px-6 pt-12 pb-8 max-w-sm mx-auto w-full">

        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[0,1,2,3].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full" style={{ background: '#F97316' }} />
          ))}
        </div>

        <h2 className="text-2xl font-black text-[var(--ink)] mb-1">Dernière étape</h2>
        <p className="text-sm text-[var(--muted)] mb-6">Comment on t'appelle ?</p>

        <div className="bg-[var(--bg)] rounded-2xl p-5 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-2">
              Prénom <span className="text-[color:var(--theme-primary)]">*</span>
            </label>
            <input type="text" placeholder="Julien" value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleFinish()}
              className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-3 text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]"
              autoFocus />
          </div>
          {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}
        </div>

        {/* Recap */}
        <div className="bg-[var(--accent-soft)] border border-[color:var(--accent-soft)] rounded-2xl p-4 mb-8">
          <p className="text-xs font-bold text-[var(--accent-text)] uppercase tracking-wide mb-2">Récapitulatif</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <span>🎯</span>
              <span>{sports.map(s => SPORTS.find(x => x.id === s)?.label).join(', ')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <span>{LEVELS.find(l => l.id === level)?.icon}</span>
              <span>{LEVELS.find(l => l.id === level)?.label}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <span>{GOALS.find(g => g.id === goal)?.icon}</span>
              <span>{GOALS.find(g => g.id === goal)?.label}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <span>📅</span>
              <span>{weekly} séance{weekly > 1 ? 's' : ''} / semaine</span>
            </div>
          </div>
        </div>

        {/* Tour rapide */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Comment démarrer</p>
          <div className="space-y-2">
            {[
              { n: '1', text: 'Tape sur + Séance pour loguer ta première séance' },
              { n: '2', text: 'Photo du tableau → l\'IA remplit tout automatiquement' },
              { n: '3', text: 'Tes PRs se détectent automatiquement après chaque séance' },
              { n: '4', text: 'Dashboard → suis ta progression semaine par semaine' },
            ].map(t => (
              <div key={t.n} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{t.n}</span>
                <p className="text-xs text-blue-700 leading-snug">{t.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep(2)}
            className="px-5 py-3.5 rounded-xl border border-[color:var(--border)] text-sm font-bold text-[var(--sub)]">
            ←
          </button>
          <button onClick={handleFinish} disabled={saving || !name.trim()}
            className={`flex-1 py-4 rounded-2xl text-white font-black text-base transition ${
              saving || !name.trim() ? 'bg-orange-200 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'
            }`}>
            {saving ? 'Enregistrement...' : `C'est parti ${name.trim() ? name.trim() : ''} 🚀`}
          </button>
        </div>

      </div>
    </div>
  )
}
