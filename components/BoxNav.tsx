'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Sub-navigation for the box (coaching) side. Shown on the management pages.
const TABS = [
  { href: '/',             label: 'Tableau' },
  { href: '/box/members',  label: 'Membres' },
  { href: '/box/staff',    label: 'Staff' },
  { href: '/box/planning', label: 'Planning' },
]

export default function BoxNav() {
  const path = usePathname()
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
      {TABS.map(t => {
        const active = t.href === '/' ? path === '/' : path === t.href
        return (
          <Link key={t.href} href={t.href}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              active ? 'text-white' : 'text-gray-500 bg-gray-100'
            }`}
            style={active ? { background: 'var(--theme-primary, #F97316)' } : {}}>
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
