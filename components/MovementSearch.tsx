'use client'

import { useState, useEffect, useRef } from 'react'
import { searchMovements, getMovementsByCategory } from '@/lib/api'
import type { Movement } from '@/lib/api'

type Mode = 'idle' | 'categories' | 'browsing' | 'searching'

const CATS = [
  { id: 'weightlifting', label: 'Haltéro',   emoji: '⚡' },
  { id: 'powerlifting',  label: 'Force',      emoji: '🏋️' },
  { id: 'gymnastics',    label: 'Gym',        emoji: '🤸' },
  { id: 'cardio',        label: 'Cardio',     emoji: '🏃' },
  { id: 'accessory',     label: 'Accessoire', emoji: '💪' },
  { id: 'skill',         label: 'Skill',      emoji: '🎯' },
]
const CAT_LABELS: Record<string, string> = Object.fromEntries(CATS.map(c => [c.id, c.label]))

type Props = {
  value: string
  onChange: (movement: Movement) => void
}

export default function MovementSearch({ value, onChange }: Props) {
  const [query, setQuery]         = useState(value)
  const [mode, setMode]           = useState<Mode>('idle')
  const [browseCategory, setBrowseCategory] = useState('')
  const [results, setResults]     = useState<Movement[]>([])
  const [loading, setLoading]     = useState(false)
  const [locked, setLocked]       = useState(!!value)
  const ref                       = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMode('idle')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Recherche debounce
  useEffect(() => {
    if (mode !== 'searching' || locked) return
    const t = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true)
        const r = await searchMovements(query, browseCategory || undefined)
        setResults(r)
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, mode, browseCategory, locked])

  // Browse catégorie
  useEffect(() => {
    if (mode !== 'browsing' || !browseCategory) return
    setLoading(true)
    getMovementsByCategory(browseCategory).then(r => { setResults(r); setLoading(false) })
  }, [mode, browseCategory])

  const onFocus = () => {
    if (locked) return
    setMode(query.trim().length >= 2 ? 'searching' : 'categories')
  }

  const onType = (val: string) => {
    setQuery(val); setLocked(false)
    setMode(val.trim().length >= 2 ? 'searching' : 'categories')
  }

  const pickCategory = (catId: string) => { setBrowseCategory(catId); setMode('browsing') }

  const select = (m: Movement) => {
    setQuery(m.name); setLocked(true); setMode('idle'); onChange(m)
  }

  const clear = () => {
    setQuery(''); setLocked(false); setBrowseCategory(''); setMode('categories')
    onChange({ id: '', name: '', category: '' })
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text" value={query} onFocus={onFocus}
          onChange={e => onType(e.target.value)}
          placeholder="Chercher ou parcourir les mouvements..."
          className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 pr-7"
        />
        {locked
          ? <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>
          : <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs pointer-events-none">▾</span>
        }
      </div>

      {mode !== 'idle' && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">

          {/* Catégories */}
          {mode === 'categories' && (
            <div className="p-2">
              <p className="text-xs text-gray-400 px-2 pb-2 pt-1">Parcourir par catégorie</p>
              <div className="grid grid-cols-3 gap-1.5">
                {CATS.map(c => (
                  <button key={c.id} onClick={() => pickCategory(c.id)}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-lg hover:bg-orange-50 hover:text-orange-600 text-gray-600 transition border border-transparent hover:border-orange-200">
                    <span className="text-lg">{c.emoji}</span>
                    <span className="text-xs font-medium">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Browse */}
          {mode === 'browsing' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                <button onClick={() => setMode('categories')} className="text-xs text-gray-400 hover:text-gray-600">← Catégories</button>
                <span className="text-xs font-semibold text-orange-500">
                  {CATS.find(c => c.id === browseCategory)?.emoji} {CAT_LABELS[browseCategory]}
                </span>
              </div>
              {loading
                ? <p className="text-xs text-gray-400 px-4 py-3">Chargement...</p>
                : results.map(m => (
                  <button key={m.id} onClick={() => select(m)}
                    className="w-full flex px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-orange-50 border-b border-gray-100 last:border-0 text-left transition">
                    {m.name}
                  </button>
                ))
              }
            </>
          )}

          {/* Recherche */}
          {mode === 'searching' && (
            <>
              {browseCategory && (
                <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Dans <span className="font-medium text-orange-500">{CAT_LABELS[browseCategory]}</span>
                  </span>
                  <button onClick={() => setBrowseCategory('')} className="text-xs text-gray-400 hover:text-gray-600">Tout</button>
                </div>
              )}
              {loading
                ? <p className="text-xs text-gray-400 px-4 py-3">Recherche...</p>
                : results.length === 0
                ? <p className="text-xs text-gray-400 px-4 py-3">Aucun résultat pour &quot;{query}&quot;</p>
                : results.map(m => (
                  <button key={m.id} onClick={() => select(m)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-orange-50 border-b border-gray-100 last:border-0 text-left transition">
                    <span className="font-medium text-gray-900">{m.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{CAT_LABELS[m.category] ?? m.category}</span>
                  </button>
                ))
              }
            </>
          )}
        </div>
      )}
    </div>
  )
}
