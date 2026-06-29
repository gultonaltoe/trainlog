'use client'
import { useEffect, useState } from 'react'
import { getUnreadByType, markRead, type AppNotification } from '@/lib/notifications'

// ST-80 — celebratory banner shown on the dashboard once a box approves the
// member's join request. Driven by the unread 'membership_approved' notification
// (created by a DB trigger on approval); dismissing marks it read so it's one-shot.
export default function ApprovalBanner() {
  const [n, setN] = useState<AppNotification | null>(null)
  useEffect(() => { void getUnreadByType('membership_approved').then(setN).catch(() => {}) }, [])
  if (!n) return null

  const dismiss = () => { void markRead(n.id); setN(null) }
  return (
    <div className="rounded-2xl border border-[color:var(--accent-soft)] bg-[var(--accent-soft)] p-4 mb-4 flex items-start gap-3">
      <span className="text-2xl flex-shrink-0 leading-none">🎉</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--ink)]">{n.title}</p>
        {n.body && <p className="text-xs text-[var(--ink-soft)] mt-0.5 leading-snug">{n.body}</p>}
      </div>
      <button onClick={dismiss} aria-label="Fermer" className="text-[var(--muted)] hover:text-[var(--ink-soft)] text-xl leading-none flex-shrink-0">×</button>
    </div>
  )
}
