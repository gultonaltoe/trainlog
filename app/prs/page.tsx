'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionUserId } from '@/lib/auth'
import { toast } from '@/lib/toast'
import MovementSearch from '@/components/MovementSearch'
import { BackButton, DatePicker } from '@/components/ui'

type PR = { id: string; movement_id: string; movement_name: string; value: number; unit: string; date: string }
type MovementPR = {
  key: string; movement_id: string; movement_name: string
  best: number; unit: string; date: string; count: number
}

type PRType = 'charge' | 'reps' | 'temps'
type Scheme = '1RM' | '3RM' | '5RM' | '10RM' | 'Max'

const SCHEMES: Scheme[] = ['1RM', '3RM', '5RM', '10RM', 'Max']

// ── Predefined movements ─────────────────────────────────
const PRESET_MOVEMENTS = [
  { label: 'Back Squat',   icon: '🏋️' },
  { label: 'Front Squat',  icon: '🏋️' },
  { label: 'Deadlift',     icon: '🏋️' },
  { label: 'Strict Press', icon: '🏋️' },
  { label: 'Push Press',   icon: '🏋️' },
  { label: 'Bench Press',  icon: '🏋️' },
  { label: 'Squat Clean',  icon: '🥇' },
  { label: 'Power Clean',  icon: '🥇' },
  { label: 'Clean & Jerk', icon: '🥇' },
  { label: 'Power Snatch', icon: '🥇' },
  { label: 'Squat Snatch', icon: '🥇' },
  { label: 'Jerk',         icon: '🥇' },
  { label: '5km',          icon: '🏃' },
  { label: '10km',         icon: '🏃' },
  { label: '2km Rowing',   icon: '🚣' },
  { label: '500m Rowing',  icon: '🚣' },
]

// ── Helpers ──────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0] }
function offsetStr(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function daysAgo(str: string) {
  const diff = Math.floor((Date.now() - new Date(str + 'T00:00:00').getTime()) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  if (diff < 30)  return `il y a ${diff}j`
  if (diff < 365) return `il y a ${Math.floor(diff / 30)} mois`
  return `il y a ${Math.floor(diff / 365)} an${Math.floor(diff / 365) > 1 ? 's' : ''}`
}

function formatValue(best: number, unit: string): string {
  if (unit === 'sec') {
    const m = Math.floor(best / 60), s = best % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${best}`
}

function unitLabel(unit: string): string {
  if (unit === 'sec')  return 'chrono'
  if (unit === 'reps') return 'reps'
  return 'kg'
}

function prRowLabel(p: MovementPR): string {
  if (p.unit === 'sec')  return `${p.movement_name} · Chrono`
  if (p.unit === 'reps') return `${p.movement_name} · Reps`
  return p.movement_name
}

const DATE_OPTIONS = [
  { label: "Aujourd'hui",   offset: 0  },
  { label: 'Hier',          offset: 1  },
  { label: 'Sem. dernière', offset: 7  },
  { label: 'Mois dernier',  offset: 30 },
]

export default function PRsPage() {
  const [prs, setPrs]         = useState<MovementPR[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [prType,   setPrType]   = useState<PRType>('charge')
  const [scheme,   setScheme]   = useState<Scheme>('1RM')
  const [movName,  setMovName]  = useState('')
  const [customMov,setCustomMov]= useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [value,    setValue]    = useState('')
  const [minutes,  setMinutes]  = useState('')
  const [seconds,  setSeconds]  = useState('')
  const [dateOffset, setDateOffset] = useState(0)
  const [customDate, setCustomDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [saving, setSaving]     = useState(false)

  const prDate = showDatePicker && customDate ? customDate : offsetStr(dateOffset)

  const loadPRs = async () => {
    const uid = await getSessionUserId()
    if (!uid) { setLoading(false); return }
    const { data } = await supabase.from('personal_records').select('*')
      .eq('user_id', uid).order('date', { ascending: false })
    if (!data?.length) { setLoading(false); return }
    const map: Record<string, MovementPR> = {}
    ;(data as PR[]).forEach(pr => {
      if (!pr.movement_name) return
      const key = (pr.movement_id ?? pr.movement_name) + '|' + (pr.unit ?? 'kg')
      if (!map[key] || pr.value > map[key].best) {
        map[key] = { key, movement_id: pr.movement_id, movement_name: pr.movement_name, best: pr.value, unit: pr.unit ?? 'kg', date: pr.date, count: 0 }
      }
      map[key].count++
    })
    setPrs(Object.values(map).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    setLoading(false)
  }

  useEffect(() => { loadPRs() }, [])

  const resetForm = () => {
    setPrType('charge'); setScheme('1RM')
    setMovName(''); setCustomMov(''); setIsCustom(false)
    setValue(''); setMinutes(''); setSeconds('')
    setDateOffset(0); setCustomDate(''); setShowDatePicker(false)
  }

  const openForm  = () => { resetForm(); setShowForm(true) }
  const closeForm = () => { setShowForm(false); resetForm() }

  const MOVEMENT_TYPE: Record<string, PRType> = {
    '5km': 'temps', '10km': 'temps',
    '2km Rowing': 'temps', '500m Rowing': 'temps',
  }
  const MOVEMENT_SCHEME: Record<string, Scheme> = {
    'Back Squat': '1RM', 'Front Squat': '1RM', 'Deadlift': '1RM',
    'Strict Press': '1RM', 'Push Press': '1RM', 'Bench Press': '1RM',
    'Squat Clean': '1RM', 'Power Clean': '1RM', 'Clean & Jerk': '1RM',
    'Power Snatch': '1RM', 'Squat Snatch': '1RM', 'Jerk': '1RM',
  }

  const selectPreset = (name: string) => {
    setMovName(name)
    setIsCustom(false)
    setCustomMov('')
    setPrType(MOVEMENT_TYPE[name] ?? 'charge')
    if (MOVEMENT_SCHEME[name]) setScheme(MOVEMENT_SCHEME[name])
  }

  const handleSave = async () => {
    const finalMov = isCustom ? customMov.trim() : movName
    if (!finalMov) { toast.error('Sélectionne ou tape un mouvement'); return }
    let numValue: number, unit: string

    if (prType === 'charge') {
      if (!value || isNaN(parseFloat(value))) { toast.error('Indique le poids en kg'); return }
      numValue = parseFloat(value)
      unit = 'kg'
    } else if (prType === 'reps') {
      if (!value || isNaN(parseInt(value))) { toast.error('Indique le nombre de répétitions'); return }
      numValue = parseInt(value)
      unit = 'reps'
    } else {
      const m = parseInt(minutes || '0'), s = parseInt(seconds || '0')
      if (m === 0 && s === 0) { toast.error('Indique le temps'); return }
      numValue = m * 60 + s
      unit = 'sec'
    }

    const storedName = prType === 'charge' && scheme !== '1RM'
      ? `${finalMov} (${scheme})`
      : finalMov

    const uid = await getSessionUserId()
    if (!uid) { toast.error('Session expirée, reconnecte-toi'); return }
    setSaving(true)
    const { error } = await supabase.from('personal_records').insert({
      movement_id:   null,
      movement_name: storedName,
      value:         numValue,
      unit,
      date:          prDate,
      session_id:    null,
      user_id:       uid,
    })
    setSaving(false)

    if (error) { toast.error('Erreur lors de l\'enregistrement'); return }
    toast.success('PR enregistré !')
    closeForm()
    setLoading(true)
    loadPRs()
  }

  const filtered  = prs.filter(p => !search || p.movement_name.toLowerCase().includes(search.toLowerCase()))
  const recentPRs = prs.filter(p => (Date.now() - new Date(p.date + 'T00:00:00').getTime()) / 86400000 <= 30)

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4">

        {/* Header */}
        <div className="pt-5"><BackButton /></div>
        <div className="pt-2 pb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">Personal Records</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">{prs.length} performance{prs.length > 1 ? 's' : ''} trackée{prs.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={openForm}
            className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm"
            style={{ background: 'var(--theme-primary, #F97316)' }}>
            <span className="text-lg leading-none">+</span> PR
          </button>
        </div>

        {/* PRs récents */}
        {recentPRs.length > 0 && (
          <div className="bg-[var(--accent-soft)] border border-[color:var(--accent-soft)] rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold text-[var(--accent-text)] uppercase tracking-wider mb-3">🏆 Ces 30 derniers jours</p>
            <div className="space-y-2.5">
              {recentPRs.slice(0, 5).map(p => (
                <Link key={p.key} href={`/prs/${encodeURIComponent(p.movement_id ?? p.movement_name)}`}
                  className="flex items-center justify-between hover:opacity-80">
                  <span className="text-sm font-semibold text-[var(--ink)] truncate pr-2">{prRowLabel(p)}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-base font-black text-[var(--accent-text)]">{formatValue(p.best, p.unit)}</span>
                    <span className="text-xs text-[var(--muted)]">{unitLabel(p.unit)}</span>
                    <span className="text-xs text-[var(--border-strong)]">{daysAgo(p.date)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recherche */}
        <input type="text" placeholder="Rechercher un mouvement..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)] mb-4" />

        {/* Liste */}
        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏋️</p>
            <p className="text-sm font-semibold text-[var(--ink-soft)] mb-1">{search ? 'Aucun mouvement trouvé' : 'Aucun PR enregistré'}</p>
            <p className="text-xs text-[var(--muted)] mb-4">
              {!search && 'Ajoute ton premier PR ou log une séance avec des charges.'}
            </p>
            {!search && (
              <button onClick={openForm}
                className="inline-block text-white text-sm font-bold px-5 py-2.5 rounded-xl"
                style={{ background: 'var(--theme-primary, #F97316)' }}>
                + Ajouter un PR
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <Link key={p.key} href={`/prs/${encodeURIComponent(p.movement_id ?? p.movement_name)}`}
                className="flex items-center gap-3 bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 hover:border-[color:var(--border-strong)] hover:shadow-sm transition">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center flex-shrink-0 text-lg">
                  {p.unit === 'sec' ? '⏱️' : p.unit === 'reps' ? '🔢' : '🏋️'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--ink)] truncate">{prRowLabel(p)}</p>
                  <p className="text-xs text-[var(--muted)]">{p.count} entrée{p.count > 1 ? 's' : ''} · {daysAgo(p.date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-black text-[var(--ink)]">
                    {formatValue(p.best, p.unit)} <span className="text-xs font-semibold text-[var(--muted)]">{unitLabel(p.unit)}</span>
                  </p>
                </div>
                <span className="text-[var(--border-strong)] ml-1">›</span>
              </Link>
            ))}
          </div>
        )}
        <div className="h-6" />
      </div>

      {/* ── Bottom sheet formulaire ───────────────────────── */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeForm} />

          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)] rounded-t-3xl px-5 pt-4"
            style={{ maxHeight: '92dvh', overflowY: 'auto', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>

            <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-[var(--ink)]">Ajouter un PR</h2>
              <button onClick={closeForm} className="text-[var(--muted)] hover:text-[var(--ink-soft)] text-2xl leading-none">×</button>
            </div>

            {/* ① Type */}
            <div className="mb-5">
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Type</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'charge', icon: '🏋️', label: 'Charge' },
                  { v: 'reps',   icon: '🔢', label: 'Reps max' },
                  { v: 'temps',  icon: '⏱️', label: 'Temps' },
                ] as { v: PRType; icon: string; label: string }[]).map(t => (
                  <button key={t.v} onClick={() => setPrType(t.v)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition ${
                      prType === t.v ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)]' : 'border-[color:var(--border)] bg-[var(--card)]'
                    }`}>
                    <span className="text-xl">{t.icon}</span>
                    <span className={`text-[11px] font-bold ${prType === t.v ? 'text-[var(--accent-text)]' : 'text-[var(--sub)]'}`}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ② Mouvement — grille */}
            <div className="mb-5">
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Mouvement</p>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {PRESET_MOVEMENTS.map(m => {
                  const sel = !isCustom && movName === m.label
                  return (
                    <button key={m.label} onClick={() => selectPreset(m.label)}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-semibold transition text-center leading-tight ${
                        sel
                          ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)] hover:border-[color:var(--border-strong)]'
                      }`}>
                      <span className="block text-base mb-0.5">{m.icon}</span>
                      {m.label}
                    </button>
                  )
                })}

                {/* Autre */}
                <button onClick={() => { setIsCustom(true); setMovName('') }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-semibold transition text-center leading-tight ${
                    isCustom
                      ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'border-dashed border-[color:var(--border-strong)] bg-[var(--card)] text-[var(--muted)]'
                  }`}>
                  <span className="block text-base mb-0.5">✏️</span>
                  Autre
                </button>
              </div>

              {isCustom && (
                <MovementSearch
                  value={customMov}
                  onChange={m => {
                    setCustomMov(m.name)
                    setPrType(MOVEMENT_TYPE[m.name] ?? 'charge')
                    if (MOVEMENT_SCHEME[m.name]) setScheme(MOVEMENT_SCHEME[m.name])
                  }}
                />
              )}

              {/* Selected label */}
              {(movName || (isCustom && customMov)) && (
                <p className="text-xs text-[color:var(--theme-primary)] font-semibold mt-2">
                  ✓ {isCustom ? customMov : movName}
                </p>
              )}
            </div>

            {/* ③ Schéma (charge uniquement) */}
            {prType === 'charge' && (
              <div className="mb-5">
                <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Schéma</p>
                <div className="flex gap-2">
                  {SCHEMES.map(s => (
                    <button key={s} onClick={() => setScheme(s)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition ${
                        scheme === s ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border)] text-[var(--sub)]'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ④ Performance */}
            <div className="mb-5">
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
                {prType === 'charge' ? `Poids — ${scheme}` : prType === 'reps' ? 'Répétitions' : 'Temps'}
              </p>
              {prType === 'temps' ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)}
                      placeholder="00" min="0"
                      className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-3 text-3xl font-black text-center text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                    <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-[var(--muted)] font-medium">min</span>
                  </div>
                  <span className="text-2xl font-black text-[var(--muted)] pb-4">:</span>
                  <div className="flex-1 relative">
                    <input type="number" value={seconds} onChange={e => setSeconds(e.target.value)}
                      placeholder="00" min="0" max="59"
                      className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-3 text-3xl font-black text-center text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                    <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-[var(--muted)] font-medium">sec</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <input type="number" value={value} onChange={e => setValue(e.target.value)}
                    placeholder="0" min="0" step={prType === 'charge' ? '0.5' : '1'}
                    className="flex-1 rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-4 text-3xl font-black text-center text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                  <span className="text-lg font-bold text-[var(--muted)] w-10">{prType === 'charge' ? 'kg' : 'reps'}</span>
                </div>
              )}
            </div>

            {/* ⑤ Date — chips */}
            <div className="mb-6">
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Date</p>
              <div className="flex gap-2 mb-2">
                {DATE_OPTIONS.map(opt => {
                  const active = !showDatePicker && dateOffset === opt.offset
                  return (
                    <button key={opt.offset}
                      onClick={() => { setDateOffset(opt.offset); setShowDatePicker(false); setCustomDate('') }}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition ${
                        active ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--sub)]'
                      }`}>
                      {opt.label}
                    </button>
                  )
                })}
                <button
                  onClick={() => setShowDatePicker(v => !v)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition ${
                    showDatePicker ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--sub)]'
                  }`}>
                  Autre
                </button>
              </div>
              {showDatePicker && (
                <DatePicker value={customDate || offsetStr(dateOffset)}
                  onChange={v => setCustomDate(v > todayStr() ? todayStr() : v)} />
              )}
              <p className="text-xs text-[var(--muted)] mt-1.5">
                {showDatePicker && customDate
                  ? new Date(customDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                  : new Date(prDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                }
              </p>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full py-4 rounded-2xl text-white font-black text-base transition disabled:opacity-50"
              style={{ background: 'var(--theme-primary, #F97316)' }}>
              {saving ? 'Enregistrement…' : 'Enregistrer le PR'}
            </button>

          </div>
        </>
      )}
    </div>
  )
}
