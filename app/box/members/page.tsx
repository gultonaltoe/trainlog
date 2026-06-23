'use client'
import { useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrgMembers, type OrgMember } from '@/lib/orgs'
import { toast } from '@/lib/toast'

export default function MembersPage() {
  const org = useBoxGuard()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!org) return
    getOrgMembers(org.orgId)
      .then(all => setMembers(all.filter(m => m.role === 'member')))
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.orgId])

  if (!org) return null

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Membres</h1>
          <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
        </div>

        <button onClick={() => toast.info('Invitations bientôt disponibles')}
          className="w-full mb-4 py-3 rounded-2xl text-white font-bold text-sm"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          + Inviter un membre
        </button>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucun membre pour l’instant.</p>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.membershipId} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">👤</div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800">Membre</p>
                    <p className="text-[11px] text-gray-400">{m.dataSharing ? 'Données partagées' : 'Données privées'}</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">Membre</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
          Les noms des membres s’afficheront une fois la lecture de profil par la box activée (étape suivante).
        </p>
      </div>
    </div>
  )
}
