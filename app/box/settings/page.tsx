'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrganization, updateOrgSessionTypes, type SessionType, DEFAULT_DURATION_MIN, DEFAULT_CAPACITY } from '@/lib/orgs'
import { toast } from '@/lib/toast'

const fieldCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function BoxSettingsPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner'
  const [types, setTypes] = useState<SessionType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const info = await getOrganization(orgId)
    setTypes(info.sessionTypes)
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
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Réglages</h1>
          <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
        </div>

        <Link href="/box/profile"
          className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-4 mb-5 hover:shadow-sm transition">
          <div className="flex items-center gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Infos de la box</p>
              <p className="text-xs text-gray-400">Nom, adresse, contact</p>
            </div>
          </div>
          <span className="text-gray-300">›</span>
        </Link>

        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Types de séances</p>
        <p className="text-xs text-gray-400 mb-3">Définis tes types de cours avec durée et places par défaut. Ils pré-remplissent le planning.</p>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>
        ) : (
          <div className="space-y-2">
            {types.map((t, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input className={`${fieldCls} flex-1`} placeholder="Nom (WOD, Haltéro, Open gym…)"
                    value={t.name} disabled={!canEdit} onChange={e => updType(i, { name: e.target.value })} />
                  {canEdit && (
                    <button onClick={() => setTypes(arr => arr.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-red-500 text-xl px-1">×</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-gray-400 block">Durée (min)
                    <input type="number" min={15} step={15} className={fieldCls} value={t.defaultDurationMin} disabled={!canEdit}
                      onChange={e => updType(i, { defaultDurationMin: parseInt(e.target.value) || 0 })} />
                  </label>
                  <label className="text-[11px] text-gray-400 block">Places
                    <input type="number" min={1} className={fieldCls} value={t.defaultCapacity} disabled={!canEdit}
                      onChange={e => updType(i, { defaultCapacity: parseInt(e.target.value) || 0 })} />
                  </label>
                </div>
              </div>
            ))}
            {types.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun type pour l’instant.</p>}
          </div>
        )}

        {canEdit && (
          <>
            <button onClick={addType} className="mt-3 text-sm font-bold text-orange-600">+ Ajouter un type</button>
            <button onClick={save} disabled={saving}
              className="w-full mt-4 py-3.5 rounded-2xl text-white font-black text-base disabled:opacity-50"
              style={{ background: 'var(--theme-primary, #F97316)' }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
