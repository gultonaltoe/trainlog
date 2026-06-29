'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrganization, updateReservationSettings, DEFAULT_RESERVATION_SETTINGS, type ReservationSettings, type WaitlistMode } from '@/lib/orgs'
import { toast } from '@/lib/toast'
import { PageHeader, Card, SectionTitle, Field, Toggle, Button, Segmented, ui } from '@/components/ui'

export default function ReservationSettingsPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner'
  const [resa, setResa] = useState<ReservationSettings>(DEFAULT_RESERVATION_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const info = await getOrganization(orgId)
    setResa(info.reservations)
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const upd = (patch: Partial<ReservationSettings>) => setResa(r => ({ ...r, ...patch }))

  const save = async () => {
    if (!orgId) return
    const clean: ReservationSettings = {
      waitlistEnabled: resa.waitlistEnabled,
      waitlistMode: resa.waitlistMode,
      waitlistCapacity: Math.max(0, resa.waitlistCapacity || 0),
      cancelCutoffMin: Math.max(0, resa.cancelCutoffMin || 0),
      bookAheadDays: Math.max(0, resa.bookAheadDays || 0),
      bookCutoffMin: Math.max(0, resa.bookCutoffMin || 0),
      requirePlan: resa.requirePlan,
      maxActiveBookings: Math.max(0, resa.maxActiveBookings || 0),
      waitlistNotifyWindowMin: Math.max(1, resa.waitlistNotifyWindowMin || 30),
    }
    setSaving(true)
    try { await updateReservationSettings(orgId, clean); setResa(clean); toast.success('Réservations enregistrées') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setSaving(false)
  }

  if (!org) return null

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <PageHeader title="Réservations" subtitle="Règles de réservation des membres" backHref="/box/settings" />

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
        ) : (
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <Toggle label="Liste d’attente" checked={resa.waitlistEnabled} disabled={!canEdit}
                onChange={v => upd({ waitlistEnabled: v })}
                hint="Permet aux membres de s’inscrire quand un cours est complet." />

              {resa.waitlistEnabled && (
                <>
                  <div>
                    <SectionTitle>Quand une place se libère</SectionTitle>
                    <Segmented<WaitlistMode>
                      value={resa.waitlistMode}
                      onChange={v => canEdit && upd({ waitlistMode: v })}
                      options={[['auto_promote', 'Promotion auto'], ['notify', 'Notifier 1er'], ['notify_all', 'Notifier tous']]} />

                    {/* Each mode spelled out: what happens + the trade-off. */}
                    <div className="mt-3 rounded-xl bg-[var(--bg)] border border-[color:var(--border)] p-3 space-y-2">
                      {([
                        ['auto_promote', '⚡', 'Promotion auto', 'La place est attribuée automatiquement au 1er de la liste — il est inscrit sans rien faire.', 'Le plus simple. Risque : un membre qui ne voulait plus venir se retrouve inscrit.'],
                        ['notify', '🥇', 'Notifier 1er', 'La place est proposée au 1er de la liste, qui doit confirmer. S’il ne confirme pas dans le délai, elle passe automatiquement au suivant, et ainsi de suite.', 'Respecte l’ordre d’arrivée. Si personne ne confirme, la place reste libre (réservable normalement).'],
                        ['notify_all', '📣', 'Notifier tous', 'Tout le monde en liste d’attente est prévenu en même temps ; le 1er à confirmer prend la place.', 'Se remplit vite. Moins « juste » : ce n’est pas forcément le 1er arrivé qui l’obtient.'],
                      ] as const).map(([mode, emoji, title, what, tradeoff]) => (
                        <div key={mode} className={`flex gap-2.5 ${resa.waitlistMode === mode ? '' : 'opacity-45'}`}>
                          <span className="text-base leading-none flex-shrink-0 mt-0.5">{emoji}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--ink)]">{title}</p>
                            <p className="text-[11px] text-[var(--ink-soft)] leading-snug">{what}</p>
                            <p className="text-[11px] text-[var(--muted)] leading-snug mt-0.5">{tradeoff}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {resa.waitlistMode === 'notify' && (
                    <Field label="Délai de confirmation (min)"
                      hint="Temps laissé au 1er pour confirmer avant que la place passe au suivant.">
                      <input type="number" min={1} step={5} className={ui.field} value={resa.waitlistNotifyWindowMin || ''} disabled={!canEdit}
                        placeholder="30" onChange={e => upd({ waitlistNotifyWindowMin: parseInt(e.target.value) || 0 })} />
                    </Field>
                  )}

                  <Field label="Places en liste d’attente (défaut)" hint="Ajustable par cours dans le planning.">
                    <input type="number" min={0} className={ui.field} value={resa.waitlistCapacity || ''} disabled={!canEdit}
                      onChange={e => upd({ waitlistCapacity: parseInt(e.target.value) || 0 })} />
                  </Field>
                </>
              )}
            </Card>

            <Card className="p-4 space-y-4">
              <Field label="Délai limite d’annulation (min avant le cours)" hint="0 = annulation possible jusqu’au début du cours.">
                <input type="number" min={0} step={15} className={ui.field} value={resa.cancelCutoffMin || ''} disabled={!canEdit}
                  onChange={e => upd({ cancelCutoffMin: parseInt(e.target.value) || 0 })} />
              </Field>
              <Toggle label="Exiger un abonnement pour réserver" checked={resa.requirePlan} disabled={!canEdit}
                onChange={v => upd({ requirePlan: v })}
                hint={resa.requirePlan
                  ? 'Un membre doit avoir un abonnement actif (ou des crédits) pour réserver. Coachs/propriétaire exemptés.'
                  : 'N’importe quel membre peut réserver, abonnement ou non.'} />
              <Field label="Réservations actives max par membre" hint="0 = illimité. Compte les cours à venir réservés ou en liste d’attente.">
                <input type="number" min={0} className={ui.field} value={resa.maxActiveBookings || ''} disabled={!canEdit}
                  placeholder="0" onChange={e => upd({ maxActiveBookings: parseInt(e.target.value) || 0 })} />
              </Field>
            </Card>

            <Card className="p-4 space-y-4">
              <SectionTitle>Fenêtre de réservation</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ouverture (jours avant)" hint="0 = aucune limite.">
                  <input type="number" min={0} className={ui.field} value={resa.bookAheadDays || ''} disabled={!canEdit}
                    placeholder="0" onChange={e => upd({ bookAheadDays: parseInt(e.target.value) || 0 })} />
                </Field>
                <Field label="Fermeture (min avant)" hint="0 = jusqu’au début.">
                  <input type="number" min={0} step={15} className={ui.field} value={resa.bookCutoffMin || ''} disabled={!canEdit}
                    placeholder="0" onChange={e => upd({ bookCutoffMin: parseInt(e.target.value) || 0 })} />
                </Field>
              </div>
            </Card>

            {canEdit && <Button full onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>}
          </div>
        )}
      </div>
    </div>
  )
}
