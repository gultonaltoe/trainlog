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
  // Read the hash at render time, before Supabase's lazy init clears it from the URL
  const initialHash = useRef(typeof window !== 'undefined' ? window.location.hash : '')

  useEffect(() => {
    if (pathname.startsWith('/auth')) return
    if (doneRef.current) return
    doneRef.current = true

    const hash = initialHash.current

    if (hash.includes('error=')) {
      router.replace('/auth?error=1')
      return
    }

    // Was there an auth token in the URL when the page loaded?
    const hadToken = hash.includes('access_token=')
      || window.location.search.includes('code=')
      || window.location.search.includes('token_hash=')

    let handled = false

    const handle = async (session: Session | null) => {
      if (handled) return
      handled = true
      if (!session) { router.replace('/auth'); return }
      await migrateIfNeeded(session.user.id)
      if (pathname === '/welcome') return
      const { data: profile } = await supabase
        .from('user_profile').select('id')
        .eq('user_id', session.user.id).limit(1).maybeSingle()
      if (!profile) {
        router.replace('/welcome')
      } else if (hadToken) {
        router.replace('/')
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void handle(session)
      }
      if (event === 'INITIAL_SESSION') {
        if (session) {
          void handle(session)
        } else if (!hadToken) {
          // No session, no token in URL → user is genuinely not logged in
          void handle(null)
        }
        // hadToken + no session: Supabase is still processing the hash → wait for SIGNED_IN.
        // Safety net: if SIGNED_IN never fires within 3s, check one more time.
        else {
          setTimeout(() => {
            supabase.auth.getSession().then(({ data }) => {
              void handle(data.session)
            })
          }, 3000)
        }
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
