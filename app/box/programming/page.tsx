'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getProgramming, upsertProgramming, emptyProgramming, type Programming } from '@/lib/programming'
import ImagePicker from '@/components/ImagePicker'
import { toast } from '@/lib/toast'
import { PageHeader, Card, Field, Button, DatePicker, ui } from '@/components/ui'

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
      <div className="max-w-lg mx-auto px-4 pb-10">
        <PageHeader title="Programmation" subtitle="Le WOD du jour, visible par tes membres" backHref="/" />

        {canEdit && (
          <div className="flex justify-end mb-3">
            {/* Foundations for CSV/Excel import (ST-96) — mapped to classes. Stub for now. */}
            <Button variant="secondary" onClick={() => toast.info('Import CSV/Excel — bientôt disponible')}>
              ⬆︎ Importer
            </Button>
          </div>
        )}

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
              <Field label="Notes (option.)">
                <textarea rows={2} className={ui.field} value={p.notes} disabled={!canEdit}
                  placeholder="Scaling, conseils…" onChange={e => upd({ notes: e.target.value })} />
              </Field>
            </Card>

            {canEdit && <Button full onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Publier la programmation'}</Button>}
          </div>
        )}
      </div>
    </div>
  )
}
