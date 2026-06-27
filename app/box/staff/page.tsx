'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import {
  getOrgMembers, setEmploymentStatus, removeMembership,
  type OrgMember, type Role, type EmploymentStatus,
} from '@/lib/orgs'
import { createInvite, getOrgInvites, revokeInvite, type Invite } from '@/lib/invites'
import { getSchedules, endTime, type ClassSchedule } from '@/lib/classes'
import { Select, DatePicker, Field } from '@/components/ui'
import { toast } from '@/lib/toast'

const ROLE_LABEL: Record<Role, string> = { owner: 'Propriétaire', coach: 'Coach', member: 'Membre' }
const EMP_LABEL: Record<EmploymentStatus, string> = { active: 'Actif', on_leave: 'Congé', inactive: 'Inactif' }
const COACH_ROLES: Role[] = ['owner', 'coach']
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']


export default function StaffPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canManage = org?.role === 'owner'
  const [staff, setStaff] = useState<OrgMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [detailFor, setDetailFor] = useState<OrgMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const [all, inv, sch] = await Promise.all([getOrgMembers(orgId), getOrgInvites(orgId), getSchedules(orgId)])
    setStaff(all.filter(m => m.status === 'active' && COACH_ROLES.includes(m.role)))
    setInvites(inv)
    setSchedules(sch)
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

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
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">Coachs</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">{org.orgName}</p>
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
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">Invitations en attente</p>
            <div className="space-y-2">
              {invites.map(i => (
                <div key={i.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--ink)] truncate">{i.email}</p>
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
          <p className="text-sm text-[var(--muted)] text-center py-8">Chargement…</p>
        ) : (
          <div className="space-y-2">
            {staff.map(m => {
              const isOwner = m.role === 'owner'
              return (
                <div key={m.membershipId} className="bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setDetailFor(m)} className="flex items-center gap-3 min-w-0 text-left cursor-pointer flex-1">
                      <div className="w-9 h-9 rounded-full bg-[var(--track)] flex items-center justify-center flex-shrink-0">🧑‍🏫</div>
                      <p className="text-sm font-bold text-[var(--ink)] truncate">{m.firstName ?? ROLE_LABEL[m.role]}</p>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {m.employmentStatus && m.employmentStatus !== 'active' && (
                        <span className="text-[11px] text-amber-600 font-bold">{EMP_LABEL[m.employmentStatus]}</span>
                      )}
                      <span className="text-[11px] font-bold text-[var(--muted)]">{ROLE_LABEL[m.role]}</span>
                      {canManage && !isOwner && (
                        <button onClick={() => remove(m)} className="text-[var(--border-strong)] hover:text-red-500 text-xl px-1 cursor-pointer">×</button>
                      )}
                      <button onClick={() => setDetailFor(m)} className="text-[var(--border-strong)] cursor-pointer">›</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-[var(--muted)] text-center mt-4 leading-relaxed">
          Le coach est ajouté automatiquement à sa première connexion avec l’email invité.
        </p>
      </div>

      {showInvite && orgId && (
        <InviteForm orgId={orgId}
          onClose={() => setShowInvite(false)}
          onSaved={() => { setShowInvite(false); void load() }} />
      )}

      {detailFor && (
        <CoachDetailSheet coach={detailFor}
          classes={schedules.filter(s => s.coachUserId === detailFor.userId)}
          canManage={!!canManage && detailFor.role !== 'owner'}
          onChanged={() => { void load(); setDetailFor(null) }}
          onClose={() => setDetailFor(null)} />
      )}
    </div>
  )
}

function CoachDetailSheet({ coach, classes, canManage, onChanged, onClose }: {
  coach: OrgMember; classes: ClassSchedule[]; canManage: boolean; onChanged: () => void; onClose: () => void
}) {
  const byDay = [...classes].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
  const [emp, setEmp] = useState<EmploymentStatus>(coach.employmentStatus ?? 'active')
  const [start, setStart] = useState(coach.leaveStart ?? '')
  const [end, setEnd] = useState(coach.leaveEnd ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (emp === 'on_leave' && !start) { toast.error('Indique au moins la date de début du congé'); return }
    setSaving(true)
    try { await setEmploymentStatus(coach.membershipId, emp, start || null, end || null); toast.success('Enregistré'); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-lg rounded-t-3xl p-5 pb-8 max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-full bg-[var(--track)] flex items-center justify-center text-2xl">🧑‍🏫</div>
          <div>
            <h2 className="text-lg font-black text-[var(--ink)]">{coach.firstName ?? ROLE_LABEL[coach.role]}</h2>
            <p className="text-xs text-[var(--muted)]">
              {ROLE_LABEL[coach.role]}
              {coach.employmentStatus && coach.employmentStatus !== 'active' && ` · ${EMP_LABEL[coach.employmentStatus]}`}
              {coach.employmentStatus === 'on_leave' && coach.leaveStart && ` (${coach.leaveStart} → ${coach.leaveEnd ?? '…'})`}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="mt-4 bg-[var(--bg)] rounded-xl p-3 space-y-3">
            <Field label="Statut">
              <Select<EmploymentStatus> value={emp} onChange={setEmp}
                options={(Object.keys(EMP_LABEL) as EmploymentStatus[]).map(k => ({ value: k, label: EMP_LABEL[k] }))} />
            </Field>
            {emp === 'on_leave' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Début"><DatePicker value={start} onChange={setStart} /></Field>
                <Field label="Fin (option.)"><DatePicker value={end} onChange={setEnd} /></Field>
              </div>
            )}
            <button onClick={save} disabled={saving}
              className="w-full py-2.5 rounded-lg text-white font-bold text-xs disabled:opacity-50 cursor-pointer"
              style={{ background: 'var(--theme-primary, #F97316)' }}>
              {saving ? '…' : 'Enregistrer le statut'}
            </button>
          </div>
        )}

        <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wide mt-5 mb-2">Cours encadrés ({byDay.length})</p>
        {byDay.length === 0 ? (
          <p className="text-sm text-[var(--border-strong)]">Aucun cours assigné à ce coach.</p>
        ) : (
          <div className="space-y-2">
            {byDay.map(c => (
              <div key={c.id} className="bg-[var(--bg)] rounded-xl p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--ink)] truncate">{c.title}</p>
                  <p className="text-xs text-[var(--muted)]">{DAYS[c.weekday]} · {c.startTime}–{endTime(c.startTime, c.durationMin)}</p>
                </div>
                <span className="text-xs text-[var(--muted)] flex-shrink-0">{c.capacity} pl.</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InviteForm({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const fieldCls = 'w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-2.5 text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
  const labelCls = 'block text-xs font-bold text-[var(--sub)] uppercase tracking-wide mb-1.5'

  const submit = async () => {
    if (!email.trim()) { toast.error('Email requis'); return }
    setSaving(true)
    try {
      await createInvite(orgId, email, 'coach')
      toast.success('Invitation créée')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur'); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-lg rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-black text-[var(--ink)] mb-1">Inviter par email</h2>
        <p className="text-xs text-[var(--muted)] mb-4">La personne est ajoutée automatiquement à sa première connexion avec cet email.</p>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" autoComplete="off" className={fieldCls} value={email}
              placeholder="coach@email.com" onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <p className="text-xs text-[var(--muted)]">Invité comme <span className="font-bold text-[var(--ink-soft)]">Coach</span>.</p>
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
