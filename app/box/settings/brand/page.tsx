'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrganization, updateOrgBranding, DEFAULT_BRAND, type OrgBrand } from '@/lib/orgs'
import { uploadBoxLogo } from '@/lib/storage'
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
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onPickLogo = async (file: File | undefined) => {
    if (!file || !orgId) return
    setUploading(true)
    try {
      const url = await uploadBoxLogo(orgId, file)
      setBrand(b => ({ ...b, logoUrl: url }))
      toast.success('Logo téléversé — pense à enregistrer')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setUploading(false)
  }

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
              <Field label="Logo">
                <div className="flex items-center gap-3">
                  {brand.logoUrl.trim() ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={brand.logoUrl} alt="Logo" className="h-14 w-14 rounded-xl object-cover border border-[color:var(--border)] flex-shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-[var(--track)] flex items-center justify-center text-xl flex-shrink-0">🏢</div>
                  )}
                  {canEdit && (
                    <div className="flex flex-col gap-1.5">
                      <input ref={fileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => onPickLogo(e.target.files?.[0])} />
                      <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? 'Téléversement…' : brand.logoUrl ? 'Changer le logo' : 'Téléverser un logo'}
                      </Button>
                      {brand.logoUrl && (
                        <button onClick={() => setBrand(b => ({ ...b, logoUrl: '' }))}
                          className="text-xs font-bold text-[var(--muted)] hover:text-red-500 cursor-pointer text-left">Retirer</button>
                      )}
                    </div>
                  )}
                </div>
              </Field>
              {canEdit && (
                <Field label="… ou par URL" hint="Optionnel, si tu héberges déjà ton logo ailleurs.">
                  <input type="url" className={ui.field} value={brand.logoUrl} disabled={!canEdit}
                    placeholder="https://…/logo.png"
                    onChange={e => setBrand(b => ({ ...b, logoUrl: e.target.value }))} />
                </Field>
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
