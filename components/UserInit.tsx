'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getUserId } from '@/lib/user'
import { supabase } from '@/lib/supabase'

export default function UserInit() {
  const pathname = usePathname()
  const router   = useRouter()

  useEffect(() => {
    const uid = getUserId()
    if (pathname === '/welcome') return

    supabase.from('user_profile').select('id').eq('user_id', uid).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) return  // profile found for this device

        // Fallback: claim any profile and all orphan data rows (pre-migration)
        supabase.from('user_profile').select('id').limit(1).maybeSingle()
          .then(({ data: existing }) => {
            if (existing) {
              // Stamp all orphan rows with this device's UUID
              Promise.all([
                supabase.from('user_profile')    .update({ user_id: uid }).is('user_id', null),
                supabase.from('sessions')         .update({ user_id: uid }).is('user_id', null),
                supabase.from('personal_records') .update({ user_id: uid }).is('user_id', null),
              ]).then(() => {})
            } else {
              router.replace('/welcome')
            }
          })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
