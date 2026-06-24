'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppContext } from '@/components/AppContext'
import { getOrganization, updateOrgInfo, type OrgProfile } from '@/lib/orgs'
import { toast } from '@/lib/toast'

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400'
const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2'

function BoxProfile() {
  const { active, memberships } = useAppContext()
  const params = useSearchParams()
  const router = useRouter()

  // Target box: the active box context, else ?org=, else the user's first membership.
  const orgId = active.type === 'org' ? active.orgId
    : params.get('org') ?? memberships[0]?.organizationId ?? ''
  const canEdit = memberships.find(m => m.organizationId === orgId)?.role === 'owner'

  const [p, setP] = useState<OrgProfile | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) { router.replace('/'); return }
    try { setP(await getOrganization(orgId)) }
    catch { router.replace('/') }
  }, [orgId, router])

  useEffect(() => { void load() }, [load])

  const upd = (k: keyof OrgProfile, v: string) => setP(prev => prev ? { ...prev, [k]: v } : prev)

  const save = async () => {
    if (!p) return
    setSaving(true)
    try {
      await updateOrgInfo(p.id, {
        name: p.name, description: p.description, address: p.address, phone: p.phone, website: p.website,
      })
      toast.success('Box enregistrée')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
    setSaving(false)
  }

  if (!p) return <div className="text-center text-gray-400 text-sm pt-20">Chargement…</div>

  const rows: { key: keyof OrgProfile; label: string; placeholder: string }[] = [
    { key: 'description', label: 'Description', placeholder: 'Box CrossFit au cœur de Lyon…' },
    { key: 'address',     label: 'Adresse',     placeholder: '12 rue du Sport, 69000 Lyon' },
    { key: 'phone',       label: 'Téléphone',   placeholder: '04 12 34 56 78' },
    { key: 'website',     label: 'Site web',    placeholder: 'https://…' },
  ]

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Infos de la box</h1>
            <p className="text-sm text-gray-400 mt-0.5">{canEdit ? 'Modifiable' : 'Lecture seule'}</p>
          </div>
          <button onClick={() => router.back()} className="text-sm font-semibold text-gray-400">Retour</button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className={labelCls}>Nom</label>
            <input className={inputCls} value={p.name} disabled={!canEdit}
              onChange={e => upd('name', e.target.value)} />
          </div>
          {rows.map(r => (
            <div key={r.key}>
              <label className={labelCls}>{r.label}</label>
              <input className={inputCls} value={p[r.key] as string} disabled={!canEdit}
                placeholder={r.placeholder} onChange={e => upd(r.key, e.target.value)} />
            </div>
          ))}
        </div>

        {canEdit && (
          <button onClick={save} disabled={saving}
            className="w-full mt-4 py-4 rounded-2xl text-white font-black text-base disabled:opacity-50"
            style={{ background: 'var(--theme-primary, #F97316)' }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function BoxProfilePage() {
  return <Suspense><BoxProfile /></Suspense>
}
