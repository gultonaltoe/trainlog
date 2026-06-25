'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import {
  getOrgMembers, setEmploymentStatus, removeMembership,
  type OrgMember, type Role, type EmploymentStatus,
} from '@/lib/orgs'
import { toast } from '@/lib/toast'

const ROLE_LABEL: Record<Role, string> = { owner: 'Propriétaire', coach: 'Coach', member: 'Membre' }
const EMP_LABEL: Record<EmploymentStatus, string> = { active: 'Actif', on_leave: 'Congé', inactive: 'Inactif' }
const COACH_ROLES: Role[] = ['owner', 'coach']

const selCls = 'rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function StaffPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canManage = org?.role === 'owner'
  const [staff, setStaff] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orgId) return
    const all = await getOrgMembers(orgId)
    setStaff(all.filter(m => m.status === 'active' && COACH_ROLES.includes(m.role)))
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const changeEmp = async (m: OrgMember, emp: EmploymentStatus) => { await setEmploymentStatus(m.membershipId, emp); void load() }
  const remove = async (m: OrgMember) => {
    if (!window.confirm(`Retirer ${m.firstName ?? 'ce coach'} des coachs ?`)) return
    await removeMembership(m.membershipId); toast.success('Retiré'); void load()
  }

  if (!org) return null

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Coachs</h1>
          <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
        </div>

        {canManage && (
          <button onClick={() => toast.info('Ajout d’un coach par email — bientôt')}
            className="w-full mb-4 py-3 rounded-2xl text-white font-bold text-sm"
            style={{ background: 'var(--theme-primary, #F97316)' }}>
            + Ajouter un coach
          </button>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
        ) : (
          <div className="space-y-2">
            {staff.map(m => {
              const isOwner = m.role === 'owner'
              return (
                <div key={m.membershipId} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">🧑‍🏫</div>
                      <p className="text-sm font-bold text-gray-800 truncate">{m.firstName ?? ROLE_LABEL[m.role]}</p>
                    </div>
                    {canManage && !isOwner ? (
                      <button onClick={() => remove(m)} className="text-gray-300 hover:text-red-500 text-xl px-1 flex-shrink-0">×</button>
                    ) : (
                      <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{ROLE_LABEL[m.role]}</span>
                    )}
                  </div>

                  {canManage && !isOwner && (
                    <div className="flex items-center gap-2 mt-2 pl-12">
                      <select className={selCls} value={m.employmentStatus ?? 'active'} onChange={e => changeEmp(m, e.target.value as EmploymentStatus)}>
                        {(Object.keys(EMP_LABEL) as EmploymentStatus[]).map(k => <option key={k} value={k}>{EMP_LABEL[k]}</option>)}
                      </select>
                    </div>
                  )}
                  {(!canManage || isOwner) && m.employmentStatus && m.employmentStatus !== 'active' && (
                    <p className="text-[11px] text-amber-600 font-bold mt-1 pl-12">{EMP_LABEL[m.employmentStatus]}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
          Ajout par email à venir (le coach reçoit un lien, il est ajouté directement).
        </p>
      </div>
    </div>
  )
}
