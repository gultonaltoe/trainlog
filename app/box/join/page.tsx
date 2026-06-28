'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { searchBoxes, requestToJoinBoxById } from '@/lib/orgs'
import { toast } from '@/lib/toast'

// ST-54 — join a box by searching its name; the box owner then approves the
// pending membership (no code needed).
export default function JoinBoxPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  // Debounced search.
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try { setResults(await searchBoxes(query)) } catch { setResults([]) }
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const request = async (box: { id: string; name: string }) => {
    setRequesting(box.id)
    try { await requestToJoinBoxById(box.id); setSent(box.name) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur'); setRequesting(null) }
  }

  if (sent) {
    return (
      <div className="bg-[var(--card)] flex flex-col items-center justify-center px-6 text-center" style={{ minHeight: '100dvh' }}>
        <div className="text-6xl mb-5">✅</div>
        <h1 className="text-2xl font-black text-[var(--ink)] mb-2">Demande envoyée</h1>
        <p className="text-sm text-[var(--sub)] leading-relaxed max-w-xs">
          Ta demande pour rejoindre <strong className="text-[var(--ink)]">{sent}</strong> a été envoyée.
          La box doit la valider — tu seras membre une fois approuvé.
        </p>
        <button onClick={() => router.push('/')} className="mt-8 text-sm font-bold text-[var(--accent-text)]">Retour à Mon espace</button>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
        <button onClick={() => router.back()}
          className="self-start mb-8 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink-soft)]">← Retour</button>

        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🏢</div>
          <h1 className="text-2xl font-black text-[var(--ink)] mb-2">Rejoindre une box</h1>
          <p className="text-sm text-[var(--sub)] leading-relaxed">
            Cherche ta salle par son nom. Elle validera ta demande.
          </p>
        </div>

        <input type="text" value={query} autoFocus
          placeholder="Nom de la box…"
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-3 text-[var(--ink)] text-base placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-orange-400" />

        <div className="mt-3 space-y-2">
          {searching && <p className="text-sm text-[var(--muted)] text-center py-3">Recherche…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center py-3">Aucune box trouvée. Vérifie le nom exact avec ta salle.</p>
          )}
          {results.map(b => (
            <button key={b.id} onClick={() => request(b)} disabled={requesting !== null}
              className="ds-hover w-full flex items-center justify-between gap-2 rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-3.5 text-left disabled:opacity-50">
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-shrink-0">🏢</span>
                <span className="text-sm font-bold text-[var(--ink)] truncate">{b.name}</span>
              </span>
              <span className="text-xs font-bold text-[var(--accent-text)] flex-shrink-0">
                {requesting === b.id ? '…' : 'Demander →'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
