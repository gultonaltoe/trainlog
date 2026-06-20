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

    // Supabase error redirect (e.g. expired link) — hash not cleared by Supabase for error case
    if (window.location.hash.includes('error=')) {
      router.replace('/auth?error=1')
      return
    }

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth'); return }
      await migrateIfNeeded(session.user.id)
      if (pathname === '/welcome') return
      const { data: profile } = await supabase
        .from('user_profile').select('id')
        .eq('user_id', session.user.id).limit(1).maybeSingle()
      if (!profile) router.replace('/welcome')
    }

    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
