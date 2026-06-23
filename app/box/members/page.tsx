'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrgMembers, getBoxJoinCode, setMembershipStatus, type OrgMember } from '@/lib/orgs'
import { toast } from '@/lib/toast'

export default function MembersPage() {
  const org = useBoxGuard()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const orgId = org?.orgId

  const load = useCallback(async () => {
    if (!orgId) return
    const [all, code] = await Promise.all([getOrgMembers(orgId), getBoxJoinCode(orgId)])
    setMembers(all)
    setJoinCode(code)
    setLoading(false)
  }, [orgId])

  useEffect(() => { void load() }, [load])

  const pending = members.filter(m => m.status === 'pending')
  const active  = members.filter(m => m.status === 'active' && m.role === 'member')

  const decide = async (m: OrgMember, approve: boolean) => {
    await setMembershipStatus(m.membershipId, approve ? 'active' : 'inactive')
    toast.success(approve ? 'Membre approuvé' : 'Demande refusée')
    void load()
  }

  if (!org) return null

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Membres</h1>
          <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
        </div>

        {/* Join code to share */}
        {joinCode && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Code de la box</p>
              <p className="text-2xl font-black tracking-widest text-gray-900">{joinCode}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard?.writeText(joinCode); toast.success('Code copié') }}
              className="text-xs font-bold text-orange-600">Copier</button>
          </div>
        )}
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          Partage ce code : un athlète l’entre dans « Rejoindre une box » et tu valides sa demande ici.
        </p>

        {/* Pending requests */}
        {pending.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Demandes en attente</p>
            <div className="space-y-2">
              {pending.map(m => (
                <div key={m.membershipId} className="bg-white rounded-xl border border-amber-200 p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">⏳</div>
                    <p className="text-sm font-bold text-gray-800 truncate">{m.firstName ?? 'Athlète'}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => decide(m, true)}
                      className="text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: 'var(--theme-primary, #F97316)' }}>
                      Approuver
                    </button>
                    <button onClick={() => decide(m, false)}
                      className="text-xs font-bold text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active members */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          Membres {!loading && `(${active.length})`}
        </p>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucun membre actif pour l’instant.</p>
        ) : (
          <div className="space-y-2">
            {active.map(m => (
              <div key={m.membershipId} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">👤</div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{m.firstName ?? 'Membre'}</p>
                    <p className="text-[11px] text-gray-400">{m.dataSharing ? 'Données partagées' : 'Données privées'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
