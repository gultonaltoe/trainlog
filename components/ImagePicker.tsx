'use client'
import { useRef, useState, type ReactNode } from 'react'

// Lets the user CHOOSE between taking a photo (camera) and picking from the
// gallery — some mobile/PWA browsers only surface the gallery for a plain
// <input accept="image/*">, so we expose both explicitly (ST-9 / cf. ST-30).
export default function ImagePicker({ onPick, disabled, capture = 'user', children }: {
  onPick: (file: File) => void
  disabled?: boolean
  capture?: 'user' | 'environment'   // selfie vs rear camera
  children: (open: () => void) => ReactNode
}) {
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState(false)
  const pick = (f: File | undefined) => { if (f) onPick(f); setMenu(false) }

  return (
    <>
      {children(() => { if (!disabled) setMenu(true) })}
      <input ref={camRef} type="file" accept="image/*" capture={capture} className="hidden" onChange={e => pick(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
      {menu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setMenu(false)}>
          <div className="bg-[var(--card)] w-full max-w-lg rounded-t-3xl p-4 pb-8 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-2" />
            <button onClick={() => camRef.current?.click()}
              className="ds-hover w-full py-3 rounded-xl bg-[var(--bg)] text-sm font-bold text-[var(--ink)] cursor-pointer">📷 Prendre une photo</button>
            <button onClick={() => galRef.current?.click()}
              className="ds-hover w-full py-3 rounded-xl bg-[var(--bg)] text-sm font-bold text-[var(--ink)] cursor-pointer">🖼️ Choisir dans la galerie</button>
            <button onClick={() => setMenu(false)}
              className="w-full py-2 text-sm font-bold text-[var(--muted)] cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </>
  )
}
