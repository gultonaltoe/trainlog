'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestToJoinBox } from '@/lib/orgs'
import { toast } from '@/lib/toast'

export default function JoinBoxPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  const submit = async () => {
    if (!code.trim()) return
    setSending(true)
    try {
      const boxName = await requestToJoinBox(code)
      setSent(boxName)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-white flex flex-col items-center justify-center px-6 text-center" style={{ minHeight: '100dvh' }}>
        <div className="text-6xl mb-5">✅</div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Demande envoyée</h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
          Ta demande pour rejoindre <strong className="text-gray-800">{sent}</strong> a été envoyée.
          La box doit la valider — tu seras membre une fois approuvé.
        </p>
        <button onClick={() => router.push('/')}
          className="mt-8 text-sm font-bold text-orange-600">Retour à Mon espace</button>
      </div>
    )
  }

  return (
    <div className="bg-white flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
        <button onClick={() => router.back()}
          className="self-start mb-8 text-sm font-semibold text-gray-400 hover:text-gray-600">← Retour</button>

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏢</div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Rejoindre une box</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Entre le code que ta box t’a communiqué. Elle validera ta demande.
          </p>
        </div>

        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Code de la box</label>
        <input type="text" value={code} autoFocus
          placeholder="A1B2C3"
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 text-lg tracking-widest text-center placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400" />

        <button onClick={submit} disabled={sending || !code.trim()}
          className="mt-6 w-full py-4 rounded-2xl text-white font-black text-base transition"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', opacity: sending || !code.trim() ? 0.5 : 1 }}>
          {sending ? 'Envoi...' : 'Envoyer la demande →'}
        </button>
      </div>
    </div>
  )
}
