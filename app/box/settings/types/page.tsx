'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrganization, updateOrgSessionTypes, DEFAULT_SESSION_TYPES, DEFAULT_DURATION_MIN, DEFAULT_CAPACITY, type SessionType } from '@/lib/orgs'
import { toast } from '@/lib/toast'
import { PageHeader, Card, Field, Button, ui } from '@/components/ui'

export default function SessionTypesPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner'
  const [types, setTypes] = useState<SessionType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const info = await getOrganization(orgId)
    setTypes(info.sessionTypes.length > 0 ? info.sessionTypes : DEFAULT_SESSION_TYPES)
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const addType = () => setTypes(t => [...t, { name: '', defaultDurationMin: DEFAULT_DURATION_MIN, defaultCapacity: DEFAULT_CAPACITY }])
  const updType = (i: number, patch: Partial<SessionType>) => setTypes(t => t.map((x, j) => j === i ? { ...x, ...patch } : x))

  const save = async () => {
    if (!orgId) return
    const clean = types
      .filter(t => t.name.trim())
      .map(t => ({ name: t.name.trim(), defaultDurationMin: t.defaultDurationMin || 60, defaultCapacity: t.defaultCapacity || 1 }))
    setSaving(true)
    try { await updateOrgSessionTypes(orgId, clean); setTypes(clean); toast.success('Réglages enregistrés') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setSaving(false)
  }

  if (!org) return null

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <PageHeader title="Types de séances" subtitle="Pré-remplissent le planning" backHref="/box/settings" />

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Chargement…</p>
        ) : (
          <div className="space-y-3">
            {types.map((t, i) => (
              <Card key={i} className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input className={`${ui.field} flex-1`} placeholder="Nom (WOD, Haltéro, Open gym…)"
                    value={t.name} disabled={!canEdit} onChange={e => updType(i, { name: e.target.value })} />
                  {canEdit && (
                    <button onClick={() => setTypes(arr => arr.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-red-500 text-xl px-1 cursor-pointer">×</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Durée (min)">
                    <input type="number" min={15} step={15} className={ui.field} value={t.defaultDurationMin} disabled={!canEdit}
                      onChange={e => updType(i, { defaultDurationMin: parseInt(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Places">
                    <input type="number" min={1} className={ui.field} value={t.defaultCapacity} disabled={!canEdit}
                      onChange={e => updType(i, { defaultCapacity: parseInt(e.target.value) || 0 })} />
                  </Field>
                </div>
              </Card>
            ))}
            {types.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucun type pour l’instant.</p>}

            {canEdit && (
              <>
                <button onClick={addType} className="text-sm font-bold cursor-pointer" style={{ color: ui.primary }}>+ Ajouter un type</button>
                <Button full onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
