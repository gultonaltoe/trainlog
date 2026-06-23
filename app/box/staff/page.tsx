'use client'
import { useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrgMembers, type OrgMember, type Role } from '@/lib/orgs'
import { toast } from '@/lib/toast'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire', coach: 'Coach', staff: 'Staff', member: 'Membre',
}
const STAFF_ROLES: Role[] = ['owner', 'coach', 'staff']

export default function StaffPage() {
  const org = useBoxGuard()
  const [staff, setStaff] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!org) return
    getOrgMembers(org.orgId)
      .then(all => setStaff(all.filter(m => STAFF_ROLES.includes(m.role))))
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.orgId])

  if (!org) return null

  const canManage = org.role === 'owner'

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Staff</h1>
          <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
        </div>

        {canManage && (
          <button onClick={() => toast.info('Invitations bientôt disponibles')}
            className="w-full mb-4 py-3 rounded-2xl text-white font-bold text-sm"
            style={{ background: 'var(--theme-primary, #F97316)' }}>
            + Inviter un coach / staff
          </button>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
        ) : (
          <div className="space-y-2">
            {staff.map(m => (
              <div key={m.membershipId} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">🧑‍🏫</div>
                  <p className="text-sm font-bold text-gray-800">{ROLE_LABEL[m.role]}</p>
                </div>
                <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{ROLE_LABEL[m.role]}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
          Gestion des rôles (promouvoir / retirer) et invitations à venir.
        </p>
      </div>
    </div>
  )
}
