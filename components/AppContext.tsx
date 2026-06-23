'use client'
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getMyMemberships, type Membership, type Role } from '@/lib/orgs'

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [active, setActiveState] = useState<ActiveContext>(PERSONAL)
  const [loading, setLoading] = useState(true)

  const setActive = useCallback((ctx: ActiveContext) => {
    setActiveState(ctx)
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(ctx)) } catch {}
  }, [])

  const refresh = useCallback(async () => {
    try {
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
