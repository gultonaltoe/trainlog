'use client'
import { useAppContext } from './AppContext'

// ST-81 — persistent reassurance on the dashboard while a join request is still
// awaiting the box's approval. Disappears automatically once the membership
// becomes active (then ST-80's approval banner takes over) or is refused.
export default function PendingBanner() {
  const { memberships } = useAppContext()
  const pending = memberships.filter(m => m.status === 'pending')
  if (pending.length === 0) return null

  const names = pending.map(m => m.organizationName).join(', ')
  return (
    <div className="rounded-2xl border border-amber-300 bg-[var(--card)] p-4 mb-4 flex items-start gap-3">
      <span className="text-2xl flex-shrink-0 leading-none">⏳</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--ink)]">Demande d’adhésion en cours</p>
        <p className="text-xs text-[var(--ink-soft)] mt-0.5 leading-snug">
          Ta demande pour <span className="font-semibold">{names}</span> a bien été envoyée. La box doit la valider —
          tu seras prévenu dès l’acceptation.
        </p>
      </div>
    </div>
  )
}
