'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { BackButton } from '@/components/ui'
import Link from 'next/link'
import { getOrgMembers, getBoxJoinCode, setMembershipStatus, type OrgMember } from '@/lib/orgs'
import { getOrgActivePlans, type MemberPlanSummary } from '@/lib/memberPlans'
import { toast } from '@/lib/toast'

export default function MembersPage() {
  const org = useBoxGuard()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [planByUser, setPlanByUser] = useState<Map<string, MemberPlanSummary>>(new Map())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const orgId = org?.orgId

  const load = useCallback(async () => {
    if (!orgId) return
    const [all, code, mp] = await Promise.all([getOrgMembers(orgId), getBoxJoinCode(orgId), getOrgActivePlans(orgId)])
    setMembers(all)
    setJoinCode(code)
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
        <div className="pt-5"><BackButton /></div>
        <div className="pt-2 pb-4">
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
                <Link key={m.membershipId} href={`/box/members/${m.membershipId}`}
                  className="ds-hover w-full text-left bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3 flex items-center justify-between hover:shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.avatarUrl
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={m.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-9 h-9 rounded-full bg-[var(--track)] flex items-center justify-center flex-shrink-0">👤</div>}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--ink)] truncate">{m.firstName ?? 'Membre'}</p>
                      <p className="text-[11px] truncate">
                        {plan
                          ? <span className="text-[var(--sub)]">{plan.planName}{plan.creditsRemaining != null ? ` · ${plan.creditsRemaining} cr.` : ''}</span>
                          : <span className="text-amber-600 font-semibold">Aucun abonnement</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-[var(--border-strong)] flex-shrink-0">›</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

