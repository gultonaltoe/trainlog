'use client'
import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendCode = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('code')
  }

  const handleVerify = async () => {
    if (code.length !== 6) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email',
    })
    setLoading(false)
    if (err) { setError('Code invalide ou expiré. Réessaie.'); return }
    router.replace('/')
  }

  if (step === 'code') {
    return (
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">📧</div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Vérifie tes emails</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Code envoyé à <strong className="text-gray-800">{email}</strong>.<br />
            Entre le code à 6 chiffres ci-dessous.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="number"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            maxLength={6}
            onChange={e => {
              const v = e.target.value.slice(0, 6)
              setCode(v)
              setError('')
              if (v.length === 6) {
                setCode(v)
              }
            }}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-4 text-gray-900 text-2xl text-center font-bold tracking-[0.4em] placeholder:text-gray-300 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoFocus
          />

          {error && <p className="text-red-500 text-sm text-center">⚠️ {error}</p>}

          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full py-4 rounded-2xl text-white font-black text-base transition"
            style={{
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              opacity: loading || code.length !== 6 ? 0.5 : 1,
            }}
          >
            {loading ? 'Vérification...' : 'Accéder à Trainlog →'}
          </button>
        </div>

        <button
          onClick={() => { setStep('email'); setCode(''); setError('') }}
          className="mt-6 text-sm text-gray-400 underline underline-offset-2 text-center w-full"
        >
          Utiliser un autre email
        </button>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Le code expire dans 1 heure. Vérifie tes spams si tu ne le reçois pas.
        </p>
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
          onKeyDown={e => e.key === 'Enter' && handleSendCode()}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoFocus
          autoComplete="email"
        />

        {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}

        <button
          onClick={handleSendCode}
          disabled={loading || !email.trim()}
          className="w-full py-4 rounded-2xl text-white font-black text-base transition"
          style={{
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            opacity: loading || !email.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Envoi en cours...' : 'Recevoir mon code →'}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-5 text-center leading-relaxed">
        Pas de mot de passe — un code à 6 chiffres est envoyé à chaque connexion.
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
