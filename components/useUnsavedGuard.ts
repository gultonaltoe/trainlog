'use client'
import { useEffect } from 'react'

// Warn before leaving (refresh/close/navigate away) when there are unsaved
// edits (ST-43). App Router doesn't expose a clean in-app route-block API, so
// this covers the browser-level navigations; in-app we rely on the sticky save
// bar staying visible. Pass `dirty = true` while the form has unsaved changes.
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
