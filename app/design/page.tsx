'use client'
import { useState } from 'react'
import {
  PageHeader, Card, SectionTitle, NavRow, Field, Toggle, Button, Badge,
  Segmented, Select, DatePicker, TimePicker,
} from '@/components/ui'

// /design — design-system reference + gallery (ST-28/38/39). Every primitive
// shown on real surfaces. The dark toggle flips the CSS-variable tokens for the
// whole gallery (scoped to this page via a `.dark` wrapper) so we can validate
// light + dark together before the app-wide rollout.

export default function DesignReference() {
  const [dark, setDark] = useState(false)
  const [plan, setPlan] = useState<'unlimited' | 'pack' | 'drop_in' | ''>('')
  const [view, setView] = useState<'week' | 'month'>('week')
  const [on, setOn] = useState(true)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  return (
    <div className={dark ? 'dark' : ''} style={{ background: 'var(--bg)', minHeight: '100dvh', transition: 'background .2s' }}>
      <div className="max-w-lg mx-auto px-4 pb-16">
        <div className="flex items-start justify-between">
          <PageHeader title="Design system" subtitle="Identité Clean · accent orange #F97316" />
          <button onClick={() => setDark(d => !d)}
            className="ds-hover mt-9 text-xs font-black px-3 py-1.5 rounded-full border border-[color:var(--border)] text-[var(--ink)]">
            {dark ? '☀︎ Clair' : '☾ Sombre'}
          </button>
        </div>

        <div className="space-y-8">
          {/* Buttons */}
          <section>
            <SectionTitle>Boutons</SectionTitle>
            <div className="flex flex-wrap gap-2 mb-2">
              <Button>Primaire</Button>
              <Button variant="secondary">Secondaire</Button>
              <Button variant="ghost">Ghost</Button>
              <Button disabled>Désactivé</Button>
            </div>
            <Button full>Pleine largeur</Button>
          </section>

          {/* Badges */}
          <section>
            <SectionTitle>Badges</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <Badge>Neutre</Badge>
              <Badge tone="green">Réservé</Badge>
              <Badge tone="amber">Liste d’attente</Badge>
              <Badge tone="red">Complet</Badge>
            </div>
          </section>

          {/* Form controls */}
          <section className="space-y-4">
            <SectionTitle>Formulaires</SectionTitle>
            <Card className="p-4 space-y-4">
              <Field label="Champ texte" hint="Style ds-field, tokenisé.">
                <input className="ds-field" placeholder="WOD du jour…" />
              </Field>
              <Field label="Select (dropdown maison)">
                <Select value={plan} onChange={setPlan} placeholder="Choisir un abonnement"
                  options={[
                    { value: 'unlimited', label: 'Illimité' },
                    { value: 'pack', label: 'Carnet 10 séances' },
                    { value: 'drop_in', label: 'Séance à l’unité' },
                  ]} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date"><DatePicker value={date} onChange={setDate} /></Field>
                <Field label="Heure"><TimePicker value={time} onChange={setTime} /></Field>
              </div>
              <div>
                <SectionTitle>Segmented</SectionTitle>
                <Segmented value={view} onChange={setView} options={[['week', 'Semaine'], ['month', 'Mois']]} />
              </div>
              <Toggle label="Liste d’attente" checked={on} onChange={setOn}
                hint="Permet aux membres de s’inscrire quand un cours est complet." />
            </Card>
          </section>

          {/* Nav rows */}
          <section>
            <SectionTitle>Lignes de navigation</SectionTitle>
            <div className="space-y-2">
              <NavRow href="/design" icon="📅" title="Réservations" hint="Liste d’attente, annulation, fenêtre" />
              <NavRow href="/design" icon="🏋️" title="Types de séances" hint="Durée et places par défaut" />
            </div>
          </section>

          {/* Hover convention */}
          <section>
            <SectionTitle>Survol & curseur</SectionTitle>
            <Card className="p-4 text-sm text-[var(--sub)] space-y-2">
              <p>Tout élément interactif : <code className="text-[var(--ink)]">cursor-pointer</code> + survol subtil.</p>
              <p>• Boutons pleins → légère atténuation (opacity).</p>
              <p>• Surfaces (lignes, options, jours) → teinte <code className="text-[var(--ink)]">--hover</code> via <code className="text-[var(--ink)]">.ds-hover</code>.</p>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
