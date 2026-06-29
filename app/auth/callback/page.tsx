'use client'
import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function CallbackHandler() {
  const router = useRouter()

  useEffect(() => {
    // Errors come back in either the hash (implicit/OAuth) or the query string;
    // surface the real reason instead of a generic message so failures are debuggable.
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const qs = window.location.search.startsWith('?') ? window.location.search.slice(1) : ''
    const p = new URLSearchParams(hash || qs)
    const err = p.get('error_description') || p.get('error')
    if (err) {
      router.replace(`/auth?error=${encodeURIComponent(err)}`)
      return
    }
    // Implicit flow: Supabase parses the session from the URL hash via
    // detectSessionInUrl during initialization. getSession() waits for it to finish.
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? '/' : '/auth?error=no_session')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function AuthCallback() {
  return (
    <div className="bg-[var(--card)] flex items-center justify-center" style={{ minHeight: '100dvh' }}>
      <div className="text-center">
        <div className="text-4xl mb-3">⏳</div>
        <p className="text-sm text-[var(--muted)]">Connexion en cours...</p>
      </div>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
