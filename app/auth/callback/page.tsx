'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? '/auth?error=1' : '/')
      })
    } else if (tokenHash && type) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'email' }).then(({ error }) => {
        router.replace(error ? '/auth?error=1' : '/')
      })
    } else {
      router.replace('/auth')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function AuthCallback() {
  return (
    <div className="bg-white flex items-center justify-center" style={{ minHeight: '100dvh' }}>
      <div className="text-center">
        <div className="text-4xl mb-3">⏳</div>
        <p className="text-sm text-gray-400">Connexion en cours...</p>
      </div>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
