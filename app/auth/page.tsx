'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthForm() {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error')
  const errorMsg = searchParams.get('msg')

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(hasError ? `Lien invalide ou expiré. Réessaie.${errorMsg ? ` (${errorMsg})` : ''}` : '')

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto w-full">
        <div className="text-6xl mb-5">📧</div>
        <h1 className="text-2xl font-black text-gray-900 mb-3">Vérifie tes emails</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          On a envoyé un lien à <strong className="text-gray-800">{email}</strong>.<br />
          Clique dessus pour accéder à Trainlog.
        </p>
        <p className="text-xs text-gray-400 mt-4">Le lien expire dans 1 heure · Vérifie tes spams</p>
        <button
          onClick={() => { setSent(false); setEmail(''); setError('') }}
          className="mt-8 text-sm text-gray-400 underline underline-offset-2"
        >
          Utiliser un autre email
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
      <div className="text-center mb-10">
        <div className="text-7xl mb-4">🏋️</div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-3">Trainlog</h1>
        <p className="text-base text-gray-500 leading-relaxed">Entre ton email pour accéder à ton compte.</p>
      </div>

      <div className="space-y-3">
        <input
          type="email"
          placeholder="ton@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoFocus
          autoComplete="email"
        />

        {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !email.trim()}
          className="w-full py-4 rounded-2xl text-white font-black text-base transition"
          style={{
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            opacity: loading || !email.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Envoi en cours...' : 'Recevoir mon lien →'}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-5 text-center leading-relaxed">
        Pas de mot de passe — un lien de connexion est envoyé à chaque fois.
      </p>
    </div>
  )
}

export default function AuthPage() {
  return (
    <div className="bg-white flex flex-col" style={{ minHeight: '100dvh' }}>
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  )
}
