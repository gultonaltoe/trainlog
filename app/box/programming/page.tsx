'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getProgramming, upsertProgramming, emptyProgramming, type Programming } from '@/lib/programming'
import { getOrganization, updateProgrammingSettings, DEFAULT_PROGRAMMING_SETTINGS, type ProgrammingSettings } from '@/lib/orgs'
import { toast } from '@/lib/toast'
import { PageHeader, Card, Field, Button, DatePicker, TimePicker, Segmented, ui } from '@/components/ui'

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
  const [vis, setVis] = useState<ProgrammingSettings>(DEFAULT_PROGRAMMING_SETTINGS)
  const [visSaving, setVisSaving] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try { setP((await getProgramming(orgId, date)) ?? emptyProgramming(date)) }
    catch { setP(emptyProgramming(date)) }
    setLoading(false)
  }, [orgId, date])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (orgId) getOrganization(orgId).then(o => setVis(o.programming)).catch(() => {}) }, [orgId])

  const saveVis = async () => {
    if (!orgId) return
    setVisSaving(true)
    try { await updateProgrammingSettings(orgId, vis); toast.success('Visibilité enregistrée') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setVisSaving(false)
  }

  const upd = (patch: Partial<Programming>) => setP(prev => ({ ...prev, ...patch }))

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
          <Card className="p-4 mb-4 space-y-3">
            <Field label="Visibilité du WOD pour les membres">
              <Segmented<'before' | 'after'> value={vis.wodVisibility}
                onChange={v => setVis(s => ({ ...s, wodVisibility: v }))}
                options={[['before', 'Avant le cours'], ['after', 'À partir d’une heure']]} />
            </Field>
            {vis.wodVisibility === 'after' && (
              <Field label="Dévoilé à partir de" hint="Les membres ne voient le WOD qu’après cette heure.">
                <TimePicker value={vis.revealTime} onChange={t => setVis(s => ({ ...s, revealTime: t }))} />
              </Field>
            )}
            <Button variant="secondary" onClick={saveVis} disabled={visSaving}>{visSaving ? '…' : 'Enregistrer la visibilité'}</Button>
          </Card>
        )}

        <div className="mb-4">
          <Field label="Jour"><DatePicker value={date} onChange={setDate} /></Field>
        </div>

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
