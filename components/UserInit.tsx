'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const UID_KEY = 'trainlog_uid'

// On first auth login, migrate any existing localStorage-UUID data to the real auth UID.
// For new users, just stamps localStorage so getUserId() returns the auth UID going forward.
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

  useEffect(() => {
    if (pathname.startsWith('/auth')) return

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/auth')
        return
      }

      const authUid = data.session.user.id
      await migrateIfNeeded(authUid)

      if (pathname === '/welcome') return

      const { data: profile } = await supabase
        .from('user_profile')
        .select('id')
        .eq('user_id', authUid)
        .limit(1)
        .maybeSingle()

      if (!profile) router.replace('/welcome')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
