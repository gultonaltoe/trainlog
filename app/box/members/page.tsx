'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrgMembers, getBoxJoinCode, setMembershipStatus, type OrgMember } from '@/lib/orgs'
import { getPlans, formatPrice, PLAN_KIND_LABEL, type MembershipPlan } from '@/lib/plans'
import { getMemberPlans, assignPlan, cancelMemberPlan, getOrgActivePlans, type MemberPlan, type MemberPlanSummary } from '@/lib/memberPlans'
import { toast } from '@/lib/toast'

export default function MembersPage() {
  const org = useBoxGuard()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [planByUser, setPlanByUser] = useState<Map<string, MemberPlanSummary>>(new Map())
  const [sheetFor, setSheetFor] = useState<OrgMember | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const orgId = org?.orgId

  const load = useCallback(async () => {
    if (!orgId) return
    const [all, code, pl, mp] = await Promise.all([getOrgMembers(orgId), getBoxJoinCode(orgId), getPlans(orgId), getOrgActivePlans(orgId)])
    setMembers(all)
    setJoinCode(code)
    setPlans(pl.filter(p => p.active))
    setPlanByUser(mp)
    setLoading(false)
  }, [orgId])

  useEffect(() => { void load() }, [load])

  const q = query.trim().toLowerCase()
  const pending = members.filter(m => m.status === 'pending')
  const active  = members.filter(m => m.status === 'active' && m.role === 'member'
    && (!q || (m.firstName ?? '').toLowerCase().includes(q)))

  const decide = async (m: OrgMember, approve: boolean) => {
    await setMembershipStatus(m.membershipId, approve ? 'active' : 'inactive')
    toast.success(approve ? 'Membre approuvé' : 'Demande refusée')
    void load()
  }

  if (!org) return null

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">Membres</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">{org.orgName}</p>
        </div>

        {/* Join code to share */}
        {joinCode && (
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-1">Code de la box</p>
              <p className="text-2xl font-black tracking-widest text-[var(--ink)]">{joinCode}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard?.writeText(joinCode); toast.success('Code copié') }}
              className="text-xs font-bold text-[var(--accent-text)]">Copier</button>
          </div>
        )}
        <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
          Partage ce code : un athlète l’entre dans « Rejoindre une box » et tu valides sa demande ici.
        </p>

        {/* Pending requests */}
        {pending.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">Demandes en attente</p>
            <div className="space-y-2">
              {pending.map(m => (
                <div key={m.membershipId} className="bg-[var(--card)] rounded-xl border border-amber-200 p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">⏳</div>
                    <p className="text-sm font-bold text-[var(--ink)] truncate">{m.firstName ?? 'Athlète'}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => decide(m, true)}
                      className="text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: 'var(--theme-primary, #F97316)' }}>
                      Approuver
                    </button>
                    <button onClick={() => decide(m, false)}
                      className="text-xs font-bold text-[var(--sub)] px-3 py-1.5 rounded-lg border border-[color:var(--border)]">
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active members */}
        <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">
          Membres {!loading && `(${active.length})`}
        </p>
        {!loading && members.some(m => m.status === 'active' && m.role === 'member') && (
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un membre…"
            className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] mb-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
        )}
        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">Chargement…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">{query ? 'Aucun membre ne correspond.' : 'Aucun membre actif pour l’instant.'}</p>
        ) : (
          <div className="space-y-2">
            {active.map(m => {
              const plan = planByUser.get(m.userId)
              return (
                <button key={m.membershipId} onClick={() => setSheetFor(m)}
                  className="w-full text-left bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3 flex items-center justify-between hover:shadow-sm transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--track)] flex items-center justify-center flex-shrink-0">👤</div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--ink)] truncate">{m.firstName ?? 'Membre'}</p>
                      <p className="text-[11px] truncate">
                        {plan
                          ? <span className="text-[var(--sub)]">{plan.planName}{plan.creditsRemaining != null ? ` · ${plan.creditsRemaining} cr.` : ''}</span>
                          : <span className="text-amber-600 font-semibold">Aucun abonnement</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[var(--accent-text)] flex-shrink-0">Abonnement ›</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {sheetFor && orgId && (
        <MemberPlanSheet orgId={orgId} member={sheetFor} plans={plans} onClose={() => setSheetFor(null)} />
      )}
    </div>
  )
}

function MemberPlanSheet({ orgId, member, plans, onClose }: {
  orgId: string; member: OrgMember; plans: MembershipPlan[]; onClose: () => void
}) {
  const [assigned, setAssigned] = useState<MemberPlan[] | null>(null)
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try { setAssigned(await getMemberPlans(orgId, member.userId)) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur'); setAssigned([]) }
  }, [orgId, member.userId])
  useEffect(() => { void reload() }, [reload])

  const assign = async () => {
    const plan = plans.find(p => p.id === planId)
    if (!plan) { toast.error('Choisis un plan'); return }
    setBusy(true)
    try { await assignPlan(orgId, member.userId, plan); toast.success('Plan attribué'); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(false)
  }
  const cancel = async (mp: MemberPlan) => {
    if (!window.confirm(`Annuler le plan « ${mp.planName} » ?`)) return
    await cancelMemberPlan(mp.id); toast.success('Plan annulé'); await reload()
  }

  const fieldCls = 'w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-3 py-2.5 text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-lg rounded-t-3xl p-5 pb-8 max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-black text-[var(--ink)] mb-1">{member.firstName ?? 'Membre'}</h2>
        <p className="text-xs text-[var(--muted)] mb-4">Abonnements</p>

        {assigned === null ? (
          <p className="text-sm text-[var(--muted)] text-center py-4">Chargement…</p>
        ) : assigned.length === 0 ? (
          <p className="text-sm text-[var(--border-strong)] mb-4">Aucun abonnement.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {assigned.map(mp => (
              <div key={mp.id} className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${mp.status === 'active' ? 'border-[color:var(--border)]' : 'border-[color:var(--border)] opacity-60'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--ink)] truncate">{mp.planName}
                    {mp.status !== 'active' && <span className="text-[10px] font-bold text-[var(--muted)]"> ({mp.status})</span>}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {PLAN_KIND_LABEL[mp.planKind]}
                    {mp.creditsRemaining != null ? ` · ${mp.creditsRemaining} crédits` : ''}
                    {mp.endsOn ? ` · jusqu’au ${mp.endsOn}` : ''}
                  </p>
                </div>
                {mp.status === 'active' && (
                  <button onClick={() => cancel(mp)} className="text-[var(--border-strong)] hover:text-red-500 text-xl px-1 flex-shrink-0">×</button>
                )}
              </div>
            ))}
          </div>
        )}

        {plans.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">Crée d’abord des plans dans « Abonnements ».</p>
        ) : (
          <div className="flex items-end gap-2">
            <label className="flex-1 text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">Attribuer un plan
              <select className={`${fieldCls} mt-1.5`} value={planId} onChange={e => setPlanId(e.target.value)}>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.priceCents, p.currency)}</option>)}
              </select>
            </label>
            <button onClick={assign} disabled={busy}
              className="py-2.5 px-4 rounded-xl text-white font-black text-sm disabled:opacity-50"
              style={{ background: 'var(--theme-primary, #F97316)' }}>
              {busy ? '…' : 'Attribuer'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
