'use client'
import { useState } from 'react'
import { PageHeader, Card, SectionTitle, NavRow, Field, Toggle, Button, Badge, Segmented, ui } from '@/components/ui'

// /design — the design-system reference page. Shared visual source of truth:
// every reusable primitive shown in one place so we validate consistency here.
export default function DesignPage() {
  const [toggle, setToggle] = useState(true)
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a')

  return (
    <div className="bg-gray-50 min-h-[100dvh]">
      <div className="max-w-lg mx-auto px-4 pb-10 space-y-6">
        <PageHeader title="Design system" subtitle="Composants & tokens — référence visuelle" />

        <div>
          <SectionTitle>Couleur primaire</SectionTitle>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl" style={{ background: ui.primary }} />
            <code className="text-xs text-gray-500">--theme-primary</code>
          </div>
        </div>

        <div>
          <SectionTitle>Boutons</SectionTitle>
          <div className="flex gap-2">
            <Button onClick={() => {}}>Primary</Button>
            <Button variant="ghost" onClick={() => {}}>Ghost</Button>
            <Button disabled onClick={() => {}}>Disabled</Button>
          </div>
        </div>

        <div>
          <SectionTitle>Badges</SectionTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge>Neutre</Badge><Badge tone="green">Actif</Badge><Badge tone="amber">En attente</Badge><Badge tone="red">Complet</Badge>
          </div>
        </div>

        <div>
          <SectionTitle>Segmented</SectionTitle>
          <Segmented options={[['a', 'Semaine'], ['b', 'Mois'], ['c', 'Liste']]} value={seg} onChange={setSeg} />
        </div>

        <div>
          <SectionTitle>Card + champs</SectionTitle>
          <Card className="p-4 space-y-3">
            <Field label="Nom" hint="Texte d'aide optionnel">
              <input className={ui.field} placeholder="CrossFit du matin" />
            </Field>
            <Field label="Places">
              <input type="number" className={ui.field} defaultValue={14} />
            </Field>
            <Toggle label="Exiger un abonnement" hint="Les coachs sont exemptés" checked={toggle} onChange={setToggle} />
          </Card>
        </div>

        <div>
          <SectionTitle>Lignes de navigation (index)</SectionTitle>
          <div className="space-y-2">
            <NavRow href="/design" icon="📅" title="Réservations" hint="5 règles" />
            <NavRow href="/design" icon="🏋️" title="Types de séances" hint="6 types" />
          </div>
        </div>
      </div>
    </div>
  )
}
