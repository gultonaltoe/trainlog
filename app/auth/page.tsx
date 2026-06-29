'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { normalizeEmail } from '@/lib/auth'
import Wordmark from '@/components/Wordmark'

function AuthForm() {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(hasError ? 'Lien invalide ou expiré. Réessaie.' : '')

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // On success the browser redirects to Google; we only land here on error.
    if (err) { setError(err.message); setLoading(false) }
  }

  if (sent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto w-full">
        <div className="text-6xl mb-5">📧</div>
        <h1 className="text-2xl font-black text-[var(--ink)] mb-3">Vérifie tes emails</h1>
        <p className="text-sm text-[var(--sub)] leading-relaxed">
          On a envoyé un lien à <strong className="text-[var(--ink)]">{email}</strong>.<br />
          Clique dessus pour accéder à Trainlift.
        </p>
        <p className="text-xs text-[var(--muted)] mt-4">Le lien expire dans 1 heure · Vérifie tes spams</p>
        <button
          onClick={() => { setSent(false); setEmail(''); setError('') }}
          className="mt-8 text-sm text-[var(--muted)] underline underline-offset-2"
        >
          Utiliser un autre email
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col px-6 pt-16 pb-8 max-w-sm mx-auto w-full">
      <div className="text-center mb-10">
        <Wordmark size={44} className="text-4xl mb-4" />
        <p className="text-base text-[var(--sub)] leading-relaxed">Entre ton email pour accéder à ton compte.</p>
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border border-[color:var(--border-strong)] bg-[var(--card)] text-[var(--ink)] font-bold text-base transition ds-hover disabled:opacity-50"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        Continuer avec Google
      </button>

      <div className="flex items-center gap-3 my-5">
        <span className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-xs text-[var(--muted)] font-semibold">ou par email</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="space-y-3">
        <input
          type="email"
          placeholder="ton@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-3.5 text-[var(--ink)] text-base placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-orange-400"
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

      <p className="text-xs text-[var(--muted)] mt-5 text-center leading-relaxed">
        Pas de mot de passe — un lien de connexion est envoyé à chaque fois.
      </p>
    </div>
  )
}

export default function AuthPage() {
  return (
    <div className="bg-[var(--card)] flex flex-col" style={{ minHeight: '100dvh' }}>
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  )
}
