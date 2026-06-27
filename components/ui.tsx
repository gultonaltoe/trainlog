'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'

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
