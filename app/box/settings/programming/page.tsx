'use client'
import { useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrganization, updateProgrammingSettings, DEFAULT_PROGRAMMING_SETTINGS, type ProgrammingSettings } from '@/lib/orgs'
import { toast } from '@/lib/toast'
import { PageHeader, Card, Field, Button, TimePicker, Segmented } from '@/components/ui'

// Box-wide default for when members can see the day's WOD. Moved here from the
// Programming page (it's a default for all classes, not a per-day setting).
export default function ProgrammingSettingsPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner' || org?.role === 'coach'
  const [vis, setVis] = useState<ProgrammingSettings>(DEFAULT_PROGRAMMING_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orgId) return
    getOrganization(orgId).then(o => { setVis(o.programming); setLoading(false) }).catch(() => setLoading(false))
  }, [orgId])

  const save = async () => {
    if (!orgId) return
    setSaving(true)
    try { await updateProgrammingSettings(orgId, vis); toast.success('Visibilité enregistrée') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setSaving(false)
  }

  if (!org) return null

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <PageHeader title="Programmation" subtitle="Visibilité du WOD pour tes membres" backHref="/box/settings" />

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
        ) : (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <Field label="Visibilité du WOD pour les membres" hint="Défaut appliqué à tous les cours.">
                <Segmented<'before' | 'after'> value={vis.wodVisibility}
                  onChange={v => setVis(s => ({ ...s, wodVisibility: v }))}
                  options={[['before', 'Avant le cours'], ['after', 'À partir d’une heure']]} />
              </Field>
              {vis.wodVisibility === 'after' && (
                <Field label="Dévoilé à partir de" hint="Les membres ne voient le WOD qu’après cette heure.">
                  <TimePicker value={vis.revealTime} onChange={t => setVis(s => ({ ...s, revealTime: t }))} />
                </Field>
              )}
            </Card>
            {canEdit && <Button full onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>}
          </div>
        )}
      </div>
    </div>
  )
}
