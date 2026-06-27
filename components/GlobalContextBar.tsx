'use client'
import { usePathname } from 'next/navigation'
import { useAppContext } from './AppContext'
import ContextSwitcher from './ContextSwitcher'
import NotificationBell from './NotificationBell'

// Renders the context switcher at the top of every app page (in normal flow,
// so it never overlaps page content). Only shown to users who belong to at
// least one box — solo athletes see nothing.
export default function GlobalContextBar() {
  const pathname = usePathname()
  const { memberships, loading } = useAppContext()

  // Show only when the user is an active member of at least one box.
  const hasActiveBox = memberships.some(m => m.status === 'active')
  if (loading || !hasActiveBox) return null
  if (pathname.startsWith('/auth') || pathname === '/welcome' || pathname === '/design') return null

  return (
    <div style={{ background: 'var(--bg)' }}>
      <div className="max-w-lg mx-auto px-4 pt-4 flex items-start gap-2">
        <div className="flex-1 min-w-0"><ContextSwitcher /></div>
        <div className="pt-0"><NotificationBell /></div>
      </div>
    </div>
  )
}
