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

export default function UserInit() {
  const pathname = usePathname()
  const router = useRouter()
  const doneRef = useRef(false)

  useEffect(() => {
    if (pathname.startsWith('/auth')) return
    if (doneRef.current) return
    doneRef.current = true

    // detectSessionInUrl: false means Supabase never clears window.location.hash,
    // so we can safely read it here and handle the token ourselves.
    const hash = window.location.hash

    if (hash.includes('error=')) {
      router.replace('/auth?error=1')
      return
    }

    const run = async () => {
      let session = null

      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.slice(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (!error) session = data.session
        }
      } else {
        const { data } = await supabase.auth.getSession()
        session = data.session
      }

      if (!session) { router.replace('/auth'); return }

      await migrateIfNeeded(session.user.id)
      if (pathname === '/welcome') return

      const { data: profile } = await supabase
        .from('user_profile').select('id')
        .eq('user_id', session.user.id).limit(1).maybeSingle()

      if (!profile) {
        router.replace('/welcome')
      } else if (hash.includes('access_token=')) {
        router.replace('/')
      }
    }

    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
