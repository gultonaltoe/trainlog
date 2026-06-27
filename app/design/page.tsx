'use client'
import { useState } from 'react'

// /design — live identity explorer (ST-38). Flip between candidate themes on a
// realistic mock screen to choose our visual identity, then we bake the winner
// into the design tokens. Self-contained (inline-styled from theme tokens) so
// colors actually change on switch.

type Theme = {
  key: string; label: string; vibe: string
  bg: string; card: string; ink: string; sub: string; border: string
  primary: string; primaryInk: string; track: string
}

const THEMES: Theme[] = [
  { key: 'volt', label: 'Volt', vibe: 'Sombre & électrique · énergie salle de sport',
    bg: '#0E0F12', card: '#17181C', ink: '#FFFFFF', sub: '#A1A1AA', border: '#2A2B30',
    primary: '#D8FF3D', primaryInk: '#0E0F12', track: '#2A2B30' },
  { key: 'midnight', label: 'Midnight', vibe: 'Sombre premium · sobre, haut de gamme',
    bg: '#0B0B14', card: '#161622', ink: '#FFFFFF', sub: '#9CA3AF', border: '#26263A',
    primary: '#7C5CFC', primaryInk: '#FFFFFF', track: '#26263A' },
  { key: 'clean', label: 'Clean', vibe: 'Clair premium · épuré, aéré',
    bg: '#FAFAFB', card: '#FFFFFF', ink: '#0B0B14', sub: '#6B7280', border: '#E8E8EC',
    primary: '#4F46E5', primaryInk: '#FFFFFF', track: '#ECECF1' },
]

export default function DesignExplorer() {
  const [i, setI] = useState(0)
  const t = THEMES[i]

  return (
    <div style={{ minHeight: '100dvh', background: t.bg, transition: 'background .2s' }}>
      <div className="max-w-lg mx-auto px-4 pb-12">
        {/* Theme switcher */}
        <div className="pt-6 pb-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: t.sub }}>Identité — choisis</p>
          <div className="flex rounded-2xl overflow-hidden border" style={{ borderColor: t.border }}>
            {THEMES.map((th, idx) => (
              <button key={th.key} onClick={() => setI(idx)} className="flex-1 py-2.5 text-sm font-black cursor-pointer transition"
                style={idx === i ? { background: t.primary, color: t.primaryInk } : { background: t.card, color: t.sub }}>
                {th.label}
              </button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: t.sub }}>{t.vibe}</p>
        </div>

        {/* ── Mock screen in the selected theme ── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: t.ink }}>CrossFit Lyon</h1>
            <p className="text-sm" style={{ color: t.sub }}>Espace propriétaire</p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg" style={{ background: t.card, border: `1px solid ${t.border}` }}>🔔</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[['24', 'Membres'], ['78%', 'Occupation'], ['64%', 'Résa moy.']].map(([v, l]) => (
            <div key={l} className="rounded-2xl p-4 text-center" style={{ background: t.card, border: `1px solid ${t.border}` }}>
              <p className="text-2xl font-black" style={{ color: t.ink }}>{v}</p>
              <p className="text-[11px] mt-0.5" style={{ color: t.sub }}>{l}</p>
            </div>
          ))}
        </div>

        {/* Occupancy bar */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: t.card, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold" style={{ color: t.ink }}>Aujourd’hui</p>
            <span className="text-xs font-black" style={{ color: t.primary }}>▲ 12%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: t.track }}>
            <div className="h-full rounded-full" style={{ width: '78%', background: t.primary }} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mb-4">
          <button className="flex-1 py-3.5 rounded-2xl font-black text-sm" style={{ background: t.primary, color: t.primaryInk }}>Réserver</button>
          <button className="py-3.5 px-5 rounded-2xl font-black text-sm" style={{ background: 'transparent', color: t.ink, border: `1px solid ${t.border}` }}>Annuler</button>
        </div>

        {/* Class rows */}
        <div className="space-y-2 mb-4">
          {[['CrossFit', '18:00–19:00', '12/14', 'ok'], ['Haltéro', '19:00–20:30', '8/8', 'full']].map(([title, time, cap, st]) => (
            <div key={title} className="rounded-2xl p-3 flex items-center justify-between" style={{ background: t.card, border: `1px solid ${t.border}` }}>
              <div>
                <p className="text-sm font-bold" style={{ color: t.ink }}>{title}</p>
                <p className="text-xs" style={{ color: t.sub }}>{time} · {cap}</p>
              </div>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
                style={st === 'full' ? { background: '#EF444422', color: '#F87171' } : { background: t.primary, color: t.primaryInk }}>
                {st === 'full' ? 'Complet' : 'Réserver'}
              </span>
            </div>
          ))}
        </div>

        {/* Badges */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: t.primary, color: t.primaryInk }}>Réservé</span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#F59E0B22', color: '#FBBF24' }}>Liste d’attente</span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: t.track, color: t.sub }}>Neutre</span>
        </div>

        <p className="text-xs mt-6" style={{ color: t.sub }}>
          Palette {t.label} — accent {t.primary} · fond {t.bg} · carte {t.card}
        </p>
      </div>
    </div>
  )
}
