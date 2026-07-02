'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Wordmark from '@/components/Wordmark'

function AuthForm() {
  const searchParams = useSearchParams()
  const errParam = searchParams.get('error')
  // Show the real reason when Supabase/Google passed one through; fall back to the
  // friendly message for a plain expired magic link.
  const initialError = !errParam
    ? ''
    : (errParam === '1' || errParam === 'no_session')
      ? 'Lien invalide ou expiré. Réessaie.'
      : `Connexion échouée : ${decodeURIComponent(errParam)}`

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      // Send/store the email exactly as typed (lowercased + trimmed). We do NOT
      // strip dots — the address must stay faithful so it always delivers and
      // matches what the user sees. Dot-insensitive matching lives only in the
      // server-side invite logic (normalize_email), which compares without mutating.
      email: email.trim().toLowerCase(),
      // No emailRedirectTo → pure email OTP (6-digit code), NO magic-link URL.
      // A link in the email gets prefetched by mail clients, which consumes the
      // shared OTP token and makes the typed code fail ("invalid/expired") — ST-86.
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  // ST-86: verify the 6-digit code in-context — creates the session right here,
  // which is the only login that works inside an installed iOS PWA (a magic link
  // opens Safari, not the standalone app).
  const handleVerify = async () => {
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return
    setVerifying(true)
    setError('')
    const em = email.trim().toLowerCase()
    // For an EXISTING user, signInWithOtp issues a 'magiclink'-type token; a new
    // signup issues an 'email' one. Verifying with the wrong type returns 403
    // otp_expired (the lookup misses — it does NOT consume the real OTP), so we
    // try magiclink first (the common case) then fall back to email.
    let { error: err } = await supabase.auth.verifyOtp({ email: em, token, type: 'magiclink' })
    if (err) { const retry = await supabase.auth.verifyOtp({ email: em, token, type: 'email' }); err = retry.error }
    setVerifying(false)
    if (err) { setError('Code invalide ou expiré. Demande un nouveau code.'); return }
    // Full navigation (not client-side) so AppProvider re-initialises with the
    // fresh session — otherwise it keeps its logged-out state (empty memberships,
    // personal view) until a manual refresh.
    window.location.href = '/'
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
        <h1 className="text-2xl font-black text-[var(--ink)] mb-2">Entre ton code</h1>
        <p className="text-sm text-[var(--sub)] leading-relaxed">
          On a envoyé un code à <strong className="text-[var(--ink)]">{email}</strong>.
        </p>

        <div className="w-full mt-6 space-y-3">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="Code reçu par email"
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-3.5 text-center text-2xl font-black tracking-[0.25em] text-[var(--ink)] placeholder:text-base placeholder:tracking-normal placeholder:font-semibold placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}
          <button
            onClick={handleVerify}
            disabled={verifying || code.length < 6}
            className="w-full py-4 rounded-2xl text-white font-black text-base transition"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', opacity: verifying || code.length < 6 ? 0.5 : 1 }}
          >
            {verifying ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>

        <p className="text-xs text-[var(--muted)] mt-4 leading-relaxed">
          Ou clique le lien dans l’email (sauf app installée) · expire dans 1 h · vérifie tes spams
        </p>
        <button
          onClick={() => { setSent(false); setEmail(''); setCode(''); setError('') }}
          className="mt-6 text-sm text-[var(--muted)] underline underline-offset-2"
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

      <div className="space-y-3">
        <input
          type="email"
          placeholder="ton@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[var(--card)] px-4 py-3.5 text-[var(--ink)] text-base placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]"
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
          {loading ? 'Envoi en cours...' : 'Recevoir mon code →'}
        </button>
      </div>

      <p className="text-xs text-[var(--muted)] mt-5 text-center leading-relaxed">
        Pas de mot de passe — on t’envoie un code (et un lien) à chaque connexion.
      </p>

      <div className="flex items-center gap-3 my-5">
        <span className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-xs text-[var(--muted)] font-semibold">ou</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
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

      <p className="text-[11px] text-[var(--muted)] mt-8 text-center leading-relaxed">
        En continuant, tu acceptes nos{' '}
        <Link href="/terms" className="underline underline-offset-2">Conditions</Link>{' '}et notre{' '}
        <Link href="/privacy" className="underline underline-offset-2">Politique de confidentialité</Link>.
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
