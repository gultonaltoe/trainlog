'use client'
import { usePathname } from 'next/navigation'
import { useAppContext } from './AppContext'
import ContextSwitcher from './ContextSwitcher'

// Renders the context switcher at the top of every app page (in normal flow,
// so it never overlaps page content). Only shown to users who belong to at
// least one box — solo athletes see nothing.
export default function GlobalContextBar() {
  const pathname = usePathname()
  const { memberships, loading } = useAppContext()

  if (loading || memberships.length === 0) return null
  if (pathname.startsWith('/auth') || pathname === '/welcome') return null

  return (
    <div style={{ background: '#F9FAFB' }}>
      <div className="max-w-lg mx-auto px-4 pt-4">
        <ContextSwitcher />
      </div>
    </div>
  )
}
