'use client'
import { useEffect, useState } from 'react'

// /design — identity playground (ST-38). Pick the exact orange, a secondary
// button style, and light/dark — all previewed live on a realistic mock.
// Choices persist (localStorage) so a refresh keeps them. Once locked, we bake
// the winners into the real design tokens (components/ui.tsx).

const ORANGES = ['#F97316', '#FF6A00', '#EA580C', '#FF7849', '#F4511E']
const ORANGE_LABEL: Record<string, string> = {
  '#F97316': 'Actuel', '#FF6A00': 'Punchy', '#EA580C': 'Profond', '#FF7849': 'Chaud', '#F4511E': 'Material',
}
type SecStyle = 'ink' | 'tint' | 'outline'

const light = { bg: '#FAFAFB', card: '#FFFFFF', ink: '#0B0B14', sub: '#6B7280', border: '#E8E8EC', track: '#ECECF1', ink2: '#111827' }
const dark = { bg: '#0E0F12', card: '#17181C', ink: '#FFFFFF', sub: '#A1A1AA', border: '#2A2B30', track: '#2A2B30', ink2: '#E5E7EB' }

export default function DesignPlayground() {
  const [accent, setAccent] = useState('#F97316')
  const [isDark, setIsDark] = useState(false)
  const [sec, setSec] = useState<SecStyle>('ink')

  // Persist + restore (so refresh keeps the look).
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('design_play') || '{}')
      if (s.accent) setAccent(s.accent); if (typeof s.isDark === 'boolean') setIsDark(s.isDark); if (s.sec) setSec(s.sec)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('design_play', JSON.stringify({ accent, isDark, sec })) } catch {}
  }, [accent, isDark, sec])

  const t = isDark ? dark : light
  const secStyle: React.CSSProperties =
    sec === 'ink' ? { background: t.ink2, color: isDark ? '#0E0F12' : '#fff' }
    : sec === 'tint' ? { background: accent + '22', color: accent }
    : { background: 'transparent', color: t.ink, border: `1.5px solid ${t.border}` }

  return (
    <div style={{ minHeight: '100dvh', background: t.bg, transition: 'background .2s' }}>
      <div className="max-w-lg mx-auto px-4 pb-12">
        {/* Controls */}
        <div className="pt-6 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.sub }}>Playground identité</p>
            <button onClick={() => setIsDark(d => !d)} className="text-xs font-black px-3 py-1.5 rounded-full cursor-pointer"
              style={{ background: t.card, color: t.ink, border: `1px solid ${t.border}` }}>
              {isDark ? '☀︎ Clair' : '☾ Sombre'}
            </button>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: t.sub }}>Nuance d’orange</p>
            <div className="flex gap-2">
              {ORANGES.map(c => (
                <button key={c} onClick={() => setAccent(c)} className="flex-1 h-10 rounded-xl cursor-pointer flex items-end justify-center pb-1"
                  style={{ background: c, outline: accent === c ? `3px solid ${t.ink}` : 'none', outlineOffset: 2 }}>
                  <span className="text-[8px] font-bold text-white/90">{ORANGE_LABEL[c]}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-1" style={{ color: t.sub }}>Sélection : {accent}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: t.sub }}>Bouton secondaire</p>
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: t.border }}>
              {(['ink', 'tint', 'outline'] as SecStyle[]).map(s => (
                <button key={s} onClick={() => setSec(s)} className="flex-1 py-2 text-xs font-bold cursor-pointer"
                  style={sec === s ? { background: accent, color: '#fff' } : { background: t.card, color: t.sub }}>
                  {s === 'ink' ? 'Encre' : s === 'tint' ? 'Teinte' : 'Contour'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Live mock ── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: t.ink }}>CrossFit Lyon</h1>
            <p className="text-sm" style={{ color: t.sub }}>Espace propriétaire</p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg" style={{ background: t.card, border: `1px solid ${t.border}` }}>🔔</div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[['24', 'Membres'], ['78%', 'Occupation'], ['64%', 'Résa moy.']].map(([v, l]) => (
            <div key={l} className="rounded-2xl p-4 text-center" style={{ background: t.card, border: `1px solid ${t.border}` }}>
              <p className="text-2xl font-black" style={{ color: t.ink }}>{v}</p>
              <p className="text-[11px] mt-0.5" style={{ color: t.sub }}>{l}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4 mb-4" style={{ background: t.card, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold" style={{ color: t.ink }}>Aujourd’hui</p>
            <span className="text-xs font-black" style={{ color: accent }}>▲ 12%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: t.track }}>
            <div className="h-full rounded-full" style={{ width: '78%', background: accent }} />
          </div>
        </div>

        {/* Primary + secondary buttons */}
        <div className="flex gap-2 mb-4">
          <button className="flex-1 py-3.5 rounded-2xl font-black text-sm" style={{ background: accent, color: '#fff' }}>Réserver</button>
          <button className="py-3.5 px-5 rounded-2xl font-black text-sm" style={secStyle}>Annuler</button>
        </div>

        <div className="space-y-2 mb-4">
          {[['CrossFit', '18:00–19:00', '12/14', false], ['Haltéro', '19:00–20:30', '8/8', true]].map(([title, time, cap, full]) => (
            <div key={title as string} className="rounded-2xl p-3 flex items-center justify-between" style={{ background: t.card, border: `1px solid ${t.border}` }}>
              <div>
                <p className="text-sm font-bold" style={{ color: t.ink }}>{title}</p>
                <p className="text-xs" style={{ color: t.sub }}>{time} · {cap}</p>
              </div>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
                style={full ? { background: '#EF444422', color: '#F87171' } : { background: accent, color: '#fff' }}>
                {full ? 'Complet' : 'Réserver'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: accent, color: '#fff' }}>Réservé</span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#F59E0B22', color: '#FBBF24' }}>Liste d’attente</span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: t.track, color: t.sub }}>Neutre</span>
        </div>

        <p className="text-xs mt-6" style={{ color: t.sub }}>
          {isDark ? 'Sombre' : 'Clair'} · accent {accent} · secondaire « {sec} »
        </p>
      </div>
    </div>
  )
}
