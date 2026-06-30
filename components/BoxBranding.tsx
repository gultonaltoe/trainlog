'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppContext } from './AppContext'

// Single writer of --theme-primary (ST-8 v2). The accent follows the ACTIVE box's
// brandColor when the member is operating inside a box; otherwise it falls back to
// the user's personal profile colour (or the #F97316 default). Replaces ThemeLoader.
const DEFAULT = '#F97316'

export default function BoxBranding() {
  const { active, memberships } = useAppContext()
  const [personalColor, setPersonalColor] = useState<string | null>(null)

  // Personal/base colour: cached immediately (no flash), then synced from profile.
  useEffect(() => {
    try {
      const c = localStorage.getItem('theme-color')
      if (c) { setPersonalColor(c); document.documentElement.style.setProperty('--theme-primary', c) }
    } catch { /* ignore */ }
    void (async () => {
      try {
        const { data } = await supabase.from('user_profile').select('theme_color').limit(1).maybeSingle()
        const c = data?.theme_color ?? DEFAULT
        setPersonalColor(c)
        try { localStorage.setItem('theme-color', c) } catch { /* ignore */ }
      } catch { /* non-fatal */ }
    })()
  }, [])

  // Effective accent: active box brandColor (if set) wins, else personal/base.
  useEffect(() => {
    const boxColor = active.type === 'org'
      ? (memberships.find(m => m.organizationId === active.orgId)?.brandColor ?? null)
      : null
    const color = boxColor || personalColor
    if (color) document.documentElement.style.setProperty('--theme-primary', color)
  }, [active, memberships, personalColor])

  return null
}
