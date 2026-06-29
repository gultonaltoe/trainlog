'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppContext } from './AppContext'

type NavItem = { href: string; label: string; icon: (active: boolean) => React.ReactNode }

// Athlete menu (personal context, and members inside a box).
const ATHLETE_NAV: NavItem[] = [
  { href: '/', label: 'Accueil', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
    </svg>
  )},
  { href: '/log', label: 'Séance', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )},
  { href: '/performance', label: 'Progression', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 3 3 5-6" />
    </svg>
  )},
  { href: '/profile', label: 'Profil', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
]

// Box menu (owner / coach inside a box).
const BOX_NAV: NavItem[] = [
  { href: '/', label: 'Tableau', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  )},
  { href: '/box/members', label: 'Membres', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.5-4.6" />
    </svg>
  )},
  { href: '/box/staff', label: 'Coachs', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
  { href: '/box/planning', label: 'Planning', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )},
  { href: '/box/settings', label: 'Réglages', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { href: '/profile', label: 'Profil', icon: a => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
]

// Members inside a box: athlete menu + a "Réserver" booking tab.
const COURS_ITEM: NavItem = { href: '/box/book', label: 'Réserver', icon: a => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)}
const MEMBER_BOX_NAV: NavItem[] = [ATHLETE_NAV[0], COURS_ITEM, ...ATHLETE_NAV.slice(1)]

export default function BottomNav() {
  const path = usePathname()
  const { active, memberships } = useAppContext()
  if (path === '/welcome' || path === '/design' || path === '/privacy' || path === '/terms') return null

  // Owner/coach in a box get the management menu. The athlete menu gains a
  // "Cours" booking tab whenever the user belongs to a box — whether they're a
  // member in box context, or in their personal athlete view.
  const inBox = active.type === 'org' && active.role !== 'member'
  const hasBox = memberships.some(m => m.status === 'active')
  const showCours = (active.type === 'org' && active.role === 'member') || (active.type === 'personal' && hasBox)
  const NAV = inBox ? BOX_NAV : showCours ? MEMBER_BOX_NAV : ATHLETE_NAV

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] border-t border-[color:var(--border)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-lg mx-auto flex">
        {NAV.map(item => {
          const active = item.href === '/'
            ? path === '/'
            : item.href === '/performance'
              ? (path.startsWith('/performance') || path.startsWith('/prs') || path.startsWith('/sessions'))
              : path.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                active ? 'text-orange-500' : 'text-[var(--muted)]'
              }`}>
              {item.icon(active)}
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
