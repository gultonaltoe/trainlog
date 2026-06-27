'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getNotifications, markRead, markAllRead, type AppNotification } from '@/lib/notifications'

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  return `il y a ${Math.floor(s / 86400)} j`
}

// Bell + unread badge in the top bar; opens a sheet listing notifications.
export default function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try { setItems(await getNotifications()) } catch { /* non-fatal */ }
  }, [])
  useEffect(() => { void load() }, [load])

  const unread = items.filter(n => !n.readAt).length

  const openNotif = async (n: AppNotification) => {
    if (!n.readAt) { await markRead(n.id); setItems(xs => xs.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) }
    setOpen(false)
    if (n.link) router.push(n.link)
  }
  const allRead = async () => {
    await markAllRead()
    setItems(xs => xs.map(x => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })))
  }

  return (
    <div className="relative">
      <button onClick={() => { setOpen(o => !o); if (!open) void load() }}
        className="relative w-10 h-10 rounded-2xl border border-[color:var(--border)] bg-[var(--card)] flex items-center justify-center cursor-pointer"
        aria-label="Notifications">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#4B5563" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 max-w-[85vw] rounded-2xl border border-[color:var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[color:var(--track)]">
            <span className="text-sm font-black text-[var(--ink)]">Notifications</span>
            {unread > 0 && <button onClick={allRead} className="text-[11px] font-bold text-[var(--accent-text)] cursor-pointer">Tout lu</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-[var(--border-strong)] text-center py-8">Aucune notification.</p>
            ) : items.map(n => (
              <button key={n.id} onClick={() => openNotif(n)}
                className="w-full text-left px-4 py-3 border-b border-[color:var(--border)] hover:bg-[var(--hover)] flex gap-2 cursor-pointer">
                {!n.readAt && <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                <span className={`min-w-0 ${n.readAt ? 'pl-4' : ''}`}>
                  <span className="block text-sm font-bold text-[var(--ink)]">{n.title}</span>
                  {n.body && <span className="block text-xs text-[var(--sub)] truncate">{n.body}</span>}
                  <span className="block text-[10px] text-[var(--muted)] mt-0.5">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
