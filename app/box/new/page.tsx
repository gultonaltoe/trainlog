'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOrganization } from '@/lib/orgs'
import { useAppContext } from '@/components/AppContext'
import { toast } from '@/lib/toast'

export default function NewBoxPage() {
  const router = useRouter()
  const { refresh, setActive } = useAppContext()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const orgId = await createOrganization(name)
      await refresh()
      setActive({ type: 'org', orgId, orgName: name.trim(), role: 'owner' })
      toast.success('Box créé 🎉')
      router.push('/')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
        <button onClick={() => router.back()}
          className="self-start mb-8 text-sm font-semibold text-gray-400 hover:text-gray-600">← Retour</button>

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏢</div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Créer ton box</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Tu en seras le propriétaire. Tu pourras ensuite inviter des coachs et des membres.
          </p>
        </div>

        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Nom du box</label>
        <input type="text" value={name} autoFocus
          placeholder="CrossFit Lyon"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />

        <button onClick={submit} disabled={saving || !name.trim()}
          className="mt-6 w-full py-4 rounded-2xl text-white font-black text-base transition"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', opacity: saving || !name.trim() ? 0.5 : 1 }}>
          {saving ? 'Création...' : 'Créer le box →'}
        </button>
      </div>
    </div>
  )
}
