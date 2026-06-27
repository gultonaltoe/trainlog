'use client'
import { useState } from 'react'
import {
  PageHeader, Card, SectionTitle, NavRow, Field, Toggle, Button, Badge, Segmented,
  Select, DatePicker, TimePicker, ui,
} from '@/components/ui'

// /design — design-system reference (Clean identity, orange accent). Shared
// visual source of truth + showcase of every reusable primitive.
export default function DesignPage() {
  const [toggle, setToggle] = useState(true)
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a')
  const [kind, setKind] = useState<'unlimited' | 'pack' | 'drop_in' | ''>('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('18:00')

  return (
    <div className="bg-gray-50 min-h-[100dvh]">
      <div className="max-w-lg mx-auto px-4 pb-12 space-y-6">
        <PageHeader title="Design system" subtitle="Clean · accent orange — référence visuelle" />

        <div>
          <SectionTitle>Accent</SectionTitle>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl" style={{ background: ui.primary }} />
            <code className="text-xs text-gray-500">#F97316 · --theme-primary</code>
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
          <SectionTitle>Champs & composants custom</SectionTitle>
          <Card className="p-4 space-y-3">
            <Field label="Nom" hint="Champ texte standard">
              <input className={ui.field} placeholder="CrossFit du matin" />
            </Field>
            <Field label="Type (dropdown custom)">
              <Select value={kind} onChange={setKind}
                options={[{ value: 'unlimited', label: 'Illimité' }, { value: 'pack', label: 'Carnet (crédits)' }, { value: 'drop_in', label: 'Séance à l’unité' }]} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date (picker custom)"><DatePicker value={date} onChange={setDate} /></Field>
              <Field label="Heure (picker custom)"><TimePicker value={time} onChange={setTime} /></Field>
            </div>
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
