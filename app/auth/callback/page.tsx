'use client'
import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function CallbackHandler() {
  const router = useRouter()

  useEffect(() => {
    // Error redirect from Supabase (e.g. expired link)
    if (window.location.hash.includes('error=')) {
      router.replace('/auth?error=1')
      return
    }
    // Implicit flow: Supabase parses the session from the URL hash via
    // detectSessionInUrl during initialization. getSession() waits for it to finish.
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? '/' : '/auth?error=1')
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
