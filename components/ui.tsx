'use client'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'

// ── Trainlog design system (ST-28) ──────────────────────────
// Reusable presentational primitives + tokens. Prefer these over ad-hoc
// Tailwind so every screen is consistent. The primary color comes from the
// CSS var --theme-primary (set per user/box), with an orange fallback.
// Showcase + reference: /design.

export const ui = {
  primary: 'var(--theme-primary, #F97316)',
  field: 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400',
  label: 'block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5',
  card: 'bg-white rounded-2xl border border-gray-200',
}

/** Page header: big title + optional subtitle and a back link. */
export function PageHeader({ title, subtitle, backHref }: { title: string; subtitle?: string; backHref?: string }) {
  return (
    <div className="pt-8 pb-4">
      {backHref && (
        <Link href={backHref} className="text-sm font-bold text-gray-400 hover:text-gray-600 mb-2 inline-flex items-center gap-1">
          ‹ Retour
        </Link>
      )}
      <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

/** A white rounded container. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${ui.card} ${className}`}>{children}</div>
}

/** Uppercase section label. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{children}</p>
}

/** A tappable row for index/menu screens (icon · title · hint · chevron). */
export function NavRow({ href, icon, title, hint }: { href: string; icon: string; title: string; hint?: string }) {
  return (
    <Link href={href}
      className={`${ui.card} p-4 flex items-center gap-3 hover:shadow-sm hover:border-gray-300 transition`}>
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-gray-800">{title}</span>
        {hint && <span className="block text-xs text-gray-400 truncate">{hint}</span>}
      </span>
      <span className="text-gray-300">›</span>
    </Link>
  )
}

/** Label + control wrapper for forms. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={ui.label}>{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

/** Row with a label on the left and a switch on the right (+ optional hint). */
export function Toggle({ label, hint, checked, disabled, onChange }: {
  label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <input type="checkbox" className="w-5 h-5 accent-orange-500 flex-shrink-0" checked={checked}
          disabled={disabled} onChange={e => onChange(e.target.checked)} />
      </label>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

/** Primary / ghost button. */
export function Button({ children, onClick, disabled, variant = 'primary', type = 'button', full }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean
  variant?: 'primary' | 'ghost'; type?: 'button' | 'submit'; full?: boolean
}) {
  const base = `${full ? 'w-full ' : ''}rounded-2xl font-black text-sm py-3 px-4 transition disabled:opacity-50 cursor-pointer`
  if (variant === 'ghost')
    return <button type={type} onClick={onClick} disabled={disabled} className={`${base} border border-gray-200 text-gray-600`}>{children}</button>
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} text-white`} style={{ background: ui.primary }}>{children}</button>
}

/** Small status pill. */
export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'amber' | 'red' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-600',
  }
  return <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>
}

/** Segmented control (small tabs). */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: [T, string][]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white text-xs font-bold">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className="flex-1 py-2 px-2 cursor-pointer"
          style={value === v ? { background: ui.primary, color: '#fff' } : { color: '#6B7280' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Custom Select (branded dropdown — replaces native <select>) ──────────────
export type Option<T extends string> = { value: T; label: string }

export function Select<T extends string>({ value, onChange, options, placeholder = 'Choisir…', disabled }: {
  value: T | ''; onChange: (v: T) => void; options: Option<T>[]; placeholder?: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const current = options.find(o => o.value === value)
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className={`${ui.field} flex items-center justify-between gap-2 cursor-pointer ${!current ? 'text-gray-400' : ''}`}>
        <span className="truncate">{current?.label ?? placeholder}</span>
        <span className="text-gray-400 text-xs flex-shrink-0">▾</span>
      </button>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto py-1">
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer">
              <span className={o.value === value ? 'font-bold text-gray-900' : 'text-gray-700'}>{o.label}</span>
              {o.value === value && <span style={{ color: ui.primary }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Date / Time pickers ──────────────────────────────────────────────────────
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function monthCells(y: number, m: number): (number | null)[] {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const n = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= n; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
}

/** Branded date picker. value/onChange use "YYYY-MM-DD". */
export function DatePicker({ value, onChange, placeholder = 'Choisir une date', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const sel = value ? new Date(value + 'T00:00:00') : null
  const init = sel ?? new Date()
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() })
  const label = sel ? sel.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : placeholder
  const shift = (d: number) => setYm(s => { const x = new Date(s.y, s.m + d, 1); return { y: x.getFullYear(), m: x.getMonth() } })

  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className={`${ui.field} flex items-center justify-between gap-2 cursor-pointer ${!sel ? 'text-gray-400' : ''}`}>
        <span className="truncate">📅 {label}</span>
        <span className="text-gray-400 text-xs flex-shrink-0">▾</span>
      </button>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      {open && (
        <div className="absolute z-50 mt-1 w-72 max-w-[90vw] rounded-2xl border border-gray-200 bg-white shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer">‹</button>
            <span className="text-sm font-bold text-gray-800">{MONTHS[ym.m]} {ym.y}</span>
            <button type="button" onClick={() => shift(1)} className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer">›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">{DOW.map((d, i) => <span key={i} className="text-center text-[10px] font-bold text-gray-400">{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthCells(ym.y, ym.m).map((day, i) => {
              if (!day) return <div key={i} />
              const ds = isoDate(new Date(ym.y, ym.m, day))
              const isSel = ds === value
              return (
                <button key={i} type="button" onClick={() => { onChange(ds); setOpen(false) }}
                  className="h-9 rounded-lg text-sm font-semibold cursor-pointer transition"
                  style={isSel ? { background: ui.primary, color: '#fff' } : { color: '#374151' }}>
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Branded time picker (dropdown of HH:MM at `step` minutes). value "HH:MM". */
export function TimePicker({ value, onChange, step = 15, from = 5, to = 23, disabled }: {
  value: string; onChange: (v: string) => void; step?: number; from?: number; to?: number; disabled?: boolean
}) {
  const opts: Option<string>[] = []
  for (let h = from; h <= to; h++)
    for (let m = 0; m < 60; m += step)
      opts.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` })
  return <Select value={value} onChange={onChange} options={opts} placeholder="Heure" disabled={disabled} />
}
