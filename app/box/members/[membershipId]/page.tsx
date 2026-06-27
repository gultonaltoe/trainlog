'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrgMembers, removeMembership, setMemberAvatar, type OrgMember, type Role } from '@/lib/orgs'
import { getPlans, formatPrice, PLAN_KIND_LABEL, type MembershipPlan } from '@/lib/plans'
import { getMemberPlans, assignPlan, cancelMemberPlan, type MemberPlan } from '@/lib/memberPlans'
import { uploadAvatar } from '@/lib/storage'
import ImagePicker from '@/components/ImagePicker'
import { PageHeader, Card, SectionTitle, Field, Select, Button, Badge } from '@/components/ui'
import { toast } from '@/lib/toast'

const ROLE_LABEL: Record<Role, string> = { owner: 'Propriétaire', coach: 'Coach', member: 'Membre' }

// Member detail page (ST-44) — replaces the old plan-only bottom sheet.
export default function MemberDetailPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner'
  const router = useRouter()
  const { membershipId } = useParams<{ membershipId: string }>()

  const [member, setMember] = useState<OrgMember | null>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [assigned, setAssigned] = useState<MemberPlan[] | null>(null)
  const [planId, setPlanId] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [loading, setLoading] = useState(true)
  const [photoBusy, setPhotoBusy] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const [all, pl] = await Promise.all([getOrgMembers(orgId), getPlans(orgId)])
    const m = all.find(x => x.membershipId === membershipId) ?? null
    setMember(m)
    setPlans(pl.filter(p => p.active))
    if (m) { try { setAssigned(await getMemberPlans(orgId, m.userId)) } catch { setAssigned([]) } }
    setLoading(false)
  }, [orgId, membershipId])
  useEffect(() => { void load() }, [load])

  const assign = async () => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !member) { toast.error('Choisis un plan'); return }
    setBusy(true)
    try { await assignPlan(orgId!, member.userId, plan); toast.success('Plan attribué'); setPlanId(''); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(false)
  }
  const cancelPlan = async (mp: MemberPlan) => {
    try { await cancelMemberPlan(mp.id); toast.success('Plan annulé'); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }
  const onPickPhoto = async (file: File) => {
    if (!member) return
    setPhotoBusy(true)
    try {
      const url = await uploadAvatar(member.userId, file)   // coach writes to avatars/{memberId}/
      await setMemberAvatar(member.userId, url)             // persist via SECURITY DEFINER RPC
      toast.success('Photo du membre mise à jour')
      await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setPhotoBusy(false)
  }

  const removeMember = async () => {
    if (!member) return
    setBusy(true)
    try { await removeMembership(member.membershipId); toast.success('Membre retiré'); router.replace('/box/members') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur'); setBusy(false) }
  }

  if (!org) return null

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <PageHeader title={member?.firstName ?? 'Membre'} backHref="/box/members" />

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
        ) : !member ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Membre introuvable.</p>
        ) : (
          <div className="space-y-4">
            {/* Identity */}
            <Card className="p-4 flex items-center gap-3">
              {member.avatarUrl
                ? /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={member.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-full bg-[var(--track)] flex items-center justify-center text-2xl flex-shrink-0">👤</div>}
              <div className="min-w-0 flex-1">
                <p className="text-base font-black text-[var(--ink)] truncate">{member.firstName ?? 'Membre'}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge>{ROLE_LABEL[member.role]}</Badge>
                  {member.status !== 'active' && <Badge tone="amber">{member.status}</Badge>}
                  <Badge tone={member.dataSharing ? 'green' : 'gray'}>
                    {member.dataSharing ? 'Partage activé' : 'Données privées'}
                  </Badge>
                </div>
              </div>
              {canEdit && (
                <ImagePicker onPick={onPickPhoto} disabled={photoBusy} capture="environment">
                  {open => (
                    <button onClick={open} disabled={photoBusy}
                      className="ds-hover text-[11px] font-bold text-[var(--accent-text)] px-2 py-1 rounded-lg flex-shrink-0">
                      {photoBusy ? '…' : member.avatarUrl ? 'Changer photo' : 'Ajouter photo'}
                    </button>
                  )}
                </ImagePicker>
              )}
            </Card>

            {/* Plans */}
            <div>
              <SectionTitle>Abonnements</SectionTitle>
              <Card className="p-4 space-y-3">
                {assigned === null ? (
                  <p className="text-sm text-[var(--muted)]">Chargement…</p>
                ) : assigned.length === 0 ? (
                  <p className="text-sm text-[var(--border-strong)]">Aucun abonnement.</p>
                ) : (
                  <div className="space-y-2">
                    {assigned.map(mp => (
                      <div key={mp.id} className={`rounded-xl border border-[color:var(--border)] p-3 flex items-center justify-between gap-2 ${mp.status !== 'active' ? 'opacity-60' : ''}`}>
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
                        {canEdit && mp.status === 'active' && (
                          <button onClick={() => cancelPlan(mp)} className="text-[var(--border-strong)] hover:text-red-500 text-xl px-1 flex-shrink-0 cursor-pointer">×</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canEdit && (plans.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">Crée d’abord des plans dans « Abonnements ».</p>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field label="Attribuer un plan">
                        <Select value={planId} onChange={setPlanId} placeholder="Choisir un plan"
                          options={plans.map(p => ({ value: p.id, label: `${p.name} — ${formatPrice(p.priceCents, p.currency)}` }))} />
                      </Field>
                    </div>
                    <Button onClick={assign} disabled={busy || !planId}>{busy ? '…' : 'Attribuer'}</Button>
                  </div>
                ))}
              </Card>
            </div>

            {/* Danger zone */}
            {canEdit && member.role === 'member' && (
              <div>
                <SectionTitle>Zone sensible</SectionTitle>
                <Card className="p-4">
                  {confirmRemove ? (
                    <div className="flex items-center gap-2">
                      <button onClick={removeMember} disabled={busy}
                        className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-black text-sm disabled:opacity-50 cursor-pointer">
                        {busy ? '…' : 'Confirmer le retrait'}
                      </button>
                      <button onClick={() => setConfirmRemove(false)} className="text-sm font-bold text-[var(--muted)] px-3 cursor-pointer">Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRemove(true)}
                      className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 font-bold text-sm cursor-pointer">
                      Retirer de la box
                    </button>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
