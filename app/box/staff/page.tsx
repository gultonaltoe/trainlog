'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import {
  getOrgMembers, setEmploymentStatus, removeMembership,
  type OrgMember, type Role, type EmploymentStatus,
} from '@/lib/orgs'
import { createInvite, getOrgInvites, revokeInvite, type Invite, type InviteRole } from '@/lib/invites'
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
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const [all, inv] = await Promise.all([getOrgMembers(orgId), getOrgInvites(orgId)])
    setStaff(all.filter(m => m.status === 'active' && COACH_ROLES.includes(m.role)))
    setInvites(inv)
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const changeEmp = async (m: OrgMember, emp: EmploymentStatus) => { await setEmploymentStatus(m.membershipId, emp); void load() }
  const remove = async (m: OrgMember) => {
    if (!window.confirm(`Retirer ${m.firstName ?? 'ce coach'} des coachs ?`)) return
    await removeMembership(m.membershipId); toast.success('Retiré'); void load()
  }
  const cancelInvite = async (i: Invite) => {
    if (!window.confirm(`Annuler l’invitation de ${i.email} ?`)) return
    await revokeInvite(i.id); toast.success('Invitation annulée'); void load()
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
          <button onClick={() => setShowInvite(true)}
            className="w-full mb-4 py-3 rounded-2xl text-white font-bold text-sm"
            style={{ background: 'var(--theme-primary, #F97316)' }}>
            + Inviter un coach
          </button>
        )}

        {/* Pending invites */}
        {!loading && invites.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Invitations en attente</p>
            <div className="space-y-2">
              {invites.map(i => (
                <div key={i.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{i.email}</p>
                    <p className="text-[11px] text-amber-700">{ROLE_LABEL[i.role]} · en attente de 1ʳᵉ connexion</p>
                  </div>
                  {canManage && (
                    <button onClick={() => cancelInvite(i)} className="text-amber-400 hover:text-red-500 text-xl px-1 flex-shrink-0">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canManage && !isOwner ? (
                        <>
                          <select className={selCls} value={m.employmentStatus ?? 'active'} onChange={e => changeEmp(m, e.target.value as EmploymentStatus)}>
                            {(Object.keys(EMP_LABEL) as EmploymentStatus[]).map(k => <option key={k} value={k}>{EMP_LABEL[k]}</option>)}
                          </select>
                          <button onClick={() => remove(m)} className="text-gray-300 hover:text-red-500 text-xl px-1">×</button>
                        </>
                      ) : (
                        <>
                          {m.employmentStatus && m.employmentStatus !== 'active' && (
                            <span className="text-[11px] text-amber-600 font-bold">{EMP_LABEL[m.employmentStatus]}</span>
                          )}
                          <span className="text-[11px] font-bold text-gray-400">{ROLE_LABEL[m.role]}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
          Le coach est ajouté automatiquement à sa première connexion avec l’email invité.
        </p>
      </div>

      {showInvite && orgId && (
        <InviteForm orgId={orgId}
          onClose={() => setShowInvite(false)}
          onSaved={() => { setShowInvite(false); void load() }} />
      )}
    </div>
  )
}

function InviteForm({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('coach')
  const [saving, setSaving] = useState(false)

  const fieldCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
  const labelCls = 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5'

  const submit = async () => {
    if (!email.trim()) { toast.error('Email requis'); return }
    setSaving(true)
    try {
      await createInvite(orgId, email, role)
      toast.success('Invitation créée')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur'); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-black text-gray-900 mb-1">Inviter par email</h2>
        <p className="text-xs text-gray-400 mb-4">La personne est ajoutée automatiquement à sa première connexion avec cet email.</p>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" autoComplete="off" className={fieldCls} value={email}
              placeholder="coach@email.com" onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div>
            <label className={labelCls}>Rôle</label>
            <select className={fieldCls} value={role} onChange={e => setRole(e.target.value as InviteRole)}>
              <option value="coach">Coach</option>
              <option value="member">Membre</option>
            </select>
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full mt-5 py-3.5 rounded-2xl text-white font-black text-base disabled:opacity-50"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          {saving ? 'Envoi…' : 'Envoyer l’invitation'}
        </button>
      </div>
    </div>
  )
}
