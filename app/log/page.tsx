'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getSessionTypes, saveSession, getProfile } from '@/lib/api'
import type { SessionType, PainEntry } from '@/lib/api'
import { toast } from '@/lib/toast'
import MovementSearch from '@/components/MovementSearch'

// ── Types ─────────────────────────────────────────────────
type SetRow    = { reps: string; weight: string }
type PrepBlock = { id: number; kind: 'block'; movementId: string; movementLabel: string; hasWeight: boolean; sets: SetRow[] }
type PrepNote  = { id: number; kind: 'note';  text: string }
type PrepItem  = PrepBlock | PrepNote

const mkBlock = (id: number): PrepBlock => ({ id, kind: 'block', movementId: '', movementLabel: '', hasWeight: true, sets: [{ reps: '', weight: '' }] })
const mkNote  = (id: number): PrepNote  => ({ id, kind: 'note',  text: '' })

// ── Constantes ────────────────────────────────────────────
const WOD_FORMATS    = ['AMRAP','EMOM','E2MOM','For Time','Tabata',"Every X'",'Rounds','Autre']
const TIMED_FORMATS  = ['AMRAP','EMOM','E2MOM',"Every X'",'Tabata']
const DURATION_CHIPS = [8,10,12,15,20,25]
const COMMON_MOVES   = ['Thrusters','Pull-ups','Box Jump','Double Unders','TTB','HSPU','Burpees','Row Cal','Ski Cal','Wall Ball','Power Clean','Deadlift']
const NO_WEIGHT_CATS = ['gymnastics','cardio','skill']
const RUN_TYPES      = ['Endurance','Tempo','Fractionné','Récupération','Compétition']
const RUN_SURFACES   = ['Route','Trail','Piste','Tapis']
const PAIN_PARTS     = ['Épaule G','Épaule D','Poignet G','Poignet D','Coude G','Coude D','Avant-bras G','Avant-bras D','Genou G','Genou D','Hanche G','Hanche D','Bas du dos','Lombaires','Cheville G','Cheville D','Cou','Quad G','Quad D','Ischio G','Ischio D']
const SEVERITY       = [
  { v: 1 as const, l: 'Légère',  cls: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
  { v: 2 as const, l: 'Modérée', cls: 'border-orange-300 bg-orange-50 text-orange-700' },
  { v: 3 as const, l: 'Forte',   cls: 'border-red-300 bg-red-50 text-red-700'          },
]
const SEV_PILL   = ['','bg-yellow-100 text-yellow-700','bg-orange-100 text-orange-700','bg-red-100 text-red-700']
const RPE_COLORS = ['#3B82F6','#3B82F6','#3B82F6','#F59E0B','#F59E0B','#D97706','#EA580C','#EA580C','#EF4444','#DC2626']
const RPE_LABELS = ['','Très facile','Facile','Un peu dur','Modéré','Modéré+','Dur','Très dur','Intense','Extrême','Maximum']

const STEPS_DEFAULT = [
  { label: 'Date & Sommeil',  key: 'sleep'    },
  { label: 'Type de séance',  key: 'type'     },
  { label: 'Séance',          key: 'strength' },
  { label: 'WOD',             key: 'wod'      },
  { label: 'Post-séance',     key: 'post'     },
]
const STEPS_RUN = [
  { label: 'Date & Sommeil', key: 'sleep' },
  { label: 'Type de séance', key: 'type'  },
  { label: 'Détails du run', key: 'run'   },
  { label: 'Post-séance',    key: 'post'  },
]
const SPORT_MAP: Record<string, string[]> = {
  'crossfit':      ['crossfit','team wod','technique'],
  'haltérophilie': ['haltéro','technique'],
  'run':           ['run','endurance'],
  'renfo':         ['renfo'],
  'endurance':     ['endurance'],
  'hyrox':         ['hyrox','endurance','renfo'],
  'natation':      ['endurance'],
  'vélo':          ['endurance'],
}

function validate(step: number, data: { date: string; typeId: string }): string | null {
  if (step === 0 && !data.date)   return 'La date est obligatoire.'
  if (step === 1 && !data.typeId) return 'Sélectionne un type de séance.'
  return null
}

async function compressImage(file: File, maxPx: number): Promise<string> {
  const toBase64 = (): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) { toBase64().then(resolve); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        if (!dataUrl || dataUrl.length < 200) { toBase64().then(resolve); return }
        resolve(dataUrl.split(',')[1])
      } catch { toBase64().then(resolve) }
    }
    img.onerror = () => toBase64().then(resolve)
    img.src = URL.createObjectURL(file)
  })
}

const inputCls = "w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2"

// ── Composant principal ────────────────────────────────────
export default function LogPage() {
  const [step, setStep]               = useState(0)
  const [error, setError]             = useState<string | null>(null)
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [savedId, setSavedId]         = useState('')

  // Step 0
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0])
  const [sleepHours, setSleepHours] = useState(7)
  const [energy, setEnergy]         = useState(3)

  // Step 1
  const [typeId, setTypeId]     = useState('')
  const [duration, setDuration] = useState('')

  // Step 2 — Séance
  const [warmupNotes, setWarmupNotes] = useState('')
  const [prepItems, setPrepItems]     = useState<PrepItem[]>([mkBlock(1)])
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Step 2 — Run
  const [runType, setRunType]           = useState('')
  const [runDistance, setRunDistance]   = useState('')
  const [runElevation, setRunElevation] = useState('')
  const [runSurface, setRunSurface]     = useState('')

  // Step 3 — WOD
  const [hasWod, setHasWod]         = useState(true)
  const [wodFormat, setWodFormat]   = useState('')
  const [wodTimeCap, setWodTimeCap] = useState('')
  const [wodMoves, setWodMoves]     = useState<string[]>([''])
  const [wodFreeMode, setWodFreeMode] = useState(false)
  const [wodDesc, setWodDesc]       = useState('')
  const [wodResult, setWodResult]   = useState('')
  const [wodRx, setWodRx]           = useState(true)

  // Step 4 — Post
  const [rpe, setRpe]                 = useState(7)
  const [showRpeInfo, setShowRpeInfo] = useState(false)
  const [feeling, setFeeling]         = useState(3)
  const [painEntries, setPainEntries] = useState<PainEntry[]>([])
  const [addingPain, setAddingPain]   = useState(false)
  const [painPart, setPainPart]       = useState('')
  const [painSev, setPainSev]         = useState<1|2|3>(1)
  const [notes, setNotes]             = useState('')

  useEffect(() => {
    Promise.all([getSessionTypes(), getProfile()]).then(([types, prof]) => {
      let filtered = types
      if (prof?.sports && prof.sports.length > 0) {
        const allowed = new Set<string>()
        prof.sports.forEach(sport => {
          const mapped = SPORT_MAP[sport.toLowerCase()] || [sport.toLowerCase()]
          mapped.forEach(t => allowed.add(t))
        })
        filtered = types.filter(t => allowed.has(t.name.toLowerCase()))
      }
      setSessionTypes(filtered)
      setLoading(false)
    })
  }, [])

  const isRun  = sessionTypes.find(t => t.id === typeId)?.name === 'Run'
  const STEPS  = isRun ? STEPS_RUN : STEPS_DEFAULT
  const curKey = STEPS[step]?.key

  const paceMinkm = (duration && runDistance && parseFloat(runDistance) > 0)
    ? parseInt(duration) / parseFloat(runDistance) : null
  const paceStr = paceMinkm
    ? `${Math.floor(paceMinkm)}'${String(Math.round((paceMinkm % 1) * 60)).padStart(2,'0')}"/km`
    : null

  const goNext = () => {
    const err = validate(step, { date, typeId })
    if (err) { setError(err); return }
    setError(null); setStep(s => s + 1)
  }
  const goBack = () => { setError(null); setStep(s => s - 1) }

  // ── PrepItems helpers ───────────────────────────────────
  const updBlock = (id: number, field: Partial<PrepBlock>) =>
    setPrepItems(ps => ps.map(p => p.id === id && p.kind === 'block' ? { ...p, ...field } : p))
  const updSet = (blockId: number, si: number, field: Partial<SetRow>) =>
    setPrepItems(ps => ps.map(p => {
      if (p.id !== blockId || p.kind !== 'block') return p
      return { ...p, sets: p.sets.map((s, i) => i === si ? { ...s, ...field } : s) }
    }))
  const removeItem = (id: number) => setPrepItems(ps => ps.filter(p => p.id !== id))

  // ── Photo ───────────────────────────────────────────────
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    setAnalyzingPhoto(true)
    try {
      const base64 = await compressImage(file, 800)
      const resp = await fetch('/api/analyze-wod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' })
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      if (data.error) throw new Error(data.error)

      const filled: string[] = []
      if (data.warmup) { setWarmupNotes(data.warmup); filled.push('échauffement') }
      if (data.strength_notes) {
        const noteId = Date.now()
        setPrepItems(ps => [{ id: noteId, kind: 'note' as const, text: data.strength_notes }, ...ps])
        filled.push('skill/force')
      }
      if (data.format) { setHasWod(true); setWodFormat(data.format) }
      if (data.time_cap) { setWodTimeCap(String(data.time_cap)) }
      if (data.description) {
        const moves = data.description.split('\n').filter(Boolean)
        if (moves.length > 1) setWodMoves(moves)
        else { setWodDesc(data.description); setWodFreeMode(true) }
        filled.push('WOD')
      }
      toast.success(filled.length > 0 ? `Tableau analysé ✓ — ${filled.join(', ')}` : 'Photo analysée ✓')
    } catch (err) {
      console.error('Photo error:', err)
      toast.error('Analyse échouée. Essaie une photo plus nette.')
      setPhotoPreview(null)
    } finally {
      setAnalyzingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  // ── WOD description ─────────────────────────────────────
  const buildWodDescription = () => {
    const moves = wodMoves.filter(m => m.trim())
    if (!moves.length) return undefined
    const header = wodTimeCap ? `${wodFormat} ${wodTimeCap}'\n` : ''
    return header + moves.join('\n')
  }

  // ── Pain ────────────────────────────────────────────────
  const addPain = () => {
    if (!painPart.trim()) return
    setPainEntries(ps => [...ps, { label: painPart.trim(), severity: painSev }])
    setPainPart(''); setPainSev(1); setAddingPain(false)
  }

  // ── Reset ───────────────────────────────────────────────
  const reset = () => {
    setSavedId(''); setStep(0); setError(null)
    setDate(new Date().toISOString().split('T')[0])
    setSleepHours(7); setEnergy(3); setTypeId(''); setDuration('')
    setWarmupNotes(''); setPrepItems([mkBlock(Date.now())]); setPhotoPreview(null)
    setRunType(''); setRunDistance(''); setRunElevation(''); setRunSurface('')
    setHasWod(true); setWodFormat(''); setWodTimeCap(''); setWodMoves([''])
    setWodFreeMode(false); setWodDesc(''); setWodResult(''); setWodRx(true)
    setRpe(7); setFeeling(3); setPainEntries([]); setNotes(''); setShowRpeInfo(false)
  }

  // ── Submit ──────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true)
    try {
      const skillLines = prepItems
        .filter((p): p is PrepNote => p.kind === 'note' && !!p.text.trim())
        .map(p => p.text.trim())

      const allNotes = [
        warmupNotes ? `Échauffement: ${warmupNotes}` : '',
        ...skillLines.map(l => `Skill/Force: ${l}`),
        notes,
      ].filter(Boolean).join('\n') || undefined

      const wodDescription = wodFreeMode ? (wodDesc || undefined) : buildWodDescription()

      const id = await saveSession({
        date, session_type_id: typeId,
        duration_min:  duration ? parseInt(duration) : undefined,
        sleep_hours:   sleepHours, energy_level: energy,
        rpe, feeling_post: feeling, notes: allNotes,
        blocks: isRun ? [] : prepItems
          .filter((p): p is PrepBlock => p.kind === 'block' && !!p.movementId)
          .map(b => ({
            movement_id: b.movementId, movement_label: b.movementLabel,
            block_type: 'strength' as const,
            sets: b.sets.filter(s => s.reps || s.weight).map(s => ({
              reps:      s.reps   ? parseInt(s.reps)              : undefined,
              weight_kg: s.weight && b.hasWeight ? parseFloat(s.weight) : undefined,
            }))
          })),
        wod: !isRun && hasWod && wodFormat ? {
          format_label:  wodFormat,
          time_cap:      wodTimeCap ? parseInt(wodTimeCap) : undefined,
          description:   wodDescription,
          result_detail: wodResult || undefined,
          is_rx:         wodRx,
        } : undefined,
        pain_entries: painEntries.length > 0 ? painEntries : undefined,
        meta: isRun ? {
          run_type:    runType    || undefined,
          distance_km: runDistance  ? parseFloat(runDistance)  : undefined,
          elevation_m: runElevation ? parseInt(runElevation)   : undefined,
          surface:     runSurface   || undefined,
          pace_min_km: paceMinkm    ? parseFloat(paceMinkm.toFixed(2)) : undefined,
        } : undefined,
      })
      toast.success('Séance enregistrée ! 🎉')
      setSavedId(id)
    } catch (e) { console.error(e); toast.error('Erreur lors de la sauvegarde.') }
    finally { setSaving(false) }
  }

  // ── Loading ─────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400 text-sm">Chargement...</p>
    </div>
  )

  // ── Confirmation ─────────────────────────────────────────
  if (savedId) {
    const t = sessionTypes.find(t => t.id === typeId)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2">Séance enregistrée !</h2>
          <p className="text-gray-500 text-sm mb-1">{t?.emoji} {t?.name}</p>
          <p className="text-gray-400 text-sm mb-6">{date}{duration ? ` · ${duration} min` : ''}{isRun && runDistance ? ` · ${runDistance} km` : ''}</p>
          <div className="flex gap-3">
            <Link href="/" className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold text-center">← Dashboard</Link>
            <button onClick={reset} className="flex-1 text-white rounded-xl py-3 font-bold text-sm" style={{ background: 'var(--theme-primary, #F97316)' }}>+ Nouvelle</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulaire ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4">

        {/* Top bar */}
        <div className="flex items-center justify-between pt-5 pb-4 border-b border-gray-100">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition">← Dashboard</Link>
          <span className="text-sm font-bold text-gray-700">Nouvelle séance</span>
          <div className="w-24" />
        </div>

        {/* Progress */}
        <div className="pt-4 pb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-gray-700">{STEPS[step].label}</span>
            <span className="text-sm text-gray-400">{step + 1} / {STEPS.length}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--theme-primary, #F97316)' }} />
          </div>
        </div>

        {/* ══ SLEEP ══════════════════════════════════════ */}
        {curKey === 'sleep' && (
          <div className="space-y-6">
            <div>
              <label className={labelCls}>Date <span className="text-orange-400">*</span></label>
              <input type="date" value={date} onChange={e => { setDate(e.target.value); setError(null) }}
                className="rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className={labelCls}>Sommeil — {sleepHours}h</label>
              <input type="range" min="2" max="12" step="0.5" value={sleepHours}
                onChange={e => setSleepHours(parseFloat(e.target.value))} className="w-full accent-orange-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>2h</span><span>12h</span></div>
            </div>
            <div>
              <label className={labelCls}>Énergie avant séance</label>
              <div className="flex gap-2">
                {[{v:1,l:'💤'},{v:2,l:'😪'},{v:3,l:'😐'},{v:4,l:'⚡'},{v:5,l:'🔥'}].map(o => (
                  <button key={o.v} onClick={() => setEnergy(o.v)}
                    className={`flex-1 py-2.5 rounded-xl border text-xl transition ${energy === o.v ? 'border-orange-400 bg-orange-50' : 'border-gray-300 bg-white'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ TYPE ═══════════════════════════════════════ */}
        {curKey === 'type' && (
          <div className="space-y-6">
            <div>
              <label className={labelCls}>Type de séance <span className="text-orange-400">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {sessionTypes.map(t => (
                  <button key={t.id} onClick={() => { setTypeId(t.id); setError(null) }}
                    className={`p-3 rounded-xl border text-xs font-medium transition flex flex-col items-center gap-1 ${typeId === t.id ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-300 bg-white text-gray-600'}`}>
                    <span className="text-xl">{t.emoji}</span>{t.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Durée (min) — optionnel</label>
              <input type="number" placeholder="ex: 75" value={duration} onChange={e => setDuration(e.target.value)}
                className="w-28 rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
        )}

        {/* ══ RUN ════════════════════════════════════════ */}
        {curKey === 'run' && (
          <div className="space-y-6">
            <div>
              <label className={labelCls}>Type de sortie</label>
              <div className="flex flex-wrap gap-2">
                {RUN_TYPES.map(t => (
                  <button key={t} onClick={() => setRunType(t)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition ${runType === t ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-300 bg-white text-gray-600'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Distance (km)</label>
                <input type="number" step="0.1" placeholder="ex: 10" value={runDistance} onChange={e => setRunDistance(e.target.value)}
                  className="w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className={labelCls}>Dénivelé+ (m)</label>
                <input type="number" placeholder="ex: 250" value={runElevation} onChange={e => setRunElevation(e.target.value)}
                  className="w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>
            {paceStr && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <span className="text-2xl">⏱️</span>
                <div><p className="text-xs font-bold text-green-700 uppercase tracking-wide">Allure calculée</p>
                <p className="text-xl font-bold text-green-600">{paceStr}</p></div>
              </div>
            )}
            <div>
              <label className={labelCls}>Surface</label>
              <div className="flex gap-2">
                {RUN_SURFACES.map(s => (
                  <button key={s} onClick={() => setRunSurface(s)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${runSurface === s ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-300 bg-white text-gray-600'}`}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ STRENGTH / SÉANCE ══════════════════════════ */}
        {curKey === 'strength' && (
          <div className="space-y-4">

            {/* ── Photo ── */}
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Tableau" className="w-full max-h-44 object-cover" />
                {analyzingPhoto && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center gap-2">
                    <span className="animate-spin text-xl">⏳</span>
                    <span className="text-sm font-semibold text-gray-700">Analyse en cours...</span>
                  </div>
                )}
                {!analyzingPhoto && (
                  <button onClick={() => { setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = '' }}
                    className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-red-400 transition text-sm">×</button>
                )}
              </div>
            ) : (
              <button onClick={() => photoInputRef.current?.click()} disabled={analyzingPhoto}
                className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition text-white shadow-md"
                style={{ background: analyzingPhoto ? '#FED7AA' : 'linear-gradient(135deg, #F97316, #EA580C)' }}>
                <span className="text-2xl">📷</span>
                <div className="text-left">
                  <p className="text-sm font-black">Analyser le tableau</p>
                  <p className="text-xs font-normal opacity-80">Pré-remplit warm-up, skill et WOD automatiquement</p>
                </div>
              </button>
            )}

            {/* ── Échauffement ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold text-gray-700">Échauffement</span>
                </div>
                <span className="text-xs text-gray-400">optionnel</span>
              </div>
              <textarea rows={2} value={warmupNotes} onChange={e => setWarmupNotes(e.target.value)}
                placeholder="Ex: EMOM 6' — 1' Dead Hang / 2' Air Squat / 3' Echo Bike..."
                className={inputCls + ' resize-none'} />
            </div>

            {/* ── Préparation (notes + blocs) ── */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Préparation technique & Force — optionnel</p>
              <div className="space-y-3">
                {prepItems.map((item, idx) => item.kind === 'note' ? (
                  /* ─ Note libre ─ */
                  <div key={item.id} className="bg-white rounded-2xl border border-blue-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🎯</span>
                      <span className="text-sm font-bold text-gray-700 flex-1">Note technique</span>
                      <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 text-xl leading-none">×</button>
                    </div>
                    <textarea rows={2} value={item.text}
                      onChange={e => setPrepItems(ps => ps.map(p => p.id === item.id ? { ...p, text: e.target.value } : p))}
                      placeholder="Ex: Snatch technique — focus position basse, Every 3' x 4..."
                      className={inputCls + ' resize-none'} autoFocus={idx === prepItems.length - 1 && item.text === ''} />
                  </div>
                ) : (
                  /* ─ Bloc force ─ */
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-md bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {prepItems.filter(p => p.kind === 'block').indexOf(item as PrepBlock) + 1}
                      </span>
                      <span className="text-sm font-bold text-gray-700 flex-1">{(item as PrepBlock).movementLabel || 'Mouvement'}</span>
                      {prepItems.length > 1 && (
                        <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 text-xl leading-none">×</button>
                      )}
                    </div>
                    <div className="mb-3">
                      <MovementSearch value={(item as PrepBlock).movementLabel}
                        onChange={m => updBlock(item.id, { movementId: m.id, movementLabel: m.name, hasWeight: !NO_WEIGHT_CATS.includes(m.category) })} />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => updBlock(item.id, { hasWeight: !(item as PrepBlock).hasWeight })}
                        className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${(item as PrepBlock).hasWeight ? 'bg-orange-500' : 'bg-gray-200'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${(item as PrepBlock).hasWeight ? 'left-4' : 'left-0.5'}`} />
                      </button>
                      <span className="text-xs text-gray-500">{(item as PrepBlock).hasWeight ? 'Avec poids (kg)' : 'Reps uniquement'}</span>
                    </div>
                    <div className={`grid gap-2 text-xs text-gray-400 uppercase font-semibold px-0.5 mb-1.5 ${(item as PrepBlock).hasWeight ? 'grid-cols-[20px_1fr_1fr_24px]' : 'grid-cols-[20px_1fr_24px]'}`}>
                      <span/><span>Reps</span>{(item as PrepBlock).hasWeight && <span>Poids kg</span>}<span/>
                    </div>
                    {(item as PrepBlock).sets.map((set, si) => (
                      <div key={si} className={`grid gap-2 mb-1.5 items-center ${(item as PrepBlock).hasWeight ? 'grid-cols-[20px_1fr_1fr_24px]' : 'grid-cols-[20px_1fr_24px]'}`}>
                        <span className="text-xs text-gray-300 font-bold text-center">S{si+1}</span>
                        <input type="number" placeholder="—" value={set.reps}
                          onChange={e => updSet(item.id, si, { reps: e.target.value })}
                          className="rounded-lg border border-gray-400 px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        {(item as PrepBlock).hasWeight && (
                          <input type="number" placeholder="—" value={set.weight}
                            onChange={e => updSet(item.id, si, { weight: e.target.value })}
                            className="rounded-lg border border-gray-400 px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        )}
                        <button onClick={() => {
                          if ((item as PrepBlock).sets.length > 1)
                            updBlock(item.id, { sets: (item as PrepBlock).sets.filter((_, i) => i !== si) })
                        }} className="text-gray-300 hover:text-gray-500 text-base text-center">×</button>
                      </div>
                    ))}
                    <button onClick={() => updBlock(item.id, { sets: [...(item as PrepBlock).sets, { reps: '', weight: '' }] })}
                      className="w-full mt-2 py-1.5 text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg hover:border-orange-300 hover:text-orange-400 transition">
                      + Série
                    </button>
                  </div>
                ))}
              </div>

              {/* Boutons d'ajout */}
              <div className="flex gap-2 mt-3">
                <button onClick={() => setPrepItems(ps => [...ps, mkNote(Date.now())])}
                  className="flex-1 py-2.5 border-2 border-dashed border-blue-200 text-blue-400 rounded-xl text-xs font-bold hover:border-blue-400 transition flex items-center justify-center gap-1">
                  <span>🎯</span> Note technique
                </button>
                <button onClick={() => setPrepItems(ps => [...ps, mkBlock(Date.now())])}
                  className="flex-1 py-2.5 border-2 border-dashed border-orange-200 text-orange-400 rounded-xl text-xs font-bold hover:border-orange-400 transition flex items-center justify-center gap-1">
                  <span>🏋️</span> Bloc force
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ WOD ════════════════════════════════════════ */}
        {curKey === 'wod' && (
          <div className="space-y-5">
            {/* Toggle WOD */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-gray-800">WOD aujourd&apos;hui ?</p>
                <p className="text-xs text-gray-400 mt-0.5">Conditioning, partie métabolique</p>
              </div>
              <button onClick={() => setHasWod(v => !v)}
                className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${hasWod ? 'bg-orange-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${hasWod ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {hasWod && (
              <>
                {/* Format */}
                <div>
                  <label className={labelCls}>Format</label>
                  <div className="flex flex-wrap gap-2">
                    {WOD_FORMATS.map(f => (
                      <button key={f} onClick={() => setWodFormat(f)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${wodFormat === f ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-300 bg-white text-gray-600'}`}>{f}</button>
                    ))}
                  </div>
                </div>

                {/* Durée (si format timed) */}
                {TIMED_FORMATS.includes(wodFormat) && (
                  <div>
                    <label className={labelCls}>Durée</label>
                    <div className="flex flex-wrap gap-2">
                      {DURATION_CHIPS.map(d => (
                        <button key={d} onClick={() => setWodTimeCap(String(d))}
                          className={`px-3 py-2 rounded-xl border font-bold text-sm transition ${wodTimeCap === String(d) ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 bg-white text-gray-600'}`}>
                          {d}&apos;
                        </button>
                      ))}
                      <input type="number" placeholder="autre" value={DURATION_CHIPS.includes(parseInt(wodTimeCap)) ? '' : wodTimeCap}
                        onChange={e => setWodTimeCap(e.target.value)}
                        className="w-20 rounded-xl border border-gray-400 bg-white px-2 py-2 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                  </div>
                )}

                {/* Mouvements — mode guidé ou libre */}
                {wodFreeMode ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={labelCls + ' mb-0'}>Description</label>
                      <button onClick={() => setWodFreeMode(false)} className="text-xs text-orange-500 font-semibold">← Mode guidé</button>
                    </div>
                    <textarea rows={5} value={wodDesc} onChange={e => setWodDesc(e.target.value)}
                      placeholder="Ex: 4 rounds — 10 Thrusters 43kg / 10 TTB / 20 DU..."
                      className={inputCls + ' resize-none'} />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={labelCls + ' mb-0'}>Mouvements</label>
                      <button onClick={() => setWodFreeMode(true)} className="text-xs text-orange-500 font-semibold">Saisie libre →</button>
                    </div>

                    {/* Chips suggestions */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {COMMON_MOVES.map(m => (
                        <button key={m} onClick={() => {
                          const lastEmpty = wodMoves.findIndex(mv => !mv.trim())
                          if (lastEmpty >= 0) {
                            setWodMoves(ms => ms.map((mv, i) => i === lastEmpty ? m : mv))
                          } else {
                            setWodMoves(ms => [...ms, m])
                          }
                        }}
                          className="px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-500 hover:border-orange-300 hover:text-orange-500 transition">
                          {m}
                        </button>
                      ))}
                    </div>

                    {/* Liste des mouvements */}
                    <div className="space-y-2">
                      {wodMoves.map((move, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-gray-300 font-bold w-5 text-center">{i + 1}</span>
                          <input type="text" value={move}
                            onChange={e => setWodMoves(ms => ms.map((m, j) => j === i ? e.target.value : m))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); setWodMoves(ms => [...ms, '']) }
                            }}
                            placeholder="Ex: 15 Thrusters 43kg"
                            className="flex-1 rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                          {wodMoves.length > 1 && (
                            <button onClick={() => setWodMoves(ms => ms.filter((_, j) => j !== i))}
                              className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0">×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setWodMoves(ms => [...ms, ''])}
                      className="w-full mt-2 py-2 text-xs text-gray-400 border border-dashed border-gray-300 rounded-xl hover:border-orange-300 hover:text-orange-400 transition">
                      + Mouvement
                    </button>
                  </div>
                )}

                {/* Résultat + RX */}
                <div>
                  <label className={labelCls}>Résultat / Score</label>
                  <input type="text" value={wodResult} onChange={e => setWodResult(e.target.value)}
                    placeholder="Ex: 4+12, 12'35, 187 reps..." className={inputCls} />
                </div>
                <div className="flex gap-2">
                  {[{v:true,l:'RX',a:'border-green-400 bg-green-50 text-green-700'},{v:false,l:'Scaled',a:'border-amber-400 bg-amber-50 text-amber-700'}].map(o => (
                    <button key={o.l} onClick={() => setWodRx(o.v)}
                      className={`flex-1 py-2.5 rounded-xl border font-bold text-sm transition ${wodRx === o.v ? o.a : 'border-gray-300 bg-white text-gray-400'}`}>{o.l}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ POST ═══════════════════════════════════════ */}
        {curKey === 'post' && (
          <div className="space-y-6">
            {/* RPE */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  RPE — {rpe}/10
                </span>
                <span style={{ color: 'var(--theme-primary, #F97316)', fontSize: 12 }}>· {RPE_LABELS[rpe]}</span>
                <button onClick={() => setShowRpeInfo(v => !v)}
                  style={{ width: 18, height: 18, borderRadius: '50%', background: '#E5E7EB', color: '#6B7280', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', border: 'none' }}>
                  ?
                </button>
              </div>
              {showRpeInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
                  <p className="text-sm font-bold text-blue-800 mb-1">RPE — Rate of Perceived Exertion</p>
                  <div className="space-y-1.5 text-xs text-blue-700">
                    {[['1–3','Très facile'],['4–5','Modéré'],['6–7','Difficile'],['8–9','Très dur'],['10','Maximum']].map(([n,l]) => (
                      <div key={n} className="flex gap-2"><span className="font-bold w-8 flex-shrink-0">{n}</span><span>{l}</span></div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-1 items-end" style={{ height: 64 }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setRpe(n)}
                    className="flex-1 rounded-md cursor-pointer transition-all duration-100"
                    style={{ height: n === rpe ? '100%' : `${35 + n * 6}%`, background: n <= rpe ? RPE_COLORS[n-1] : '#E5E7EB', opacity: n <= rpe ? 1 : 0.4 }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1.5"><span>Très facile</span><span>Maximum</span></div>
            </div>

            {/* Ressenti */}
            <div>
              <label className={labelCls}>Ressenti post-séance</label>
              <div className="flex gap-2">
                {[{v:1,e:'😩',l:'Mauvais'},{v:2,e:'😕',l:'Passable'},{v:3,e:'😐',l:'Correct'},{v:4,e:'😊',l:'Bien'},{v:5,e:'🤩',l:'Excellent'}].map(f => (
                  <button key={f.v} onClick={() => setFeeling(f.v)}
                    className={`flex-1 py-2 rounded-xl border flex flex-col items-center gap-1 transition ${feeling === f.v ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                    <span className="text-xl">{f.e}</span>
                    <span className={`text-xs font-medium ${feeling === f.v ? 'text-orange-500' : 'text-gray-400'}`}>{f.l}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Douleurs */}
            <div>
              <label className={labelCls}>Douleurs / Alertes</label>
              {painEntries.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {painEntries.map((p, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${SEV_PILL[p.severity]}`}>
                      <span>{p.label}</span>
                      <span className="opacity-60">· {SEVERITY.find(s => s.v === p.severity)?.l}</span>
                      <button onClick={() => setPainEntries(ps => ps.filter((_,idx) => idx !== i))} className="ml-1 opacity-60 hover:opacity-100">×</button>
                    </div>
                  ))}
                </div>
              )}
              {addingPain ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Zone</label>
                    <input list="pain-parts-list" value={painPart} onChange={e => setPainPart(e.target.value)}
                      placeholder="Sélectionne ou tape une zone..."
                      className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    <datalist id="pain-parts-list">{PAIN_PARTS.map(p => <option key={p} value={p} />)}</datalist>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Intensité</label>
                    <div className="flex gap-2">
                      {SEVERITY.map(s => (
                        <button key={s.v} onClick={() => setPainSev(s.v)}
                          className={`flex-1 py-2 rounded-lg border text-xs font-bold transition ${painSev === s.v ? s.cls : 'border-gray-200 bg-white text-gray-400'}`}>{s.l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setAddingPain(false); setPainPart('') }} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-500">Annuler</button>
                    <button onClick={addPain} className="flex-1 py-2 rounded-lg text-white text-sm font-bold" style={{ background: 'var(--theme-primary, #F97316)' }}>Ajouter</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingPain(true)}
                  className="w-full py-2.5 border border-dashed border-gray-300 text-gray-400 rounded-xl text-sm hover:border-orange-300 hover:text-orange-400 transition">
                  + Ajouter une douleur
                </button>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ressenti général, contexte particulier..."
                className={inputCls + ' resize-none'} />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            <span>⚠️</span><span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 pt-4 pb-10">
          {step > 0 && (
            <button onClick={goBack} className="flex-1 py-3.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-100 transition">← Retour</button>
          )}
          <button onClick={step < STEPS.length - 1 ? goNext : handleSubmit} disabled={saving}
            style={{ flex: 2, background: step === STEPS.length - 1 ? '#22C55E' : 'var(--theme-primary, #F97316)' }}
            className={`py-3.5 rounded-xl text-sm font-bold text-white transition ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}>
            {saving ? 'Sauvegarde...' : step === STEPS.length - 1 ? '✓ Enregistrer' : 'Suivant →'}
          </button>
        </div>

      </div>
    </div>
  )
}
