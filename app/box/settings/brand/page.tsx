'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrganization, updateOrgBranding, DEFAULT_BRAND, type OrgBrand } from '@/lib/orgs'
import { toast } from '@/lib/toast'
import { PageHeader, Card, Field, Button, ui } from '@/components/ui'

export default function BrandSettingsPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner'
  const [brand, setBrand] = useState<OrgBrand>(DEFAULT_BRAND)
  const [policy, setPolicy] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const info = await getOrganization(orgId)
    setBrand(info.brand)
    setPolicy(info.cancellationPolicy)
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      await updateOrgBranding(orgId, { logoUrl: brand.logoUrl.trim(), brandColor: brand.brandColor.trim() }, policy.trim())
      toast.success('Marque enregistrée')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setSaving(false)
  }

  if (!org) return null

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <PageHeader title="Marque & politique" subtitle="Visibles par tes membres" backHref="/box/settings" />

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
        ) : (
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <Field label="Logo (URL)">
                <input type="url" className={ui.field} value={brand.logoUrl} disabled={!canEdit}
                  placeholder="https://…/logo.png"
                  onChange={e => setBrand(b => ({ ...b, logoUrl: e.target.value }))} />
              </Field>
              {brand.logoUrl.trim() && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={brand.logoUrl} alt="Logo" className="h-12 w-auto rounded-lg border border-[color:var(--track)]" />
              )}
              <Field label="Couleur de marque">
                <div className="flex items-center gap-2">
                  <input type="color" disabled={!canEdit} value={brand.brandColor || '#F97316'}
                    onChange={e => setBrand(b => ({ ...b, brandColor: e.target.value }))}
                    className="h-10 w-12 rounded-lg border border-[color:var(--border-strong)] bg-[var(--card)] flex-shrink-0" />
                  <input type="text" className={ui.field} value={brand.brandColor} disabled={!canEdit}
                    placeholder="#F97316 (vide = orange par défaut)"
                    onChange={e => setBrand(b => ({ ...b, brandColor: e.target.value }))} />
                </div>
              </Field>
            </Card>

            <Card className="p-4">
              <Field label="Politique d’annulation / no-show" hint="Affichée aux membres au moment de réserver.">
                <textarea rows={3} className={ui.field} value={policy} disabled={!canEdit}
                  placeholder="Ex : annulation gratuite jusqu’à 2h avant. Au-delà, le cours est décompté."
                  onChange={e => setPolicy(e.target.value)} />
              </Field>
            </Card>

            {canEdit && <Button full onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>}
          </div>
        )}
      </div>
    </div>
  )
}
