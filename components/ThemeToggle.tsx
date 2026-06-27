'use client'
import { useEffect, useState } from 'react'

// Global light/dark toggle (ST-39). Adds/removes `.dark` on <html> and persists
// the choice. Not yet wired into the nav — surfaces are migrating screen by
// screen; until then dark mode is previewed on /design. The no-flash init lives
// in the inline script in app/layout.tsx.
export function applyTheme(mode: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  try { localStorage.setItem('theme-mode', mode) } catch {}
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')) }, [])
  const toggle = () => { const next = !dark; setDark(next); applyTheme(next ? 'dark' : 'light') }
  return (
    <button type="button" onClick={toggle} aria-label="Basculer le thème"
      className="ds-hover w-9 h-9 rounded-full border border-[color:var(--border)] text-[var(--ink)] flex items-center justify-center">
      {dark ? '☀︎' : '☾'}
    </button>
  )
}
