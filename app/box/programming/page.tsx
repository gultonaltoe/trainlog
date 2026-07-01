'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getProgramming, getProgrammingRange, upsertProgramming, emptyProgramming, type Programming } from '@/lib/programming'
import { SCORE_TYPE_OPTIONS, type ScoreType } from '@/lib/leaderboard'
import ImagePicker from '@/components/ImagePicker'
import { toast } from '@/lib/toast'
import { PageHeader, Card, Field, Button, DatePicker, Select, ui } from '@/components/ui'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ST-34 P1 — owner/coach publishes the day's programming ("WOD du jour").
export default function ProgrammingPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner' || org?.role === 'coach'
  const [date, setDate] = useState(() => iso(new Date()))
  const [p, setP] = useState<Programming>(() => emptyProgramming(iso(new Date())))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'week' | 'day'>('week')

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try { setP((await getProgramming(orgId, date)) ?? emptyProgramming(date)) }
    catch { setP(emptyProgramming(date)) }
    setLoading(false)
  }, [orgId, date])
  useEffect(() => { void load() }, [load])

  const upd = (patch: Partial<Programming>) => setP(prev => ({ ...prev, ...patch }))

  // P1.5 — prefill the form by analysing a whiteboard photo (reuses /api/analyze-wod).
  const [analyzing, setAnalyzing] = useState(false)
  const analyzePhoto = async (file: File) => {
    setAnalyzing(true)
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
      })
      const resp = await fetch('/api/analyze-wod', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl.split(',')[1], mediaType: file.type || 'image/jpeg' }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) throw new Error('Analyse impossible — réessaie ou saisis à la main')
      setP(prev => ({
        ...prev,
        warmup: data.warmup ?? prev.warmup,
        strength: data.strength_notes ?? prev.strength,
        wodFormat: data.format ?? prev.wodFormat,
        timeCapMin: data.time_cap ?? prev.timeCapMin,
        wodDescription: data.description ?? prev.wodDescription,
      }))
      toast.success('Programmation pré-remplie depuis la photo')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setAnalyzing(false)
  }

  const save = async () => {
    if (!orgId) return
    setSaving(true)
    try { await upsertProgramming(orgId, { ...p, date }); toast.success('Programmation enregistrée') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setSaving(false)
  }

  if (!org) return null

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className={`${view === 'week' ? 'max-w-5xl' : 'max-w-lg'} mx-auto px-4 pb-10`}>
        <PageHeader title="Programmation" subtitle="Le WOD du jour, visible par tes membres" backHref="/" />

        <div className="flex items-center gap-2 mb-4">
          <div className="flex flex-1 rounded-xl overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-sm font-bold">
            {([['week', 'Semaine'], ['day', 'Jour']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} className="flex-1 py-2.5 cursor-pointer"
                style={view === v ? { background: 'var(--ink)', color: 'var(--card)' } : { color: 'var(--sub)' }}>{label}</button>
            ))}
          </div>
          {canEdit && (
            /* Foundations for CSV/Excel import (ST-96) — mapped to classes. Stub for now. */
            <Button variant="secondary" onClick={() => toast.info('Import CSV/Excel — bientôt disponible')}>⬆︎ Importer</Button>
          )}
        </div>

        {view === 'week' ? (
          <WeekBoard orgId={orgId!} canEdit={canEdit} onPick={d => { setDate(d); setView('day') }} />
        ) : (<>

        <div className="mb-4">
          <Field label="Jour"><DatePicker value={date} onChange={setDate} /></Field>
        </div>

        {canEdit && (
          <div className="mb-4">
            <ImagePicker onPick={analyzePhoto} disabled={analyzing} capture="environment">
              {open => (
                <button onClick={open} disabled={analyzing}
                  className="ds-hover w-full py-3 rounded-2xl border border-dashed border-[color:var(--border-strong)] text-sm font-bold text-[var(--ink-soft)] disabled:opacity-50">
                  {analyzing ? 'Analyse…' : '📷 Pré-remplir depuis une photo du tableau'}
                </button>
              )}
            </ImagePicker>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
        ) : (
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <Field label="Titre" hint="Ex : « Murph » ou « Force + Métcon »">
                <input className={ui.field} value={p.title} disabled={!canEdit}
                  placeholder="Titre de la séance" onChange={e => upd({ title: e.target.value })} />
              </Field>
              <Field label="Échauffement">
                <textarea rows={2} className={ui.field} value={p.warmup} disabled={!canEdit}
                  placeholder="2 tours : 10 air squats, 10 PJ…" onChange={e => upd({ warmup: e.target.value })} />
              </Field>
              <Field label="Force / Skill">
                <textarea rows={2} className={ui.field} value={p.strength} disabled={!canEdit}
                  placeholder="Back Squat 5x3 @80%…" onChange={e => upd({ strength: e.target.value })} />
              </Field>
            </Card>

            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Format" hint="AMRAP, For Time…">
                  <input className={ui.field} value={p.wodFormat} disabled={!canEdit}
                    placeholder="AMRAP 15" onChange={e => upd({ wodFormat: e.target.value })} />
                </Field>
                <Field label="Time cap (min)">
                  <input type="number" min={0} className={ui.field} value={p.timeCapMin ?? ''} disabled={!canEdit}
                    placeholder="—" onChange={e => upd({ timeCapMin: e.target.value === '' ? null : parseInt(e.target.value) || 0 })} />
                </Field>
              </div>
              <Field label="WOD / Metcon">
                <textarea rows={4} className={ui.field} value={p.wodDescription} disabled={!canEdit}
                  placeholder={'21-15-9\nThrusters 43kg\nPull-ups'} onChange={e => upd({ wodDescription: e.target.value })} />
              </Field>
              <Field label="Type de score (classement)" hint="Active le classement du jour. Temps = le plus rapide gagne ; Reps/Charge/Rounds = le plus élevé gagne.">
                <Select<ScoreType> value={p.scoreType ?? ''} disabled={!canEdit}
                  placeholder="Aucun classement"
                  onChange={v => upd({ scoreType: v })}
                  options={SCORE_TYPE_OPTIONS.map(([value, label]) => ({ value, label }))} />
              </Field>
              <Field label="Notes (option.)">
                <textarea rows={2} className={ui.field} value={p.notes} disabled={!canEdit}
                  placeholder="Scaling, conseils…" onChange={e => upd({ notes: e.target.value })} />
              </Field>
            </Card>

            {canEdit && <Button full onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Publier la programmation'}</Button>}
          </div>
        )}
        </>)}
      </div>
    </div>
  )
}

// ── Week board (ST-124) — the week at a glance, colored blocks per day. ──────
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const mondayOf = (d: Date) => { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); m.setHours(0, 0, 0, 0); return m }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(d.getDate() + n); return x }

function blocksOf(p: Programming): { label: string; text: string; bg: string; fg: string }[] {
  const b: { label: string; text: string; bg: string; fg: string }[] = []
  if (p.warmup) b.push({ label: 'Warm-up', text: p.warmup, bg: '#FEF3C7', fg: '#92400E' })
  if (p.strength) b.push({ label: 'Force / Skill', text: p.strength, bg: '#EDE9FE', fg: '#5B21B6' })
  if (p.wodFormat || p.wodDescription) b.push({ label: 'WOD' + (p.wodFormat ? ` · ${p.wodFormat}` : ''), text: p.wodDescription, bg: '#DBEAFE', fg: '#1E40AF' })
  if (p.notes) b.push({ label: 'Notes', text: p.notes, bg: '#F1F5F9', fg: '#334155' })
  return b
}

function WeekBoard({ orgId, canEdit, onPick }: { orgId: string; canEdit: boolean; onPick: (iso: string) => void }) {
  const [anchor, setAnchor] = useState(() => new Date())
  const monday = mondayOf(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const fromISO = iso(days[0]); const toISO = iso(days[6])
  const [map, setMap] = useState<Record<string, Programming>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true; setLoading(true)
    getProgrammingRange(orgId, fromISO, toISO)
      .then(rows => { if (!alive) return; const m: Record<string, Programming> = {}; rows.forEach(r => { m[r.date] = r }); setMap(m); setLoading(false) })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [orgId, fromISO, toISO])

  const todayISO = iso(new Date())
  const label = `${days[0].getDate()} – ${days[6].getDate()} ${days[6].toLocaleDateString('fr-FR', { month: 'long' })}`

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setAnchor(a => addDays(a, -7))} className="ds-hover w-9 h-9 rounded-xl border border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]">‹</button>
        <div className="text-center">
          <p className="text-sm font-black text-[var(--ink)] capitalize">{label}</p>
          <button onClick={() => setAnchor(new Date())} className="text-[11px] font-bold text-[var(--sub)] cursor-pointer">Aujourd’hui</button>
        </div>
        <button onClick={() => setAnchor(a => addDays(a, 7))} className="ds-hover w-9 h-9 rounded-xl border border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]">›</button>
      </div>
      {loading ? <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p> : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          {days.map((d, i) => {
            const ds = iso(d); const p = map[ds]; const blocks = p ? blocksOf(p) : []; const isToday = ds === todayISO
            return (
              <div key={ds} onClick={() => canEdit && onPick(ds)}
                className={`flex-shrink-0 w-[168px] rounded-2xl border bg-[var(--card)] p-2.5 ${canEdit ? 'cursor-pointer ds-hover' : ''}`}
                style={{ borderColor: isToday ? 'var(--theme-primary)' : 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black text-[var(--ink)]">{WEEKDAYS[i]} {d.getDate()}</p>
                  {isToday && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--theme-primary)' }} />}
                </div>
                {blocks.length === 0 ? (
                  <p className="text-[11px] text-[var(--border-strong)] py-4 text-center">{canEdit ? '+ Ajouter' : '—'}</p>
                ) : (
                  <div className="space-y-1.5">
                    {p?.title && <p className="text-[11px] font-black text-[var(--ink)] truncate">{p.title}</p>}
                    {blocks.map((b, bi) => (
                      <div key={bi} className="rounded-lg px-2 py-1.5" style={{ background: b.bg }}>
                        <p className="text-[9px] font-black uppercase tracking-wide" style={{ color: b.fg }}>{b.label}</p>
                        <p className="text-[11px] leading-snug whitespace-pre-line line-clamp-4" style={{ color: b.fg }}>{b.text}</p>
                      </div>
                    ))}
                    {p?.scoreType && <p className="text-[9px] font-bold" style={{ color: 'var(--theme-primary)' }}>🏆 Classé</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
