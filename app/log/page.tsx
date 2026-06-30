'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getSessionTypes, saveSession, getProfile, detectAndSavePRs } from '@/lib/api'
import type { SessionType, PainEntry } from '@/lib/api'
import { toast } from '@/lib/toast'
import MovementSearch from '@/components/MovementSearch'
import { DatePicker } from '@/components/ui'
import { ENERGY_LEVELS, energyOf } from '@/lib/energy'
import { FEELING_LEVELS } from '@/lib/feeling'
import { celebrate } from '@/lib/confetti'

// ── Types ─────────────────────────────────────────────────
type SetRow    = { reps: string; weight: string }
type PrepBlock = { id: number; kind: 'block'; movementId: string; movementLabel: string; hasWeight: boolean; sets: SetRow[] }
type PrepNote  = { id: number; kind: 'note';  text: string }
type PrepItem  = PrepBlock | PrepNote
// ST-69: an extra, self-contained WOD block (format + duration + movements + result).
type ExtraWod  = { id: number; format: string; timeCap: string; description: string; result: string }

// Haltérophilie
type HSetRow = { reps: string; weight: string; tempo: string; pct_rm: string; execution: 'good' | 'ok' | 'fail' | '' }
type HBlock  = { id: number; isComplex: boolean; complexLabel: string; movementId: string; movementLabel: string; rm1: string; sets: HSetRow[] }

// Run intervals
type RunInterval = { distance: string; timeMin: string; timeSec: string; rest: string }

const mkBlock  = (id: number): PrepBlock => ({ id, kind: 'block', movementId: '', movementLabel: '', hasWeight: true, sets: [{ reps: '', weight: '' }] })
const mkNote   = (id: number): PrepNote  => ({ id, kind: 'note',  text: '' })
const mkHBlock = (id: number): HBlock    => ({ id, isComplex: false, complexLabel: '', movementId: '', movementLabel: '', rm1: '', sets: [{ reps: '', weight: '', tempo: '', pct_rm: '', execution: '' }] })
const mkRunIv  = (): RunInterval => ({ distance: '', timeMin: '', timeSec: '', rest: '' })

// ── Constantes ────────────────────────────────────────────
const WOD_FORMATS       = ['AMRAP','EMOM','For Time',"Every X'",'Autre']
const WOD_FORMATS_EXTRA = ['E2MOM','Tabata','Rounds']
const TIMED_FORMATS     = ['AMRAP','EMOM','E2MOM',"Every X'",'Tabata']
const DURATION_CHIPS    = [8,10,12,15,20,25]
const COMMON_MOVES      = [
  'Thrusters','Wall Ball','Burpees','Box Jump','Double Unders',
  'Pull-ups','TTB','HSPU','Bar MU','Dips',
  'Power Clean','Deadlift','KB Swing','Overhead Squat',
  'Row Cal','Echo Bike Cal','Run 400m','Run 200m',
  'Lunges','Walking Lunges','Wall Walk','Sit-ups',
]
const NO_WEIGHT_CATS = ['gymnastics','cardio','skill']
const RUN_TYPES      = ['Endurance','Tempo','Fractionné','Récupération','Compétition']
const RUN_SURFACES   = ['Route','Trail','Piste','Tapis']
const PAIN_PARTS     = ['Épaule G','Épaule D','Poignet G','Poignet D','Coude G','Coude D','Avant-bras G','Avant-bras D','Genou G','Genou D','Hanche G','Hanche D','Bas du dos','Lombaires','Cheville G','Cheville D','Cou','Quad G','Quad D','Ischio G','Ischio D']
const SEVERITY       = [
  { v: 1 as const, l: 'Légère',  cls: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
  { v: 2 as const, l: 'Modérée', cls: 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' },
  { v: 3 as const, l: 'Forte',   cls: 'border-red-300 bg-red-50 text-red-700'          },
]
const SEV_PILL   = ['','bg-yellow-100 text-yellow-700','bg-[var(--accent-soft)] text-[var(--accent-text)]','bg-red-100 text-red-700']
const RPE_COLORS = ['#3B82F6','#3B82F6','#3B82F6','#F59E0B','#F59E0B','#D97706','#EA580C','#EA580C','#EF4444','#DC2626']
const RPE_LABELS = ['','Très facile','Facile','Un peu dur','Modéré','Modéré+','Dur','Très dur','Intense','Extrême','Maximum']

const HYROX_STATIONS = [
  { name: 'SkiErg',             icon: '⛷️', distance: '1 000m',   hasWeight: false },
  { name: 'Sled Push',          icon: '🛷', distance: '50m',       hasWeight: true  },
  { name: 'Sled Pull',          icon: '🔗', distance: '50m',       hasWeight: true  },
  { name: 'Burpee Broad Jumps', icon: '💥', distance: '50m',       hasWeight: false },
  { name: 'Rowing',             icon: '🚣', distance: '1 000m',    hasWeight: false },
  { name: 'Farmers Carry',      icon: '🏋️', distance: '200m',      hasWeight: true  },
  { name: 'Sandbag Lunges',     icon: '🎒', distance: '100m',      hasWeight: true  },
  { name: 'Wall Balls',         icon: '🏀', distance: '100 reps',  hasWeight: true  },
]

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
const STEPS_HALTEROPHILIE = [
  { label: 'Date & Sommeil', key: 'sleep'          },
  { label: 'Type de séance', key: 'type'           },
  { label: 'Séance',         key: 'halterophilie'  },
  { label: 'Post-séance',    key: 'post'           },
]
const STEPS_HYROX = [
  { label: 'Date & Sommeil', key: 'sleep' },
  { label: 'Type de séance', key: 'type'  },
  { label: 'Hyrox',          key: 'hyrox' },
  { label: 'Post-séance',    key: 'post'  },
]
// ST-69: Endurance skips the Skills/Séance step — the WOD blocks are the content.
const STEPS_ENDURANCE = [
  { label: 'Date & Sommeil', key: 'sleep' },
  { label: 'Type de séance', key: 'type'  },
  { label: 'Séance',         key: 'wod'   },
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

function ivPace(distance: string, timeMin: string, timeSec: string): string | null {
  if (!distance || (!timeMin && !timeSec)) return null
  const distKm = distance.toLowerCase().includes('km')
    ? parseFloat(distance) : parseFloat(distance) / 1000
  const totalSec = (parseInt(timeMin) || 0) * 60 + (parseInt(timeSec) || 0)
  if (!distKm || !totalSec) return null
  const paceSecKm = totalSec / distKm
  return `${Math.floor(paceSecKm / 60)}'${String(Math.round(paceSecKm % 60)).padStart(2,'0')}"/km`
}

const inputCls = "ds-field"
const labelCls = "block text-xs font-bold text-[var(--sub)] uppercase tracking-wide mb-2"

// ── Composant principal ────────────────────────────────────
export default function LogPage() {
  const [step, setStep]               = useState(0)
  const [error, setError]             = useState<string | null>(null)
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [savedId, setSavedId]         = useState('')

  // Step 0
  const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const [date, setDate]               = useState(todayLocal)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [sleepHours, setSleepHours] = useState(7)
  const [energy, setEnergy]         = useState(3)

  // Step 1
  const [typeId, setTypeId]     = useState('')
  const [duration, setDuration] = useState('')

  // Step 2 — Séance (CrossFit / Renfo)
  const [warmupNotes, setWarmupNotes]           = useState('')
  const [prepItems, setPrepItems]               = useState<PrepItem[]>([mkBlock(1)])
  const [photoPreview, setPhotoPreview]         = useState<string | null>(null)
  const [analyzingPhoto, setAnalyzingPhoto]     = useState(false)
  const [showClearAIDialog, setShowClearAIDialog] = useState(false)
  const [wodMoveSearch, setWodMoveSearch]       = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoCaptureRef = useRef<HTMLInputElement>(null)   // capture=camera (mobile)

  const clearAIContent = () => {
    setWarmupNotes(''); setPrepItems([mkBlock(1)]); setHBlocks([mkHBlock(1)])
    setWodDesc(''); setWodFormat(''); setWodResult(''); setExtraWods([])
  }
  const deletePhoto = () => {
    setPhotoPreview(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
    if (photoCaptureRef.current) photoCaptureRef.current.value = ''
    setShowClearAIDialog(true)
  }

  // Step 2 — Haltérophilie
  const [hBlocks, setHBlocks] = useState<HBlock[]>([mkHBlock(1)])

  // Step 2 — Run
  const [runType, setRunType]           = useState('')
  const [runDistance, setRunDistance]   = useState('')
  const [runElevation, setRunElevation] = useState('')
  const [runSurface, setRunSurface]     = useState('')
  const [runIntervals, setRunIntervals] = useState<RunInterval[]>([mkRunIv()])

  // Step 2 — Hyrox
  const [hyroxTotalTime, setHyroxTotalTime] = useState('')
  const [hyroxStations, setHyroxStations]   = useState<{ timeMin: string; timeSec: string; weight: string }[]>(
    HYROX_STATIONS.map(() => ({ timeMin: '', timeSec: '', weight: '' }))
  )

  // Step 3 — WOD
  const [hasWod, setHasWod]         = useState(true)
  const [wodFormat, setWodFormat]   = useState('')
  const [wodTimeCap, setWodTimeCap] = useState('')
  const [wodDesc, setWodDesc]       = useState('')
  const [wodResult, setWodResult]   = useState('')
  const [wodRx, setWodRx]           = useState(true)
  // ST-69: additional autonomous WOD blocks beneath the main one.
  const [extraWods, setExtraWods]   = useState<ExtraWod[]>([])

  // ST-34 P2 — prefill the log from a box programming ("Logger ce WOD").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('log_prefill')
      if (!raw) return
      sessionStorage.removeItem('log_prefill')
      const pf = JSON.parse(raw) as { warmup?: string; strength?: string; wodFormat?: string; wodTimeCap?: number | string | null; wodDescription?: string }
      if (pf.warmup) setWarmupNotes(pf.warmup)
      if (pf.strength) setPrepItems(ps => [{ id: Date.now(), kind: 'note' as const, text: pf.strength! }, ...ps])
      if (pf.wodFormat || pf.wodDescription) {
        setHasWod(true)
        if (pf.wodFormat) setWodFormat(pf.wodFormat)
        if (pf.wodTimeCap != null && pf.wodTimeCap !== '') setWodTimeCap(String(pf.wodTimeCap))
        if (pf.wodDescription) setWodDesc(pf.wodDescription)
      }
      toast.success('Séance pré-remplie depuis le WOD du jour')
    } catch { /* ignore */ }
  }, [])

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

  const selectedType = sessionTypes.find(t => t.id === typeId)
  const typeName     = selectedType?.name ?? ''
  const isRun        = typeName === 'Run'
  const isHaltero    = typeName.toLowerCase().includes('haltéro') || typeName.toLowerCase() === 'halterophilie'
  const isHyrox      = typeName.toLowerCase() === 'hyrox'
  const isCrossfit   = typeName === 'CrossFit'   // RX/Scaled only makes sense here (ST-71)
  const isEndurance  = typeName === 'Endurance'  // hide Skills step, WOD-blocks only (ST-69)
  const STEPS        = isHaltero ? STEPS_HALTEROPHILIE : isRun ? STEPS_RUN : isHyrox ? STEPS_HYROX : isEndurance ? STEPS_ENDURANCE : STEPS_DEFAULT
  const curKey       = STEPS[step]?.key

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

  // ── Extra WOD blocks (ST-69) ─────────────────────────────
  const addExtraWod    = () => setExtraWods(b => [...b, { id: Date.now(), format: '', timeCap: '', description: '', result: '' }])
  const updExtraWod    = (id: number, patch: Partial<ExtraWod>) => setExtraWods(b => b.map(x => x.id === id ? { ...x, ...patch } : x))
  const removeExtraWod = (id: number) => setExtraWods(b => b.filter(x => x.id !== id))

  // ── HBlock helpers ──────────────────────────────────────
  const updHBlock = (id: number, field: Partial<HBlock>) =>
    setHBlocks(bs => bs.map(b => b.id === id ? { ...b, ...field } : b))
  const updHSet = (blockId: number, si: number, field: Partial<HSetRow>) =>
    setHBlocks(bs => bs.map(b => {
      if (b.id !== blockId) return b
      return { ...b, sets: b.sets.map((s, i) => i === si ? { ...s, ...field } : s) }
    }))
  const removeHBlock = (id: number) => setHBlocks(bs => bs.filter(b => b.id !== id))

  // ── Hyrox helpers ───────────────────────────────────────
  const updStation = (i: number, field: Partial<{ timeMin: string; timeSec: string; weight: string }>) =>
    setHyroxStations(ss => ss.map((s, idx) => idx === i ? { ...s, ...field } : s))

  // ── Run interval helpers ────────────────────────────────
  const updInterval = (i: number, field: Partial<RunInterval>) =>
    setRunIntervals(ivs => ivs.map((iv, idx) => idx === i ? { ...iv, ...field } : iv))

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
        setWodDesc(data.description)
        filled.push('WOD')
      }
      toast.success(filled.length > 0 ? `Tableau analysé ✓ — ${filled.join(', ')}` : 'Photo analysée ✓')
    } catch (err) {
      console.error('Photo error:', err)
      toast.error('Analyse échouée. Essaie une photo plus nette.')
    } finally {
      setAnalyzingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    if (photoCaptureRef.current) photoCaptureRef.current.value = ''
    }
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
    setHBlocks([mkHBlock(Date.now())])
    setRunType(''); setRunDistance(''); setRunElevation(''); setRunSurface('')
    setRunIntervals([mkRunIv()])
    setHyroxTotalTime(''); setHyroxStations(HYROX_STATIONS.map(() => ({ timeMin: '', timeSec: '', weight: '' })))
    setHasWod(true); setWodFormat(''); setWodTimeCap('')
    setWodDesc(''); setWodResult(''); setWodRx(true); setExtraWods([])
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

      const wodDescription = wodDesc || undefined

      const hyroxMeta = isHyrox ? {
        total_time: hyroxTotalTime || undefined,
        stations: hyroxStations
          .map((s, i) => ({
            name: HYROX_STATIONS[i].name,
            time_min: s.timeMin ? parseInt(s.timeMin) : null,
            time_sec: s.timeSec ? parseInt(s.timeSec) : null,
            weight_kg: s.weight ? parseFloat(s.weight) : null,
          }))
          .filter(s => s.time_min !== null || s.time_sec !== null || s.weight_kg !== null),
      } : undefined

      const runMeta = isRun ? {
        run_type:    runType    || undefined,
        distance_km: runDistance  ? parseFloat(runDistance)  : undefined,
        elevation_m: runElevation ? parseInt(runElevation)   : undefined,
        surface:     runSurface   || undefined,
        pace_min_km: paceMinkm    ? parseFloat(paceMinkm.toFixed(2)) : undefined,
        intervals: runType === 'Fractionné'
          ? runIntervals
              .filter(iv => iv.distance || iv.timeMin || iv.timeSec)
              .map(iv => ({
                distance: iv.distance || null,
                time_min: iv.timeMin ? parseInt(iv.timeMin) : null,
                time_sec: iv.timeSec ? parseInt(iv.timeSec) : null,
                rest: iv.rest || null,
              }))
          : undefined,
      } : undefined

      const defaultBlocks = isRun || isHyrox ? [] : prepItems
        .filter((p): p is PrepBlock => p.kind === 'block' && !!p.movementId)
        .map(b => ({
          movement_id: b.movementId, movement_label: b.movementLabel,
          block_type: 'strength' as const,
          sets: b.sets.filter(s => s.reps || s.weight).map(s => ({
            reps:      s.reps   ? parseInt(s.reps)              : undefined,
            weight_kg: s.weight && b.hasWeight ? parseFloat(s.weight) : undefined,
          }))
        }))

      const halteroBlocks = isHaltero ? hBlocks
        .filter(b => b.movementId || b.isComplex)
        .map(b => ({
          movement_id:   b.isComplex ? undefined : b.movementId,
          movement_label: b.isComplex ? b.complexLabel : b.movementLabel,
          block_type: 'strength' as const,
          is_complex:   b.isComplex,
          complex_label: b.isComplex ? b.complexLabel : undefined,
          sets: b.sets.filter(s => s.reps || s.weight).map(s => ({
            reps:      s.reps   ? parseInt(s.reps)   : undefined,
            weight_kg: s.weight ? parseFloat(s.weight) : undefined,
            tempo:     s.tempo  || undefined,
            pct_rm:    s.pct_rm ? parseInt(s.pct_rm) : undefined,
            execution: s.execution || undefined,
          }))
        })) : []

      const blocks = isHaltero ? halteroBlocks : defaultBlocks

      const id = await saveSession({
        date, session_type_id: typeId,
        duration_min:  duration ? parseInt(duration) : undefined,
        sleep_hours:   sleepHours, energy_level: energy,
        rpe, feeling_post: feeling, notes: allNotes,
        blocks,
        wod: !isRun && !isHaltero && !isHyrox && hasWod && wodFormat ? {
          format_label:  wodFormat,
          time_cap:      wodTimeCap ? parseInt(wodTimeCap) : undefined,
          description:   wodDescription,
          result_detail: wodResult || undefined,
          is_rx:         isCrossfit ? wodRx : null,
        } : undefined,
        // ST-69: additional WOD blocks (saved in order after the main one).
        wods: (!isRun && !isHaltero && !isHyrox && hasWod)
          ? extraWods.filter(b => b.format).map(b => ({
              format_label:  b.format,
              time_cap:      b.timeCap ? parseInt(b.timeCap) : undefined,
              description:   b.description || undefined,
              result_detail: b.result || undefined,
              is_rx:         null,
            }))
          : undefined,
        pain_entries: painEntries.length > 0 ? painEntries : undefined,
        meta: hyroxMeta ?? runMeta,
      })
      setSavedId(id)
      celebrate()   // 🎉 ST-76

      // Détecter les PRs
      const prBlocks = isHaltero ? halteroBlocks
        .filter(b => (b.movement_id || b.is_complex) && b.sets.some(s => s.weight_kg))
        .map(b => ({
          movement_id: b.movement_id ?? '', movement_label: b.movement_label,
          block_type: 'strength' as const,
          sets: b.sets.filter(s => s.weight_kg).map(s => ({ reps: s.reps, weight_kg: s.weight_kg }))
        })) : prepItems
          .filter((p): p is PrepBlock => p.kind === 'block' && !!p.movementId)
          .map(b => ({
            movement_id: b.movementId, movement_label: b.movementLabel,
            block_type: 'strength' as const,
            sets: b.sets.filter(s => s.weight).map(s => ({
              reps: s.reps ? parseInt(s.reps) : undefined,
              weight_kg: parseFloat(s.weight)
            }))
          }))

      if (prBlocks.length > 0) {
        const newPRs = await detectAndSavePRs(id, prBlocks)
        if (newPRs.length > 0) {
          toast.success(`🏆 ${newPRs.length > 1 ? 'Nouveaux PRs' : 'Nouveau PR'} : ${newPRs.map(p => `${p.movementName} ${p.weight}kg`).join(', ')}`)
        } else {
          toast.success('Séance enregistrée ! 🎉')
        }
      } else {
        toast.success('Séance enregistrée ! 🎉')
      }
    } catch (e) { console.error(e); toast.error('Erreur lors de la sauvegarde.') }
    finally { setSaving(false) }
  }

  // ── Loading ─────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
      <div className="w-8 h-8 rounded-full border-4 border-[color:var(--theme-primary)] border-t-transparent animate-spin" />
    </div>
  )

  // ── Saved ───────────────────────────────────────────────
  if (savedId) return (
    <div className="flex items-center justify-center px-4" style={{ minHeight: '80dvh' }}>
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl mx-auto">✓</div>
        <div>
          <h2 className="text-2xl font-black text-[var(--ink)] mb-1">Séance enregistrée</h2>
          <p className="text-sm text-[var(--muted)]">Beau travail !</p>
        </div>
        {hasWod && wodResult.trim() && (
          <div className="bg-[var(--accent-soft)] border border-[color:var(--accent-soft)] rounded-2xl px-4 py-3 text-left">
            <p className="text-xs font-bold text-[var(--accent-text)] uppercase tracking-wide mb-1">Score WOD</p>
            <p className="text-sm text-[var(--ink)] font-semibold mb-2">«&nbsp;{wodResult}&nbsp;»</p>
            <Link href="/prs"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-text)] hover:text-[var(--accent-text)] transition">
              Enregistrer comme perf perso →
            </Link>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={reset}
            className="flex-1 py-3.5 rounded-xl border border-[color:var(--border-strong)] text-sm font-bold text-[var(--ink-soft)] hover:bg-[var(--hover)] transition cursor-pointer">
            + Nouvelle
          </button>
          <Link href={`/sessions/${savedId}`}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white text-center transition"
            style={{ background: 'var(--theme-primary, #F97316)' }}>
            Voir la séance →
          </Link>
        </div>
      </div>
    </div>
  )

  // ── Steps bar ───────────────────────────────────────────
  return (
    <>
    <div className="bg-[var(--bg)] pb-24">
      <div className="max-w-lg mx-auto px-4">

        {/* Header */}
        <div className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-black text-[var(--ink)]">
              {curKey === 'sleep' && 'Nouvelle séance'}
              {curKey === 'type'  && 'Type de séance'}
              {curKey === 'strength'     && 'Séance'}
              {curKey === 'halterophilie'&& 'Haltérophilie'}
              {curKey === 'run'          && 'Run'}
              {curKey === 'hyrox'        && 'Hyrox'}
              {curKey === 'wod'          && 'WOD'}
              {curKey === 'post'         && 'Post-séance'}
            </h1>
            <span className="text-xs text-[var(--muted)] font-medium">{step + 1} / {STEPS.length}</span>
          </div>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full transition-colors"
                style={{ background: i <= step ? 'var(--theme-primary, #F97316)' : 'var(--border)' }} />
            ))}
          </div>
        </div>

        {/* ══ SLEEP ══════════════════════════════════════ */}
        {curKey === 'sleep' && (
          <div className="space-y-6">
            <div>
              <label className={labelCls}>Date <span className="text-[color:var(--theme-primary)]">*</span></label>
              {(() => {
                const ds = (off: number) => { const d = new Date(); d.setDate(d.getDate() - off); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
                const chips = [["Aujourd'hui", ds(0)], ['Hier', ds(1)], ['Avant-hier', ds(2)]] as [string,string][]
                const isChip = chips.some(([,v]) => v === date)
                return (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {chips.map(([label, val]) => (
                        <button key={label} type="button"
                          onClick={() => { setDate(val); setShowDatePicker(false) }}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${date === val && !showDatePicker ? 'bg-[var(--theme-primary)] border-[color:var(--theme-primary)] text-white' : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]'}`}>
                          {label}
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => setShowDatePicker(true)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${(showDatePicker || !isChip) ? 'bg-[var(--theme-primary)] border-[color:var(--theme-primary)] text-white' : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]'}`}>
                        Autre
                      </button>
                    </div>
                    {(showDatePicker || !isChip) && (
                      <div className="mt-2"><DatePicker value={date} onChange={setDate} /></div>
                    )}
                  </>
                )
              })()}
            </div>
            <div>
              <label className={labelCls}>Nuit de sommeil — {Math.floor(sleepHours)}h{sleepHours % 1 ? '30' : ''}</label>
              <input type="range" min={3} max={12} step={0.5} value={sleepHours} onChange={e => setSleepHours(parseFloat(e.target.value))}
                className="w-full accent-[var(--theme-primary)]" />
              <div className="flex justify-between text-xs text-[var(--muted)] mt-1"><span>3h</span><span>12h</span></div>
            </div>
            <div>
              <label className={labelCls}>Énergie avant la séance</label>
              <div className="flex gap-2">
                {ENERGY_LEVELS.map(o => (
                  <button key={o.v} onClick={() => setEnergy(o.v)}
                    className={`flex-1 py-2.5 rounded-xl border text-xl transition ${energy === o.v ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)]' : 'border-[color:var(--border-strong)] bg-[var(--card)]'}`}>
                    {o.emoji}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-1 text-center">{energyOf(energy)?.label}</p>
            </div>
          </div>
        )}

        {/* ══ TYPE ═══════════════════════════════════════ */}
        {curKey === 'type' && (
          <div className="space-y-6">
            <div>
              <label className={labelCls}>Type de séance <span className="text-[color:var(--theme-primary)]">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {sessionTypes.map(t => (
                  <button key={t.id} onClick={() => { setTypeId(t.id); setError(null) }}
                    className={`p-3 rounded-xl border text-xs font-medium transition flex flex-col items-center gap-1 ${typeId === t.id ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border-strong)] bg-[var(--card)] text-[var(--ink-soft)]'}`}>
                    <span className="text-xl">{t.emoji}</span>{t.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Durée (min) — optionnel</label>
              <input type="number" placeholder="ex: 75" value={duration} onChange={e => setDuration(e.target.value)}
                className="w-28 rounded-xl border border-[color:var(--muted)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
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
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition ${runType === t ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border-strong)] bg-[var(--card)] text-[var(--ink-soft)]'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Distance (km)</label>
                <input type="number" step="0.1" placeholder="ex: 10" value={runDistance} onChange={e => setRunDistance(e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--muted)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
              </div>
              <div>
                <label className={labelCls}>Dénivelé+ (m)</label>
                <input type="number" placeholder="ex: 250" value={runElevation} onChange={e => setRunElevation(e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--muted)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
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
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${runSurface === s ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border-strong)] bg-[var(--card)] text-[var(--ink-soft)]'}`}>{s}</button>
                ))}
              </div>
            </div>

            {/* Intervals — Fractionné */}
            {runType === 'Fractionné' && (
              <div>
                <label className={labelCls}>Intervals</label>
                <div className="space-y-3">
                  {runIntervals.map((iv, i) => {
                    const pace = ivPace(iv.distance, iv.timeMin, iv.timeSec)
                    return (
                      <div key={i} className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--sub)] uppercase tracking-wide">Rep {i+1}</span>
                          {runIntervals.length > 1 && (
                            <button onClick={() => setRunIntervals(iv => iv.filter((_,idx) => idx !== i))} className="text-[var(--border-strong)] hover:text-red-400 text-base">×</button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-[var(--muted)] mb-1">Distance</label>
                            <input type="text" placeholder="400m" value={iv.distance}
                              onChange={e => updInterval(i, { distance: e.target.value })}
                              className="w-full rounded-lg border border-[color:var(--border-strong)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--muted)] mb-1">Temps mm:ss</label>
                            <div className="flex items-center gap-0.5">
                              <input type="number" placeholder="mm" value={iv.timeMin}
                                onChange={e => updInterval(i, { timeMin: e.target.value })}
                                className="w-full rounded-lg border border-[color:var(--border-strong)] px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[color:var(--theme-primary)]" />
                              <span className="text-[var(--muted)] text-xs">:</span>
                              <input type="number" placeholder="ss" value={iv.timeSec}
                                onChange={e => updInterval(i, { timeSec: e.target.value })}
                                className="w-full rounded-lg border border-[color:var(--border-strong)] px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[color:var(--theme-primary)]" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--muted)] mb-1">Repos</label>
                            <input type="text" placeholder="2'" value={iv.rest}
                              onChange={e => updInterval(i, { rest: e.target.value })}
                              className="w-full rounded-lg border border-[color:var(--border-strong)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                          </div>
                        </div>
                        {pace && (
                          <p className="text-xs font-bold text-green-600">⏱ Allure : {pace}</p>
                        )}
                      </div>
                    )
                  })}
                  <button onClick={() => setRunIntervals(ivs => [...ivs, mkRunIv()])}
                    className="w-full py-2.5 border border-dashed border-[color:var(--border-strong)] text-[var(--muted)] rounded-xl text-xs font-bold hover:border-[color:var(--theme-primary)] hover:text-[color:var(--theme-primary)] transition">
                    + Rep
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ HALTÉROPHILIE ══════════════════════════════ */}
        {curKey === 'halterophilie' && (
          <div className="space-y-4">

            {/* Photo */}
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <input ref={photoCaptureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-[color:var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Tableau" className="w-full max-h-44 object-cover" />
                {analyzingPhoto && (
                  <div className="absolute inset-0 bg-[var(--card)]/80 flex items-center justify-center gap-2">
                    <span className="animate-spin text-xl">⏳</span>
                    <span className="text-sm font-semibold text-[var(--ink-soft)]">Analyse en cours...</span>
                  </div>
                )}
                {!analyzingPhoto && (
                  <button onClick={deletePhoto}
                    className="absolute top-2 right-2 w-7 h-7 bg-[var(--card)] rounded-full shadow flex items-center justify-center text-[var(--sub)] hover:text-red-400 transition text-sm cursor-pointer">×</button>
                )}
              </div>
            ) : (
              <div>
                <button onClick={() => photoCaptureRef.current?.click()} disabled={analyzingPhoto}
                  className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition text-white shadow-md cursor-pointer"
                  style={{ background: analyzingPhoto ? '#FED7AA' : 'var(--theme-primary)' }}>
                  <span className="text-2xl">📷</span>
                  <div className="text-left">
                    <p className="text-sm font-black">Analyser le tableau</p>
                    <p className="text-xs font-normal opacity-80">Pré-remplit la séance automatiquement</p>
                  </div>
                </button>
                <button onClick={() => photoInputRef.current?.click()} disabled={analyzingPhoto}
                  className="w-full mt-2 text-xs font-bold text-[var(--muted)] cursor-pointer">ou importer depuis la galerie</button>
              </div>
            )}

            {/* Échauffement */}
            <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold text-[var(--ink-soft)]">Échauffement</span>
                </div>
                <span className="text-xs text-[var(--muted)]">optionnel</span>
              </div>
              <textarea value={warmupNotes}
                onChange={e => { setWarmupNotes(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                placeholder="Ex: Activation épaules, snatch balance, 3×3 à 60%..."
                rows={2} style={{ overflow: 'hidden' }}
                className={inputCls + ' resize-none'} />
            </div>

            {/* Notation tempo (aide) */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <p className="text-xs font-bold text-blue-700 mb-1">Notation tempo @XXXX</p>
              <p className="text-xs text-blue-600">Ex: <span className="font-mono font-bold">@30X1</span> → 3s descente · 0 bas · explosif haut · 1s haut</p>
            </div>

            {/* Blocs */}
            {hBlocks.map((block, bi) => (
              <div key={block.id} className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {bi + 1}
                  </span>
                  <span className="text-sm font-bold text-[var(--ink-soft)] flex-1">
                    {block.isComplex ? (block.complexLabel || 'Complexe') : (block.movementLabel || 'Mouvement')}
                  </span>
                  {hBlocks.length > 1 && (
                    <button onClick={() => removeHBlock(block.id)} className="text-[var(--border-strong)] hover:text-red-400 text-xl leading-none">×</button>
                  )}
                </div>

                {/* Simple / Complex toggle */}
                <div className="flex gap-2">
                  <button onClick={() => updHBlock(block.id, { isComplex: false })}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition ${!block.isComplex ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--muted)]'}`}>
                    Mouvement unique
                  </button>
                  <button onClick={() => updHBlock(block.id, { isComplex: true })}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition ${block.isComplex ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--muted)]'}`}>
                    Complexe
                  </button>
                </div>

                {/* Movement or complex input */}
                {block.isComplex ? (
                  <input type="text"
                    placeholder="ex: Clean + Front Squat ×2 + Jerk"
                    value={block.complexLabel}
                    onChange={e => updHBlock(block.id, { complexLabel: e.target.value })}
                    className={inputCls} />
                ) : (
                  <MovementSearch value={block.movementLabel}
                    onChange={m => updHBlock(block.id, { movementId: m.id, movementLabel: m.name })} />
                )}

                {/* 1RM référence */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--sub)] flex-shrink-0">1RM réf :</span>
                  <input type="number" placeholder="—" value={block.rm1}
                    onChange={e => updHBlock(block.id, { rm1: e.target.value })}
                    className="w-20 rounded-lg border border-[color:var(--border-strong)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                  <span className="text-xs text-[var(--muted)]">kg</span>
                  <span className="text-xs text-[var(--border-strong)] ml-1">→ auto %RM</span>
                </div>

                {/* Sets */}
                <div>
                  {/* Column headers */}
                  <div className="grid grid-cols-[18px_1fr_1fr_56px_36px_68px_20px] gap-1 text-[9px] text-[var(--muted)] uppercase font-semibold px-0.5 mb-1.5">
                    <span /><span>Reps</span><span>Poids</span><span>Tempo</span><span>%</span><span>Exec</span><span />
                  </div>
                  <div className="space-y-1.5">
                    {block.sets.map((set, si) => {
                      const autoKg = block.rm1 && set.pct_rm
                        ? Math.round(parseFloat(block.rm1) * parseInt(set.pct_rm) / 100 * 2) / 2
                        : null
                      return (
                        <div key={si}>
                          <div className="grid grid-cols-[18px_1fr_1fr_56px_36px_68px_20px] gap-1 items-center">
                            <span className="text-[10px] text-[var(--border-strong)] font-bold text-center">S{si+1}</span>
                            <input type="number" placeholder="—" value={set.reps}
                              onChange={e => updHSet(block.id, si, { reps: e.target.value })}
                              className="rounded-lg border border-[color:var(--border-strong)] px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[color:var(--theme-primary)]" />
                            <div>
                              <input type="number" step="0.5" placeholder="—" value={set.weight}
                                onChange={e => updHSet(block.id, si, { weight: e.target.value })}
                                className="w-full rounded-lg border border-[color:var(--border-strong)] px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[color:var(--theme-primary)]" />
                              {autoKg !== null && !set.weight && (
                                <p className="text-[9px] text-[color:var(--theme-primary)] text-center mt-0.5">{autoKg}kg</p>
                              )}
                            </div>
                            <input type="text" placeholder="@30X1" value={set.tempo}
                              onChange={e => updHSet(block.id, si, { tempo: e.target.value })}
                              className="rounded-lg border border-[color:var(--border-strong)] px-1 py-1.5 text-[11px] text-center font-mono focus:outline-none focus:ring-1 focus:ring-[color:var(--theme-primary)]" />
                            <input type="number" placeholder="%" value={set.pct_rm}
                              onChange={e => updHSet(block.id, si, { pct_rm: e.target.value })}
                              className="rounded-lg border border-[color:var(--border-strong)] px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[color:var(--theme-primary)]" />
                            <div className="flex gap-0.5">
                              {([
                                { v: 'good', l: '✓', active: 'bg-green-100 text-green-600 border-green-300' },
                                { v: 'ok',   l: '~', active: 'bg-amber-100 text-amber-600 border-amber-300' },
                                { v: 'fail', l: '✗', active: 'bg-red-100 text-red-600 border-red-300'       },
                              ] as { v: 'good'|'ok'|'fail'; l: string; active: string }[]).map(o => (
                                <button key={o.v}
                                  onClick={() => updHSet(block.id, si, { execution: set.execution === o.v ? '' : o.v })}
                                  className={`flex-1 py-1 text-xs font-bold rounded border transition ${set.execution === o.v ? o.active : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--border-strong)]'}`}>
                                  {o.l}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => {
                              if (block.sets.length > 1)
                                updHBlock(block.id, { sets: block.sets.filter((_, i) => i !== si) })
                            }} className="text-[var(--border-strong)] hover:text-[var(--sub)] text-base text-center">×</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={() => updHBlock(block.id, { sets: [...block.sets, { reps: '', weight: '', tempo: '', pct_rm: '', execution: '' }] })}
                    className="w-full mt-2 py-1.5 text-xs text-[var(--muted)] border border-dashed border-[color:var(--border-strong)] rounded-lg hover:border-[color:var(--theme-primary)] hover:text-[color:var(--theme-primary)] transition">
                    + Série
                  </button>
                </div>
              </div>
            ))}

            <button onClick={() => setHBlocks(bs => [...bs, mkHBlock(Date.now())])}
              className="w-full py-3 border-2 border-dashed border-[color:var(--accent-soft)] text-[color:var(--theme-primary)] rounded-2xl text-sm font-bold hover:border-[color:var(--theme-primary)] transition flex items-center justify-center gap-2">
              <span>🏋️</span> Ajouter un exercice
            </button>
          </div>
        )}

        {/* ══ HYROX ══════════════════════════════════════ */}
        {curKey === 'hyrox' && (
          <div className="space-y-4">

            {/* Total time */}
            <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4">
              <label className={labelCls}>Temps total</label>
              <input type="text" placeholder="ex: 1:12:45" value={hyroxTotalTime}
                onChange={e => setHyroxTotalTime(e.target.value)}
                className={inputCls} />
            </div>

            {/* Format reminder */}
            <div className="bg-[var(--accent-soft)] border border-[color:var(--accent-soft)] rounded-2xl px-4 py-3">
              <p className="text-xs font-bold text-[var(--accent-text)] uppercase tracking-wide mb-0.5">Format Hyrox</p>
              <p className="text-xs text-[var(--sub)]">1km run → station → 1km run → station × 8</p>
            </div>

            {/* Stations */}
            {HYROX_STATIONS.map((station, i) => (
              <div key={i} className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{station.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[var(--ink)]">{station.name}</p>
                    <p className="text-xs text-[var(--muted)]">{station.distance}</p>
                  </div>
                  <span className="text-xs font-bold text-[var(--border-strong)] bg-[var(--track)] rounded-full px-2 py-0.5">#{i+1}</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-[var(--muted)] mb-1">Temps station</label>
                    <div className="flex items-center gap-1">
                      <input type="number" placeholder="mm" value={hyroxStations[i].timeMin}
                        onChange={e => updStation(i, { timeMin: e.target.value })}
                        className="w-14 rounded-lg border border-[color:var(--border-strong)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                      <span className="text-[var(--muted)] font-bold">:</span>
                      <input type="number" placeholder="ss" value={hyroxStations[i].timeSec}
                        onChange={e => updStation(i, { timeSec: e.target.value })}
                        className="w-14 rounded-lg border border-[color:var(--border-strong)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                    </div>
                  </div>
                  {station.hasWeight && (
                    <div>
                      <label className="block text-xs text-[var(--muted)] mb-1">Charge (kg)</label>
                      <input type="number" placeholder="—" value={hyroxStations[i].weight}
                        onChange={e => updStation(i, { weight: e.target.value })}
                        className="w-20 rounded-lg border border-[color:var(--border-strong)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ STRENGTH / SÉANCE ══════════════════════════ */}
        {curKey === 'strength' && (
          <div className="space-y-4">

            {/* Photo */}
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <input ref={photoCaptureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-[color:var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Tableau" className="w-full max-h-44 object-cover" />
                {analyzingPhoto && (
                  <div className="absolute inset-0 bg-[var(--card)]/80 flex items-center justify-center gap-2">
                    <span className="animate-spin text-xl">⏳</span>
                    <span className="text-sm font-semibold text-[var(--ink-soft)]">Analyse en cours...</span>
                  </div>
                )}
                {!analyzingPhoto && (
                  <button onClick={deletePhoto}
                    className="absolute top-2 right-2 w-7 h-7 bg-[var(--card)] rounded-full shadow flex items-center justify-center text-[var(--sub)] hover:text-red-400 transition text-sm cursor-pointer">×</button>
                )}
              </div>
            ) : (
              <div>
                <button onClick={() => photoCaptureRef.current?.click()} disabled={analyzingPhoto}
                  className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition text-white shadow-md cursor-pointer"
                  style={{ background: analyzingPhoto ? '#FED7AA' : 'var(--theme-primary)' }}>
                  <span className="text-2xl">📷</span>
                  <div className="text-left">
                    <p className="text-sm font-black">Analyser le tableau</p>
                    <p className="text-xs font-normal opacity-80">Pré-remplit warm-up, skill et WOD automatiquement</p>
                  </div>
                </button>
                <button onClick={() => photoInputRef.current?.click()} disabled={analyzingPhoto}
                  className="w-full mt-2 text-xs font-bold text-[var(--muted)] cursor-pointer">ou importer depuis la galerie</button>
              </div>
            )}

            {/* Échauffement */}
            <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold text-[var(--ink-soft)]">Échauffement</span>
                </div>
                <span className="text-xs text-[var(--muted)]">optionnel</span>
              </div>
              <textarea value={warmupNotes}
                onChange={e => { setWarmupNotes(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                placeholder="Ex: EMOM 6' — 1' Dead Hang / 2' Air Squat / 3' Echo Bike..."
                rows={2} style={{ overflow: 'hidden' }}
                className={inputCls + ' resize-none'} />
            </div>

            {/* Préparation */}
            <div>
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-2">Skills — Optionnel</p>
              <div className="space-y-3">
                {prepItems.map((item, idx) => item.kind === 'note' ? (
                  <div key={item.id} className="bg-[var(--card)] rounded-2xl border border-blue-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🎯</span>
                      <span className="text-sm font-bold text-[var(--ink-soft)] flex-1">Note technique</span>
                      <button onClick={() => removeItem(item.id)} className="text-[var(--border-strong)] hover:text-red-400 text-xl leading-none">×</button>
                    </div>
                    <textarea rows={2} value={item.text}
                      onChange={e => setPrepItems(ps => ps.map(p => p.id === item.id ? { ...p, text: e.target.value } : p))}
                      placeholder="Ex: Snatch technique — focus position basse, Every 3' x 4..."
                      className={inputCls + ' resize-none'} autoFocus={idx === prepItems.length - 1 && item.text === ''} />
                  </div>
                ) : (
                  <div key={item.id} className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {prepItems.filter(p => p.kind === 'block').indexOf(item as PrepBlock) + 1}
                      </span>
                      <span className="text-sm font-bold text-[var(--ink-soft)] flex-1">{(item as PrepBlock).movementLabel || 'Mouvement'}</span>
                      {prepItems.length > 1 && (
                        <button onClick={() => removeItem(item.id)} className="text-[var(--border-strong)] hover:text-red-400 text-xl leading-none">×</button>
                      )}
                    </div>
                    <div className="mb-3">
                      <MovementSearch value={(item as PrepBlock).movementLabel}
                        onChange={m => updBlock(item.id, { movementId: m.id, movementLabel: m.name, hasWeight: !NO_WEIGHT_CATS.includes(m.category) })} />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => updBlock(item.id, { hasWeight: !(item as PrepBlock).hasWeight })}
                        className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${(item as PrepBlock).hasWeight ? 'bg-[var(--theme-primary)]' : 'bg-[var(--border)]'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-[var(--card)] rounded-full shadow transition-all ${(item as PrepBlock).hasWeight ? 'left-4' : 'left-0.5'}`} />
                      </button>
                      <span className="text-xs text-[var(--sub)]">{(item as PrepBlock).hasWeight ? 'Avec poids (kg)' : 'Reps uniquement'}</span>
                    </div>
                    <div className={`grid gap-2 text-xs text-[var(--muted)] uppercase font-semibold px-0.5 mb-1.5 ${(item as PrepBlock).hasWeight ? 'grid-cols-[20px_1fr_1fr_24px]' : 'grid-cols-[20px_1fr_24px]'}`}>
                      <span/><span>Reps</span>{(item as PrepBlock).hasWeight && <span>Poids kg</span>}<span/>
                    </div>
                    {(item as PrepBlock).sets.map((set, si) => (
                      <div key={si} className={`grid gap-2 mb-1.5 items-center ${(item as PrepBlock).hasWeight ? 'grid-cols-[20px_1fr_1fr_24px]' : 'grid-cols-[20px_1fr_24px]'}`}>
                        <span className="text-xs text-[var(--border-strong)] font-bold text-center">S{si+1}</span>
                        <input type="number" placeholder="—" value={set.reps}
                          onChange={e => updSet(item.id, si, { reps: e.target.value })}
                          className="w-full min-w-0 rounded-lg border border-[color:var(--muted)] px-2 py-1.5 text-sm text-[var(--ink)] text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                        {(item as PrepBlock).hasWeight && (
                          <input type="number" placeholder="—" value={set.weight}
                            onChange={e => updSet(item.id, si, { weight: e.target.value })}
                            className="w-full min-w-0 rounded-lg border border-[color:var(--muted)] px-2 py-1.5 text-sm text-[var(--ink)] text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                        )}
                        <button onClick={() => {
                          if ((item as PrepBlock).sets.length > 1)
                            updBlock(item.id, { sets: (item as PrepBlock).sets.filter((_, i) => i !== si) })
                        }} className="text-[var(--border-strong)] hover:text-[var(--sub)] text-base text-center">×</button>
                      </div>
                    ))}
                    <button onClick={() => updBlock(item.id, { sets: [...(item as PrepBlock).sets, { reps: '', weight: '' }] })}
                      className="w-full mt-2 py-1.5 text-xs text-[var(--muted)] border border-dashed border-[color:var(--border-strong)] rounded-lg hover:border-[color:var(--theme-primary)] hover:text-[color:var(--theme-primary)] transition">
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
                  className="flex-1 py-2.5 border-2 border-dashed border-[color:var(--accent-soft)] text-[color:var(--theme-primary)] rounded-xl text-xs font-bold hover:border-[color:var(--theme-primary)] transition flex items-center justify-center gap-1">
                  <span>🏋️</span> Bloc force
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ WOD ════════════════════════════════════════ */}
        {curKey === 'wod' && (
          <div className="space-y-4">

            {/* Toggle WOD */}
            <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[var(--ink)]">WOD aujourd&apos;hui ?</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Conditioning / partie métabolique</p>
              </div>
              <button onClick={() => setHasWod(v => !v)}
                className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${hasWod ? 'bg-[var(--theme-primary)]' : 'bg-[var(--border)]'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-[var(--card)] rounded-full shadow transition-all ${hasWod ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {hasWod && (<>

              {/* ① Format + durée */}
              <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 space-y-4">
                <div>
                  <label className={labelCls}>① Format</label>
                  <div className="flex flex-wrap gap-2">
                    {WOD_FORMATS.map(f => (
                      <button key={f} onClick={() => setWodFormat(f === wodFormat ? '' : f)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                          wodFormat === f
                            ? 'bg-[var(--theme-primary)] border-[color:var(--theme-primary)] text-white'
                            : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]'
                        }`}>
                        {f}
                      </button>
                    ))}
                  </div>
                  {(wodFormat === 'Autre' || WOD_FORMATS_EXTRA.includes(wodFormat)) && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-[color:var(--track)]">
                      {WOD_FORMATS_EXTRA.map(f => (
                        <button key={f} onClick={() => setWodFormat(f === wodFormat ? 'Autre' : f)}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                            wodFormat === f
                              ? 'bg-[var(--theme-primary)] border-[color:var(--theme-primary)] text-white'
                              : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]'
                          }`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {TIMED_FORMATS.includes(wodFormat) && (
                  <div>
                    <label className={labelCls}>Durée</label>
                    <div className="flex flex-wrap gap-2">
                      {DURATION_CHIPS.map(d => (
                        <button key={d} onClick={() => setWodTimeCap(wodTimeCap === String(d) ? '' : String(d))}
                          className={`px-3 py-2 rounded-xl border font-bold text-sm transition ${wodTimeCap === String(d) ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]'}`}>
                          {d}&apos;
                        </button>
                      ))}
                      <input type="number" placeholder="autre"
                        value={DURATION_CHIPS.includes(parseInt(wodTimeCap)) ? '' : wodTimeCap}
                        onChange={e => setWodTimeCap(e.target.value)}
                        className="w-20 rounded-xl border border-[color:var(--muted)] bg-[var(--card)] px-2 py-2 text-sm text-[var(--ink)] text-center focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                    </div>
                  </div>
                )}
              </div>

              {/* ② Description */}
              <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4">
                <label className={labelCls}>② Mouvements du WOD</label>
                <input
                  type="text" placeholder="Chercher un mouvement..." value={wodMoveSearch}
                  onChange={e => setWodMoveSearch(e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)] mb-2" />
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {COMMON_MOVES.filter(m => m.toLowerCase().includes(wodMoveSearch.toLowerCase())).map(m => (
                    <button key={m} onClick={() => { setWodDesc(d => d ? d + '\n' + m : m); setWodMoveSearch('') }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border border-[color:var(--border)] bg-[var(--card)] text-[var(--sub)] hover:border-[color:var(--theme-primary)] hover:text-[color:var(--theme-primary)] transition cursor-pointer">
                      + {m}
                    </button>
                  ))}
                  {COMMON_MOVES.filter(m => m.toLowerCase().includes(wodMoveSearch.toLowerCase())).length === 0 && wodMoveSearch && (
                    <button onClick={() => { setWodDesc(d => d ? d + '\n' + wodMoveSearch : wodMoveSearch); setWodMoveSearch('') }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border border-[color:var(--theme-primary)] bg-[var(--accent-soft)] text-[var(--accent-text)] transition cursor-pointer">
                      + Ajouter «{wodMoveSearch}»
                    </button>
                  )}
                </div>
                <textarea rows={7} value={wodDesc} onChange={e => setWodDesc(e.target.value)}
                  placeholder={
                    wodFormat === 'AMRAP'    ? `AMRAP ${wodTimeCap || '15'}'\n21 Thrusters 43kg\n21 Pull-ups\n21 Box Jumps 60cm` :
                    wodFormat === 'EMOM'     ? `EMOM ${wodTimeCap || '12'}\nMin paire : 10 KB Swings 24kg\nMin impaire : 15 Squats` :
                    wodFormat === 'For Time' ? `For Time (cap ${wodTimeCap || '20'}')\n3 rounds :\n21 Thrusters 43kg\n21 Pull-ups` :
                    wodFormat === 'Rounds'   ? `5 rounds :\n10 Deadlift 100kg\n15 Burpees\n20 Box Jumps` :
                    wodFormat === 'Tabata'   ? `Tabata ${wodTimeCap || '20'}/10\nMouvement 1\nMouvement 2` :
                    '3 rounds :\n15 Thrusters 43kg\n15 Pull-ups\n15 Box Jumps 60cm'
                  }
                  className={inputCls + ' resize-none'} />
              </div>

              {/* ③ Résultat + RX */}
              <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 space-y-3">
                <label className={labelCls}>③ Résultat</label>
                <input type="text" value={wodResult} onChange={e => setWodResult(e.target.value)}
                  placeholder={
                    wodFormat === 'AMRAP'    ? 'Rounds + reps  ex : 4 rounds + 12 reps' :
                    wodFormat === 'For Time' ? 'Temps  ex : 12\'35"' :
                    wodFormat === 'EMOM'     ? 'ex : Complété / Raté min 9' :
                    'Score, temps ou reps...'
                  }
                  className={inputCls} />
                {/* RX/Scaled is a CrossFit concept — only show it there (ST-71) */}
                {isCrossfit && (
                  <div className="flex gap-2">
                    {[
                      { v: true,  l: '✓ RX',   a: 'border-green-400 bg-green-50 text-green-700' },
                      { v: false, l: 'Scaled', a: 'border-amber-400 bg-amber-50 text-amber-700' },
                    ].map(o => (
                      <button key={String(o.v)} onClick={() => setWodRx(o.v)}
                        className={`flex-1 py-2.5 rounded-xl border font-bold text-sm transition ${wodRx === o.v ? o.a : 'border-[color:var(--border-strong)] bg-[var(--card)] text-[var(--muted)]'}`}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional autonomous WOD blocks (ST-69) */}
              {extraWods.map((b, i) => (
                <div key={b.id} className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Bloc {i + 2}</label>
                    <button onClick={() => removeExtraWod(b.id)} className="text-[var(--border-strong)] hover:text-red-500 text-xl leading-none px-1">×</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...WOD_FORMATS.filter(f => f !== 'Autre'), ...WOD_FORMATS_EXTRA].map(f => (
                      <button key={f} onClick={() => updExtraWod(b.id, { format: f === b.format ? '' : f })}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${b.format === f ? 'bg-[var(--theme-primary)] border-[color:var(--theme-primary)] text-white' : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                  {TIMED_FORMATS.includes(b.format) && (
                    <input type="number" placeholder="Durée (min)" value={b.timeCap}
                      onChange={e => updExtraWod(b.id, { timeCap: e.target.value })} className={inputCls} />
                  )}
                  <textarea rows={4} value={b.description} onChange={e => updExtraWod(b.id, { description: e.target.value })}
                    placeholder="Mouvements du bloc…" className={inputCls + ' resize-none'} />
                  <input type="text" value={b.result} onChange={e => updExtraWod(b.id, { result: e.target.value })}
                    placeholder="Résultat (score, temps, reps…)" className={inputCls} />
                </div>
              ))}
              <button onClick={addExtraWod}
                className="w-full py-2.5 rounded-xl border border-dashed border-[color:var(--border-strong)] text-sm font-bold text-[var(--sub)] cursor-pointer">
                + Ajouter un bloc
              </button>

            </>)}
          </div>
        )}

        {/* ══ POST ═══════════════════════════════════════ */}
        {curKey === 'post' && (
          <div className="space-y-6">
            {/* RPE */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  RPE — {rpe}/10
                </span>
                <span style={{ color: 'var(--theme-primary, #F97316)', fontSize: 12 }}>· {RPE_LABELS[rpe]}</span>
                <button onClick={() => setShowRpeInfo(v => !v)}
                  style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--border)', color: 'var(--sub)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', border: 'none' }}>
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
                    style={{ height: n === rpe ? '100%' : `${35 + n * 6}%`, background: n <= rpe ? RPE_COLORS[n-1] : 'var(--border)', opacity: n <= rpe ? 1 : 0.4 }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-[var(--muted)] mt-1.5"><span>Très facile</span><span>Maximum</span></div>
            </div>

            {/* Ressenti */}
            <div>
              <label className={labelCls}>Ressenti post-séance</label>
              <div className="flex gap-2">
                {FEELING_LEVELS.map(f => (
                  <button key={f.v} onClick={() => setFeeling(f.v)}
                    className={`flex-1 py-2 rounded-xl border flex flex-col items-center gap-1 transition ${feeling === f.v ? 'border-[color:var(--theme-primary)] bg-[var(--accent-soft)]' : 'border-[color:var(--border)] bg-[var(--card)]'}`}>
                    <span className="text-xl">{f.emoji}</span>
                    <span className={`text-xs font-medium ${feeling === f.v ? 'text-[color:var(--theme-primary)]' : 'text-[var(--muted)]'}`}>{f.label}</span>
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
                <div className="bg-[var(--bg)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-[var(--sub)] mb-1.5">Zone</label>
                    <input list="pain-parts-list" value={painPart} onChange={e => setPainPart(e.target.value)}
                      placeholder="Sélectionne ou tape une zone..."
                      className="w-full rounded-lg border border-[color:var(--muted)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                    <datalist id="pain-parts-list">{PAIN_PARTS.map(p => <option key={p} value={p} />)}</datalist>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--sub)] mb-1.5">Intensité</label>
                    <div className="flex gap-2">
                      {SEVERITY.map(s => (
                        <button key={s.v} onClick={() => setPainSev(s.v)}
                          className={`flex-1 py-2 rounded-lg border text-xs font-bold transition ${painSev === s.v ? s.cls : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--muted)]'}`}>{s.l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setAddingPain(false); setPainPart('') }} className="flex-1 py-2 rounded-lg border border-[color:var(--border)] text-sm text-[var(--sub)]">Annuler</button>
                    <button onClick={addPain} className="flex-1 py-2 rounded-lg text-white text-sm font-bold" style={{ background: 'var(--theme-primary, #F97316)' }}>Ajouter</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingPain(true)}
                  className="w-full py-2.5 border border-dashed border-[color:var(--border-strong)] text-[var(--muted)] rounded-xl text-sm hover:border-[color:var(--theme-primary)] hover:text-[color:var(--theme-primary)] transition">
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
            <button onClick={goBack} className="flex-1 py-3.5 rounded-xl border border-[color:var(--border-strong)] text-sm font-bold text-[var(--ink-soft)] hover:bg-[var(--hover)] transition">← Retour</button>
          )}
          <button onClick={step < STEPS.length - 1 ? goNext : handleSubmit} disabled={saving}
            style={{ flex: 2, background: step === STEPS.length - 1 ? '#22C55E' : 'var(--theme-primary, #F97316)' }}
            className={`py-3.5 rounded-xl text-sm font-bold text-white transition ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}>
            {saving ? 'Sauvegarde...' : step === STEPS.length - 1 ? '✓ Enregistrer' : 'Suivant →'}
          </button>
        </div>

      </div>
    </div>

    {/* ── Dialog: effacer contenu IA après suppression photo ── */}
    {showClearAIDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="bg-[var(--card)] rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <p className="text-base font-black text-[var(--ink)] mb-1">Effacer le contenu généré ?</p>
          <p className="text-sm text-[var(--sub)] mb-5">L'IA avait pré-rempli l'échauffement, les blocs et le WOD. Veux-tu les effacer aussi ?</p>
          <div className="flex gap-3">
            <button onClick={() => setShowClearAIDialog(false)}
              className="flex-1 py-3 rounded-xl border border-[color:var(--border)] text-sm font-bold text-[var(--ink-soft)] hover:bg-[var(--hover)] transition cursor-pointer">
              Garder
            </button>
            <button onClick={() => { clearAIContent(); setShowClearAIDialog(false) }}
              className="flex-1 py-3 rounded-xl bg-red-500 text-sm font-bold text-white hover:bg-red-600 transition cursor-pointer">
              Effacer tout
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
