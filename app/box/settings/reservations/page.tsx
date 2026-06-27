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
                    <p className="text-[11px] text-[var(--muted)] mt-1.5">
                      {resa.waitlistMode === 'auto_promote'
                        ? 'Le premier en attente est automatiquement inscrit.'
                        : resa.waitlistMode === 'notify_all'
                        ? 'Tout le monde en attente est prévenu — premier arrivé, premier servi.'
                        : 'Le premier en attente est prévenu et doit confirmer sa place.'}
                    </p>
                  </div>
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
