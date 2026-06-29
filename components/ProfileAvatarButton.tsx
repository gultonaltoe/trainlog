'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Quick profile access in the top bar (far right). Shows the user's photo, or
// their first-name initial in an orange circle as a fallback. Same 40px icon-
// button footprint as the bell. Reads from user_profile (RLS scopes to self) —
// that's where the name + photo live (the auth session only has the email).
export default function ProfileAvatarButton() {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('')

  useEffect(() => {
    supabase.from('user_profile').select('first_name, avatar_url').limit(1).maybeSingle()
      .then(({ data }) => { if (data) { setName(data.first_name ?? ''); setAvatar(data.avatar_url ?? '') } })
      .catch(() => { /* non-fatal */ })
  }, [])

  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <Link href="/profile" aria-label="Profil"
      className="ds-hover w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 border border-[color:var(--border)]"
      style={avatar ? undefined : { background: 'var(--theme-primary, #F97316)' }}>
      {avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatar} alt="" className="w-full h-full object-cover" />
        : <span className="text-white text-sm font-black">{initial}</span>}
    </Link>
  )
}
