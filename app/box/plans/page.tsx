'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { BackButton, Select } from '@/components/ui'
import { getPlans, createPlan, updatePlan, deletePlan, formatPrice, PLAN_KIND_LABEL, type MembershipPlan, type NewPlan, type PlanKind } from '@/lib/plans'
import { toast } from '@/lib/toast'

const KINDS: PlanKind[] = ['unlimited', 'pack', 'drop_in', 'trial']
const EMPTY: NewPlan = { name: '', kind: 'unlimited', priceCents: 0, currency: 'EUR', credits: 10, durationDays: 30, recurring: false, active: true, sortOrder: 0 }

export default function PlansPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner'
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<MembershipPlan | 'new' | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try { setPlans(await getPlans(orgId)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const remove = async (p: MembershipPlan) => {
    if (!window.confirm(`Supprimer le plan « ${p.name} » ?`)) return
    await deletePlan(p.id); toast.success('Plan supprimé'); void load()
  }

  if (!org) return null

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-5"><BackButton /></div>
        <div className="pt-2 pb-4">
          <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">Abonnements</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">{org.orgName}</p>
        </div>

        {canEdit && (
          <button onClick={() => setEditing('new')}
            className="w-full mb-4 py-3 rounded-2xl text-white font-bold text-sm"
            style={{ background: 'var(--theme-primary, #F97316)' }}>
            + Ajouter un plan
          </button>
        )}

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">Chargement…</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-[var(--border-strong)] text-center py-8">Aucun plan pour l’instant.</p>
        ) : (
          <div className="space-y-2">
            {plans.map(p => (
              <div key={p.id} className={`bg-[var(--card)] rounded-xl border p-3 ${p.active ? 'border-[color:var(--border)]' : 'border-[color:var(--border)] opacity-60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--ink)] truncate">
                      {p.name} {!p.active && <span className="text-[10px] font-bold text-[var(--muted)]">(inactif)</span>}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {PLAN_KIND_LABEL[p.kind]}
                      {p.kind === 'pack' && p.credits ? ` · ${p.credits} séances` : ''}
                      {p.durationDays ? ` · ${p.durationDays} j` : ''}
                      {p.recurring ? ' · récurrent' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-black text-[var(--ink)]">{formatPrice(p.priceCents, p.currency)}</span>
                    {canEdit && (
                      <>
                        <button onClick={() => setEditing(p)} className="text-[var(--muted)] hover:text-[var(--ink-soft)] text-sm font-bold px-1">✎</button>
                        <button onClick={() => remove(p)} className="text-[var(--border-strong)] hover:text-red-500 text-xl px-1">×</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && orgId && (
        <PlanForm orgId={orgId} initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />
      )}
    </div>
  )
}

function PlanForm({ orgId, initial, onClose, onSaved }: {
  orgId: string; initial: MembershipPlan | null; onClose: () => void; onSaved: () => void
}) {
  const [p, setP] = useState<NewPlan>(initial ?? EMPTY)
  const [priceEuros, setPriceEuros] = useState(((initial?.priceCents ?? 0) / 100).toString())
  const [saving, setSaving] = useState(false)

  const fieldCls = 'ds-field'
  const labelCls = 'block text-xs font-bold text-[var(--sub)] uppercase tracking-wide mb-1.5'
  const upd = (patch: Partial<NewPlan>) => setP(v => ({ ...v, ...patch }))

  const submit = async () => {
    if (!p.name.trim()) { toast.error('Nom requis'); return }
    const cents = Math.round((parseFloat(priceEuros.replace(',', '.')) || 0) * 100)
    const payload: NewPlan = { ...p, priceCents: cents }
    setSaving(true)
    try {
      if (initial) await updatePlan(initial.id, payload)
      else await createPlan(orgId, payload)
      toast.success('Plan enregistré'); onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[var(--card)] w-full max-w-lg rounded-t-3xl p-5 pb-8 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-black text-[var(--ink)] mb-4">{initial ? 'Modifier le plan' : 'Nouveau plan'}</h2>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nom</label>
            <input className={fieldCls} value={p.name} placeholder="Illimité mensuel, Carnet 10, Drop-in…"
              onChange={e => upd({ name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <Select<PlanKind> value={p.kind} onChange={k => upd({ kind: k })}
              options={KINDS.map(k => ({ value: k, label: PLAN_KIND_LABEL[k] }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Prix (€)</label>
              <input type="number" min={0} step="0.01" inputMode="decimal" className={fieldCls} value={priceEuros}
                onChange={e => setPriceEuros(e.target.value)} />
            </div>
            {p.kind === 'pack' && (
              <div>
                <label className={labelCls}>Crédits (séances)</label>
                <input type="number" min={1} className={fieldCls} value={p.credits ?? ''}
                  onChange={e => upd({ credits: parseInt(e.target.value) || null })} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Validité (jours)</label>
              <input type="number" min={0} className={fieldCls} value={p.durationDays ?? ''} placeholder="vide = illimité"
                onChange={e => upd({ durationDays: parseInt(e.target.value) || null })} />
            </div>
            <label className="flex items-end gap-2 pb-2.5">
              <input type="checkbox" className="w-5 h-5 accent-[var(--theme-primary)]" checked={p.recurring}
                onChange={e => upd({ recurring: e.target.checked })} />
              <span className="text-sm font-semibold text-[var(--ink-soft)]">Récurrent</span>
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="w-5 h-5 accent-[var(--theme-primary)]" checked={p.active}
              onChange={e => upd({ active: e.target.checked })} />
            <span className="text-sm font-semibold text-[var(--ink-soft)]">Actif (visible par les membres)</span>
          </label>
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full mt-5 py-3.5 rounded-2xl text-white font-black text-base disabled:opacity-50"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
