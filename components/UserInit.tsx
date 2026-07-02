'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function UserInit() {
  const pathname = usePathname()
  const router = useRouter()
  const doneRef = useRef(false)

  useEffect(() => {
    // Public routes (no auth gate) — e.g. the design reference, viewable on previews.
    if (pathname.startsWith('/auth') || pathname === '/design') return
    if (doneRef.current) return
    doneRef.current = true

    // Supabase error redirect (e.g. expired link) — hash not cleared by Supabase for error case
    if (window.location.hash.includes('error=')) {
      router.replace('/auth?error=1')
      return
    }

    const run = async () => {
      // getUser() validates with the auth server, which guarantees the access
      // token is attached to the client before we query. getSession() can return
      // a stored session a tick before the token is wired to PostgREST requests —
      // and under RLS that produced an empty profile result and a false redirect
      // to /welcome (the bug that flashed the welcome page over the dashboard).
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }
      if (pathname === '/welcome') return

      const fetchProfile = () => supabase.from('user_profile').select('id').eq('user_id', user.id).limit(1).maybeSingle()
      let res = await fetchProfile()
      if (res.error) return                    // transient — never bounce on an error
      // ST-125: on a cold launch (especially a freshly-installed standalone PWA),
      // the auth token can attach to PostgREST a tick late, so the first profile
      // query returns empty under RLS. Without a retry that bounced an EXISTING,
      // onboarded user into /welcome. Retry before concluding they're genuinely new.
      if (!res.data) {
        for (const delay of [300, 700]) {
          await new Promise(r => setTimeout(r, delay))
          res = await fetchProfile()
          if (res.error || res.data) return    // has a profile (or transient) → stay put
        }
        router.replace('/welcome')             // genuinely not onboarded
      }
    }

    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
