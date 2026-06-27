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
    // Supabase auto-exchanges ?code= via detectSessionInUrl during initialization.
    // getSession() waits for that initialization (including PKCE exchange) to finish.
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
