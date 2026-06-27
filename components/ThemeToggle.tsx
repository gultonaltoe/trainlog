'use client'
import { useEffect, useState } from 'react'

// Global light/dark theme control (ST-39). Adds/removes `.dark` on <html> and
// persists the choice. 'system' follows the OS preference. The no-flash init
// (reads the same key before first paint) lives in app/layout.tsx.
export type ThemeMode = 'light' | 'dark' | 'system'

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

export function getThemeMode(): ThemeMode {
  try { return (localStorage.getItem('theme-mode') as ThemeMode) || 'system' } catch { return 'system' }
}

export function applyThemeMode(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
  try { localStorage.setItem('theme-mode', mode) } catch {}
}

/** Segmented Clair / Sombre / Auto — drop into a settings/profile screen. */
export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system')
  useEffect(() => { setMode(getThemeMode()) }, [])

  // Keep 'system' in sync if the OS theme changes while the app is open.
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeMode('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const choose = (m: ThemeMode) => { setMode(m); applyThemeMode(m) }
  const opts: [ThemeMode, string][] = [['light', '☀︎ Clair'], ['dark', '☾ Sombre'], ['system', 'Auto']]

  return (
    <div className="flex rounded-xl overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-xs font-bold">
      {opts.map(([m, label]) => (
        <button key={m} type="button" onClick={() => choose(m)} className="flex-1 py-2 px-2 cursor-pointer transition"
          style={mode === m ? { background: 'var(--theme-primary, #F97316)', color: '#fff' } : { color: 'var(--sub)' }}>
          {label}
        </button>
      ))}
    </div>
  )
}
