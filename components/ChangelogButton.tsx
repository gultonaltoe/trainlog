'use client'
import { useEffect, useState } from 'react'
import { getChangelog, type ChangelogEntry, type ChangelogTag } from '@/lib/changelog'

// "What's New" — megaphone button (top bar, next to the bell) + right slide-in
// panel. Unread dot when an entry was published after the last time the panel
// was opened (localStorage); opening marks everything seen.
const SEEN_KEY = 'trainlift_changelog_last_seen'

const TAG_META: Record<ChangelogTag, { label: string; emoji: string; accent: boolean }> = {
  new_feature: { label: 'New Feature', emoji: '🆕', accent: true },
  improvement: { label: 'Improvement', emoji: '⚡', accent: false },
  fix:         { label: 'Fix',         emoji: '🐛', accent: false },
}

function fmtDate(iso: string) {
  const d = new Date(iso), now = new Date()
  const o: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
  if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric'
  return d.toLocaleDateString('en-US', o)             // "June 28"
}
const isRecent = (iso: string) => Date.now() - new Date(iso).getTime() < 7 * 86400000

export default function ChangelogButton() {
  const [open, setOpen]         = useState(false)
  const [shown, setShown]       = useState(false)     // drives the slide-in transition
  const [entries, setEntries]   = useState<ChangelogEntry[] | null>(null)
  const [lastSeen, setLastSeen] = useState(0)

  useEffect(() => {
    try { setLastSeen(Number(localStorage.getItem(SEEN_KEY)) || 0) } catch {}
    getChangelog().then(setEntries).catch(() => setEntries([]))
  }, [])

  const hasUnread = !!entries?.some(e => new Date(e.publishedAt).getTime() > lastSeen)

  const openPanel = () => {
    setOpen(true); requestAnimationFrame(() => setShown(true))
    const now = Date.now()
    try { localStorage.setItem(SEEN_KEY, String(now)) } catch {}
    setLastSeen(now)
    if (entries === null) getChangelog().then(setEntries).catch(() => setEntries([]))
  }
  const close = () => { setShown(false); setTimeout(() => setOpen(false), 200) }

  return (
    <>
      <button onClick={openPanel} aria-label="Nouveautés"
        className="ds-hover relative w-10 h-10 rounded-2xl border border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)] flex items-center justify-center">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
        </svg>
        {hasUnread && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-orange-500 border-2 border-[var(--bg)]" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" onClick={close}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`} />
          <div onClick={e => e.stopPropagation()}
            className={`absolute inset-y-0 right-0 w-full max-w-sm bg-[var(--card)] shadow-2xl flex flex-col transition-transform duration-200 ${shown ? 'translate-x-0' : 'translate-x-full'}`}
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
              <h2 className="text-lg font-black text-[var(--ink)]">What&apos;s New</h2>
              <button onClick={close} aria-label="Fermer" className="text-[var(--muted)] text-2xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {entries === null ? (
                <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-10">Nothing new yet — check back soon 💪</p>
              ) : entries.map(e => {
                const m = TAG_META[e.tag] ?? TAG_META.improvement
                return (
                  <div key={e.id}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={m.accent ? { background: 'var(--theme-primary, #F97316)', color: '#fff' }
                                        : { background: 'var(--track)', color: 'var(--sub)' }}>
                        {m.emoji} {m.label}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] flex-shrink-0">
                        {isRecent(e.publishedAt) && <span className="text-[10px] font-black text-[var(--accent-text)]">NEW</span>}
                        {fmtDate(e.publishedAt)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[var(--ink)]">{e.title}</p>
                    <p className="text-sm text-[var(--ink-soft)] leading-snug mt-0.5">{e.body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
