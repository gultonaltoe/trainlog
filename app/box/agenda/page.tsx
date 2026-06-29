'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ST-50 + merge: the coach agenda now lives as the "Agenda" mode of /box/planning.
// This route redirects there to keep old links/bookmarks working.
export default function AgendaRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/box/planning') }, [router])
  return <p className="text-sm text-[var(--muted)] text-center py-10">Redirection vers le Planning…</p>
}
