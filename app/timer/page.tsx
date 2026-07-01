'use client'
import { useEffect, useRef, useState } from 'react'
import { PageHeader, Card, Field } from '@/components/ui'

// ST-107 (CA-06) In-app workout timer v1 — For Time / AMRAP / EMOM / Tabata /
// Intervals. Fully client-side (no persistence). Beeps via Web Audio.

type Mode = 'fortime' | 'amrap' | 'emom' | 'tabata' | 'intervals'
const MODES: [Mode, string][] = [['fortime', 'For Time'], ['amrap', 'AMRAP'], ['emom', 'EMOM'], ['tabata', 'Tabata'], ['intervals', 'Intervals']]

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

// Derived timer state for a given elapsed time (ms).
type Derived = { big: number; label: string; round: string; finished: boolean; work: boolean; beepKey: string }

function derive(mode: Mode, c: Config, elapsedMs: number): Derived {
  const t = Math.floor(elapsedMs / 1000)
  if (mode === 'fortime') {
    const cap = c.capSec
    const fin = cap > 0 && t >= cap
    return { big: fin ? cap : t, label: cap > 0 ? `Cap ${mmss(cap)}` : 'For Time', round: '', finished: fin, work: true, beepKey: fin ? 'end' : '' }
  }
  if (mode === 'amrap') {
    const rem = c.durSec - t
    const fin = rem <= 0
    return { big: Math.max(0, rem), label: `AMRAP ${mmss(c.durSec)}`, round: '', finished: fin, work: true, beepKey: fin ? 'end' : (rem <= 3 ? `cd${rem}` : '') }
  }
  if (mode === 'emom') {
    const total = c.intervalSec * c.rounds
    const fin = t >= total
    const idx = Math.min(Math.floor(t / c.intervalSec), c.rounds - 1)
    const rem = c.intervalSec - (t % c.intervalSec)
    return { big: fin ? 0 : rem, label: `EMOM ${mmss(c.intervalSec)}`, round: `Round ${Math.min(idx + 1, c.rounds)}/${c.rounds}`, finished: fin, work: true, beepKey: fin ? 'end' : `m${idx}` }
  }
  // tabata / intervals
  const cycle = c.workSec + c.restSec
  const total = cycle * c.rounds
  const fin = t >= total
  const cycleIdx = Math.min(Math.floor(t / cycle), c.rounds - 1)
  const pos = t % cycle
  const isWork = pos < c.workSec
  const rem = isWork ? c.workSec - pos : cycle - pos
  return {
    big: fin ? 0 : rem, label: isWork ? 'WORK' : 'REST',
    round: `Round ${Math.min(cycleIdx + 1, c.rounds)}/${c.rounds}`,
    finished: fin, work: isWork, beepKey: fin ? 'end' : `${cycleIdx}-${isWork ? 'w' : 'r'}`,
  }
}

type Config = { capSec: number; durSec: number; intervalSec: number; rounds: number; workSec: number; restSec: number }
const DEFAULTS: Config = { capSec: 0, durSec: 720, intervalSec: 60, rounds: 10, workSec: 20, restSec: 10 }

function beep(freq = 880, dur = 150) {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    const ctx = new Ctx()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = freq; g.gain.value = 0.18
    o.start(); o.stop(ctx.currentTime + dur / 1000)
    setTimeout(() => ctx.close(), dur + 60)
  } catch { /* audio not available */ }
}

// mm:ss input
function TimeInput({ value, onChange, disabled }: { value: number; onChange: (s: number) => void; disabled?: boolean }) {
  return (
    <input className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-2.5 text-center text-lg font-black text-[var(--ink)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]"
      value={mmss(value)} disabled={disabled} inputMode="numeric"
      onChange={e => {
        const m = e.target.value.match(/^(\d+):?([0-5]?\d)?$/)
        if (!m) return
        onChange(parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0))
      }} />
  )
}
function NumInput({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <input type="number" min={1} className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-2.5 text-center text-lg font-black text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]"
      value={value || ''} disabled={disabled} onChange={e => onChange(Math.max(1, parseInt(e.target.value) || 1))} />
  )
}

export default function TimerPage() {
  const [mode, setMode] = useState<Mode>('amrap')
  const [cfg, setCfg] = useState<Config>(DEFAULTS)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const startRef = useRef(0)      // timestamp of current run start
  const accRef = useRef(0)        // accumulated ms before current run
  const lastBeep = useRef('')

  // Tick loop
  useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    const id = setInterval(() => setElapsed(accRef.current + (Date.now() - startRef.current)), 50)
    return () => clearInterval(id)
  }, [running])

  const d = derive(mode, cfg, elapsed)

  // Beeps on boundary changes + auto-stop at finish.
  useEffect(() => {
    if (!running) return
    if (d.beepKey && d.beepKey !== lastBeep.current) {
      lastBeep.current = d.beepKey
      if (d.finished) { beep(1200, 400); setRunning(false); accRef.current = elapsed }
      else if (d.beepKey.startsWith('cd')) beep(700, 120)
      else beep(d.work ? 880 : 500, 160)
    }
  }, [d.beepKey, d.finished, running, d.work, elapsed])

  const toggle = () => {
    if (running) { accRef.current = elapsed; setRunning(false) }
    else { if (d.finished) { accRef.current = 0; setElapsed(0); lastBeep.current = '' } setRunning(true) }
  }
  const reset = () => { setRunning(false); accRef.current = 0; setElapsed(0); lastBeep.current = '' }
  const setC = (patch: Partial<Config>) => setCfg(c => ({ ...c, ...patch }))
  const locked = running || elapsed > 0   // don't change config mid-run

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <PageHeader title="Timer" subtitle="For Time · AMRAP · EMOM · Tabata" backHref="/" />

        {/* Mode */}
        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {MODES.map(([m, label]) => (
            <button key={m} onClick={() => { if (!locked) { setMode(m); reset() } }} disabled={locked && mode !== m}
              className="py-2 rounded-xl text-[11px] font-black cursor-pointer disabled:opacity-40"
              style={mode === m ? { background: 'var(--theme-primary)', color: '#fff' } : { background: 'var(--card)', color: 'var(--sub)', border: '1px solid var(--border)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Display */}
        <Card className="p-6 mb-4 text-center" >
          {d.round && <p className="text-sm font-bold text-[var(--sub)] mb-1">{d.round}</p>}
          <p className="text-7xl font-black tabular-nums leading-none"
            style={{ color: d.finished ? 'var(--theme-primary)' : (mode === 'tabata' || mode === 'intervals') ? (d.work ? 'var(--ink)' : 'var(--muted)') : 'var(--ink)' }}>
            {mmss(d.big)}
          </p>
          <p className="text-sm font-black uppercase tracking-widest mt-2"
            style={{ color: d.finished ? 'var(--theme-primary)' : d.work ? 'var(--sub)' : 'var(--muted)' }}>
            {d.finished ? 'Terminé 🎉' : d.label}
          </p>
        </Card>

        {/* Controls */}
        <div className="flex gap-2 mb-6">
          <button onClick={toggle}
            className="flex-1 py-4 rounded-2xl text-white text-base font-black cursor-pointer"
            style={{ background: running ? '#EF4444' : 'var(--theme-primary)' }}>
            {running ? 'Pause' : elapsed > 0 && !d.finished ? 'Reprendre' : 'Démarrer'}
          </button>
          <button onClick={reset}
            className="px-6 py-4 rounded-2xl text-sm font-black cursor-pointer"
            style={{ background: 'var(--secondary-bg)', color: 'var(--secondary-fg)' }}>
            Reset
          </button>
        </div>

        {/* Config (locked during a run) */}
        <Card className="p-4 space-y-3">
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">Réglages</p>
          {mode === 'fortime' && (
            <Field label="Time cap (0 = aucun)"><TimeInput value={cfg.capSec} disabled={locked} onChange={v => setC({ capSec: v })} /></Field>
          )}
          {mode === 'amrap' && (
            <Field label="Durée"><TimeInput value={cfg.durSec} disabled={locked} onChange={v => setC({ durSec: v })} /></Field>
          )}
          {mode === 'emom' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Intervalle"><TimeInput value={cfg.intervalSec} disabled={locked} onChange={v => setC({ intervalSec: v })} /></Field>
              <Field label="Rounds"><NumInput value={cfg.rounds} disabled={locked} onChange={v => setC({ rounds: v })} /></Field>
            </div>
          )}
          {(mode === 'tabata' || mode === 'intervals') && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Work"><TimeInput value={cfg.workSec} disabled={locked} onChange={v => setC({ workSec: v })} /></Field>
              <Field label="Rest"><TimeInput value={cfg.restSec} disabled={locked} onChange={v => setC({ restSec: v })} /></Field>
              <Field label="Rounds"><NumInput value={cfg.rounds} disabled={locked} onChange={v => setC({ rounds: v })} /></Field>
            </div>
          )}
          {mode === 'tabata' && (
            <button onClick={() => setC({ workSec: 20, restSec: 10, rounds: 8 })} disabled={locked}
              className="text-xs font-bold text-[var(--sub)] disabled:opacity-40 cursor-pointer">↺ Tabata classique (20/10 × 8)</button>
          )}
          {locked && <p className="text-[11px] text-[var(--muted)]">Réglages verrouillés — Reset pour modifier.</p>}
        </Card>
      </div>
    </div>
  )
}
