'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function WelcomePage() {
  const router = useRouter()
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [step, setStep]     = useState<'intro' | 'form'>('intro')

  const handleStart = async () => {
    if (!name.trim()) { setError('Entre ton prénom pour continuer.'); return }
    setSaving(true)
    try {
      const { error: err } = await supabase.from('user_profile').insert({
        first_name: name.trim(),
        email:      email.trim() || null,
      })
      if (err) throw err
      router.push('/')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setSaving(false)
    }
  }

  if (step === 'intro') return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      <div className="w-full max-w-sm px-6 flex flex-col items-center pt-14 pb-8">

        {/* Hero */}
        <div className="text-6xl mb-5">🏋️</div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2 text-center">
          Trainlog
        </h1>
        <p className="text-base text-gray-500 text-center leading-relaxed mb-8">
          Ton journal d'entraînement intelligent pour CrossFit et sports fonctionnels.
        </p>

        {/* Badge bêta */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 w-full">
          <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            BÊTA PRIVÉE
          </span>
          <p className="text-sm text-gray-700 leading-relaxed mt-3">
            Tu fais partie des premiers testeurs. L'app est en développement actif —
            utilise le bouton <strong>Feedback</strong> pour partager bugs, idées et ressentis.
          </p>
        </div>

        {/* Features */}
        <div className="w-full space-y-2.5 mb-10">
          {[
            { icon: '📸', title: 'Photo → séance',       desc: 'Prends en photo le tableau de ta box' },
            { icon: '📊', title: 'Analytics intelligents', desc: 'Comprends ta charge et ta récupération' },
            { icon: '🏃', title: 'Multi-sport',           desc: 'CrossFit, Run, Haltéro, Hyrox et plus' },
          ].map(f => (
            <div key={f.title}
              className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 w-full">
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-bold text-gray-800">{f.title}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA — pas full width */}
        <button onClick={() => setStep('form')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-black text-base px-10 py-3.5 rounded-2xl transition shadow-sm">
          Commencer →
        </button>
        <p className="text-xs text-gray-400 mt-3">Accès bêta gratuit · Aucun abonnement</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button onClick={() => setStep('intro')}
          className="text-sm text-gray-400 mb-6 flex items-center gap-1">
          ← Retour
        </button>
        <h2 className="text-2xl font-black text-gray-900 mb-1">Crée ton profil</h2>
        <p className="text-sm text-gray-400 mb-6">Pour personnaliser ton expérience.</p>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Prénom <span className="text-orange-400">*</span>
            </label>
            <input type="text" placeholder="Julien" value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              className="w-full rounded-xl border border-gray-400 bg-white px-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
              autoFocus />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Email <span className="text-gray-300">— optionnel</span>
            </label>
            <input type="email" placeholder="julien@exemple.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              className="w-full rounded-xl border border-gray-400 bg-white px-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <p className="text-xs text-gray-400 mt-1">Pour être informé des mises à jour.</p>
          </div>
          {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}
          <button onClick={handleStart} disabled={saving}
            className={`w-full py-3.5 rounded-xl text-white font-bold text-sm transition ${
              saving ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'
            }`}>
            {saving ? 'Création...' : 'C\'est parti 🚀'}
          </button>
        </div>
      </div>
    </div>
  )
}
