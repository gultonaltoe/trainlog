'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const UID_KEY = 'trainlog_uid'

async function migrateIfNeeded(authUid: string) {
  const oldUid = localStorage.getItem(UID_KEY)
  if (!oldUid) {
    localStorage.setItem(UID_KEY, authUid)
    return
  }
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
  const checkedRef = useRef(false)

  useEffect(() => {
    if (pathname.startsWith('/auth')) return
    // Only run the auth check once per app session — prevents welcome loop on navigation
    if (checkedRef.current) return
    checkedRef.current = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // INITIAL_SESSION fires once after client initialises — more reliable than getSession()
        if (event !== 'INITIAL_SESSION') return

        if (!session) {
          router.replace('/auth')
          return
        }

        const authUid = session.user.id
        await migrateIfNeeded(authUid)

        if (pathname === '/welcome') return

        const { data: profile } = await supabase
          .from('user_profile')
          .select('id')
          .eq('user_id', authUid)
          .limit(1)
          .maybeSingle()

        if (!profile) router.replace('/welcome')
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
