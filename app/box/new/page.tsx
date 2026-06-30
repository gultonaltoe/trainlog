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
      toast.success('Box créée 🎉')
      router.push('/')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
      setSaving(false)
    }
  }

  return (
    <div className="bg-[var(--card)] flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
        <button onClick={() => router.back()}
          className="self-start mb-8 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink-soft)]">← Retour</button>

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏢</div>
          <h1 className="text-2xl font-black text-[var(--ink)] mb-2">Créer ta box</h1>
          <p className="text-sm text-[var(--sub)] leading-relaxed">
            Tu en seras le propriétaire. Tu pourras ensuite inviter des coachs et des membres.
          </p>
        </div>

        <label className="block text-xs font-bold text-[var(--sub)] uppercase tracking-wide mb-2">Nom de la box</label>
        <input type="text" value={name} autoFocus
          placeholder="CrossFit Lyon"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-3.5 text-[var(--ink)] text-base placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />

        <button onClick={submit} disabled={saving || !name.trim()}
          className="mt-6 w-full py-4 rounded-2xl text-white font-black text-base transition"
          style={{ background: 'var(--theme-primary)', opacity: saving || !name.trim() ? 0.5 : 1 }}>
          {saving ? 'Création...' : 'Créer la box →'}
        </button>
      </div>
    </div>
  )
}
