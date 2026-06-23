'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext } from './AppContext'
import type { Role } from '@/lib/orgs'

export type ActiveOrg = { orgId: string; orgName: string; role: Role }

/**
 * For box (coaching) pages: ensures the active view is a box and the user is
 * owner/coach/staff. Redirects to "/" otherwise. Returns the active org, or
 * null while loading/redirecting (render nothing in that case).
 */
export function useBoxGuard(): ActiveOrg | null {
  const { active, loading } = useAppContext()
  const router = useRouter()
  const ok = active.type === 'org' && active.role !== 'member'

  useEffect(() => {
    if (!loading && !ok) router.replace('/')
  }, [loading, ok, router])

  if (active.type !== 'org' || active.role === 'member') return null
  return { orgId: active.orgId, orgName: active.orgName, role: active.role }
}
