'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ThemeLoader() {
  useEffect(() => {
    // 1. Appliquer immédiatement depuis localStorage (pas de flash)
    const cached = localStorage.getItem('theme-color')
    if (cached) document.documentElement.style.setProperty('--theme-primary', cached)

    // 2. Synchroniser depuis le profil Supabase
    supabase.from('user_profile').select('theme_color').limit(1).maybeSingle()
      .then(({ data }) => {
        const color = data?.theme_color ?? '#F97316'
        document.documentElement.style.setProperty('--theme-primary', color)
        localStorage.setItem('theme-color', color)
      })
  }, [])
  return null
}
