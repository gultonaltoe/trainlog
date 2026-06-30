'use client'
import { usePathname } from 'next/navigation'
import { useAppContext } from './AppContext'
import ContextSwitcher from './ContextSwitcher'
import NotificationBell from './NotificationBell'
import ChangelogButton from './ChangelogButton'
import ProfileAvatarButton from './ProfileAvatarButton'
import Wordmark from './Wordmark'

// Renders the context switcher at the top of every app page (in normal flow,
// so it never overlaps page content). Only shown to users who belong to at
// least one box — solo athletes see nothing.
export default function GlobalContextBar() {
  const pathname = usePathname()
  const { memberships, loading } = useAppContext()

  // Show only when the user is an active member of at least one box.
  if (loading) return null
  if (pathname.startsWith('/auth') || pathname === '/welcome' || pathname === '/design' || pathname === '/privacy' || pathname === '/terms') return null

  // Bar shows for everyone (so solo athletes get "What's New" too): box switcher
  // + notification bell for members, the wordmark for solo users.
  const hasActiveBox = memberships.some(m => m.status === 'active')

  return (
    <div className="border-b border-[color:var(--border)]"
      style={hasActiveBox
        ? { background: 'color-mix(in srgb, var(--theme-primary) 5%, var(--card))' }
        : { background: 'var(--card)' }}>
      <div className="max-w-lg mx-auto px-4 pt-3 pb-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">{hasActiveBox ? <ContextSwitcher /> : <Wordmark size={26} className="text-lg" />}</div>
        <ChangelogButton />
        {hasActiveBox && <NotificationBell />}
        <ProfileAvatarButton />
      </div>
    </div>
  )
}
