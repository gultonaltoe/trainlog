'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const UID_KEY = 'trainlog_uid'

async function migrateIfNeeded(authUid: string) {
  const oldUid = localStorage.getItem(UID_KEY)
  if (!oldUid) { localStorage.setItem(UID_KEY, authUid); return }
  if (oldUid === authUid) return
  await Promise.all([
    supabase.from('user_profile').update({ user_id: authUid }).eq('user_id', oldUid),
    supabase.from('sessions').update({ user_id: authUid }).eq('user_id', oldUid),
    supabase.from('personal_records').update({ user_id: authUid }).eq('user_id', oldUid),
  ])
  localStorage.setItem(UID_KEY, authUid)
}

export default function UserInit() {
  const pathname = usePathname()
  const router = useRouter()
  const doneRef = useRef(false)

  useEffect(() => {
    if (pathname.startsWith('/auth')) return
    if (doneRef.current) return
    doneRef.current = true

    // If Supabase returned an auth error (e.g. expired link), send to /auth with message
    if (typeof window !== 'undefined' && window.location.hash.includes('error=')) {
      router.replace('/auth?error=1')
      return
    }

    const tokenInUrl = typeof window !== 'undefined' && (
      window.location.hash.includes('access_token=') ||
      window.location.search.includes('code=') ||
      window.location.search.includes('token_hash=')
    )

    let handled = false

    const handle = async (session: Session | null) => {
      if (handled) return
      handled = true

      if (!session) {
        router.replace('/auth')
        return
      }

      await migrateIfNeeded(session.user.id)
      if (pathname === '/welcome') return

      const { data: profile } = await supabase
        .from('user_profile').select('id')
        .eq('user_id', session.user.id).limit(1).maybeSingle()

      if (!profile) {
        router.replace('/welcome')
      } else if (window.location.hash.includes('access_token=')) {
        router.replace('/')
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        // If there's a token in the URL hash, Supabase fires INITIAL_SESSION with null first,
        // then SIGNED_IN once the hash is processed — skip the null initial session
        if (!session && tokenInUrl) return
        void handle(session)
      }
      if (event === 'SIGNED_IN') {
        void handle(session)
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
