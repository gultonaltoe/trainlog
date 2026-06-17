'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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

async function checkProfile(authUid: string, router: ReturnType<typeof useRouter>, pathname: string) {
  await migrateIfNeeded(authUid)
  if (pathname === '/welcome') return
  const { data: profile } = await supabase
    .from('user_profile').select('id').eq('user_id', authUid).limit(1).maybeSingle()
  if (!profile) router.replace('/welcome')
  // If there's a hash token in the URL, navigate to clean root
  else if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
    router.replace('/')
  }
}

export default function UserInit() {
  const pathname = usePathname()
  const router = useRouter()
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (pathname.startsWith('/auth')) return
    if (resolvedRef.current) return
    resolvedRef.current = true

    // Detect implicit flow token in URL hash (Supabase sends #access_token= to Site URL)
    const hasTokenInHash = typeof window !== 'undefined' &&
      (window.location.hash.includes('access_token=') ||
       window.location.search.includes('code=') ||
       window.location.search.includes('token_hash='))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          if (!session) {
            // If there's a token in the URL, wait — Supabase will fire SIGNED_IN shortly
            if (hasTokenInHash) return
            router.replace('/auth')
            return
          }
          await checkProfile(session.user.id, router, pathname)
          subscription.unsubscribe()
        }

        if (event === 'SIGNED_IN' && session) {
          // Handles implicit flow: Supabase processes #access_token= and fires this
          await checkProfile(session.user.id, router, pathname)
          subscription.unsubscribe()
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
