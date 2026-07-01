'use client'
import { useBoxGuard } from '@/components/useBoxGuard'
import { PageHeader, NavRow } from '@/components/ui'

// Settings hub (ST-29): a menu of focused sub-pages instead of one long form.
export default function BoxSettingsPage() {
  const org = useBoxGuard()
  if (!org) return null

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-8">
        <PageHeader title="Réglages" subtitle={org.orgName} />
        <div className="space-y-2">
          <NavRow href="/box/settings/reservations" icon="📅" title="Réservations"
            hint="Liste d’attente, annulation, fenêtre de réservation" />
          <NavRow href="/box/settings/types" icon="🏋️" title="Types de séances"
            hint="Durée et places par défaut de tes cours" />
          <NavRow href="/box/settings/programming" icon="📝" title="Programmation"
            hint="Visibilité du WOD pour tes membres" />
          <NavRow href="/box/settings/brand" icon="🎨" title="Marque & politique"
            hint="Logo, couleur, politique d’annulation" />
        </div>
      </div>
    </div>
  )
}
