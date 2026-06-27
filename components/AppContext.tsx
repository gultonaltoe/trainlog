'use client'
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getMyMemberships, type Membership, type Role } from '@/lib/orgs'
import { acceptMyInvites } from '@/lib/invites'

// The "active view" the user is currently in: their personal athlete space,
// or one of their boxes (with the role they hold there). This is what makes
// the single app feel like one environment you switch contexts within.
export type ActiveContext =
  | { type: 'personal' }
  | { type: 'org'; orgId: string; orgName: string; role: Role }

type AppContextValue = {
  loading: boolean
  memberships: Membership[]
  active: ActiveContext
  setActive: (ctx: ActiveContext) => void
  refresh: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)
const ACTIVE_KEY = 'trainlog_active_ctx'
const PERSONAL: ActiveContext = { type: 'personal' }

// `initialActive` comes from the server (cookie) so the bottom nav SSRs with the
// correct menu — no personal-menu flash on reload.
export function AppProvider({ children, initialActive }: { children: ReactNode; initialActive?: ActiveContext | null }) {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [active, setActiveState] = useState<ActiveContext>(initialActive ?? PERSONAL)
  const [loading, setLoading] = useState(true)

  const setActive = useCallback((ctx: ActiveContext) => {
    setActiveState(ctx)
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(ctx)) } catch {}
    // Mirror to a cookie so the next server render knows the active view.
    try { document.cookie = `${ACTIVE_KEY}=${encodeURIComponent(JSON.stringify(ctx))}; path=/; max-age=31536000; samesite=lax` } catch {}
  }, [])

  const refresh = useCallback(async () => {
    try {
      // Claim any pending email invites for this user before reading memberships,
      // so a freshly-invited coach/member shows up immediately.
      await acceptMyInvites()
      const mine = await getMyMemberships()
      setMemberships(mine)
      // Restore the previously-selected view if it's still valid.
      let stored: ActiveContext | null = null
      try {
        const raw = localStorage.getItem(ACTIVE_KEY)
        if (raw) stored = JSON.parse(raw) as ActiveContext
      } catch {}
      const s = stored
      // Only restore into a box the user is an ACTIVE member of (not pending).
      if (s && s.type === 'org' && !mine.some(m => m.organizationId === s.orgId && m.status === 'active')) {
        stored = null  // left/never-active in that org — fall back to personal
      }
      setActiveState(stored ?? PERSONAL)
    } catch {
      setMemberships([])           // logged out or no orgs
      setActiveState(PERSONAL)
    } finally {
      setLoading(false)
    }
  }, [])

  // Optimistic: restore the saved view immediately on mount so the bottom nav
  // doesn't flash the personal menu while memberships load (refresh() validates
  // it once memberships arrive). Speeds up reloads + view switches.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY)
      if (raw) setActiveState(JSON.parse(raw) as ActiveContext)
    } catch {}
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <AppContext.Provider value={{ loading, memberships, active, setActive, refresh }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within <AppProvider>')
  return ctx
}
