'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { getSessionUserId } from '@/lib/auth'

type Profile = {
  first_name: string; email: string; birth_date: string
  weight_kg: string; height_cm: string; level: string; goal: string
  weekly_target: string; box_name: string; sports: string[]
  notes: string; theme_color: string
}
const EMPTY: Profile = {
  first_name:'', email:'', birth_date:'', weight_kg:'', height_cm:'',
  level:'', goal:'', weekly_target:'', box_name:'', sports:[], notes:'', theme_color:'#F97316'
}
const LEVELS = [
  {v:'débutant',l:'Débutant',d:'Moins de 1 an'},{v:'intermédiaire',l:'Intermédiaire',d:'1 à 3 ans'},
  {v:'avancé',l:'Avancé',d:'3 à 5 ans'},{v:'élite',l:'Élite',d:'5 ans et +'},
  {v:'compétiteur',l:'Compétiteur',d:'Competition ready'},
]
const GOALS = [
  {v:'santé',l:'🌿 Santé',d:'Bien-être général'},
  {v:'remise_en_forme',l:'💪 Remise en forme',d:'Retrouver la forme'},
  {v:'performance',l:'⚡ Performance',d:'Progresser & PRs'},
  {v:'compétition',l:'🏆 Compétition',d:'Préparer des compétitions'},
]
const SPORTS = ['CrossFit','Haltérophilie','Run','Renfo','Endurance','Hyrox','Natation','Vélo','Autre']
const THEMES = [
  {name:'Orange',hex:'#F97316'},{name:'Bleu',hex:'#3B82F6'},{name:'Violet',hex:'#8B5CF6'},
  {name:'Vert',hex:'#10B981'},{name:'Rouge',hex:'#EF4444'},{name:'Rose',hex:'#EC4899'},
  {name:'Teal',hex:'#14B8A6'},{name:'Indigo',hex:'#6366F1'},
]

const inputCls = "w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2"
const section  = "bg-white rounded-2xl border border-gray-200 p-5 mb-4"

export default function ProfilePage() {
  const [p, setP]     = useState<Profile>(EMPTY)
  const [loading, setL] = useState(true)
  const [saving, setS]  = useState(false)
  const [pid, setPid]   = useState<string|null>(null)

  useEffect(() => {
    const run = async () => {
      const uid = await getSessionUserId()
      if (!uid) { setL(false); return }
      const { data } = await supabase.from('user_profile').select('*').eq('user_id', uid).limit(1).maybeSingle()
      if (data) {
        setPid(data.id)
        setP({
          first_name:    data.first_name    ?? '',
          email:         data.email         ?? '',
          birth_date:    data.birth_date    ?? '',
          weight_kg:     data.weight_kg     ? String(data.weight_kg)   : '',
          height_cm:     data.height_cm     ? String(data.height_cm)   : '',
          level:         data.level         ?? '',
          goal:          data.goal          ?? '',
          weekly_target: data.weekly_target ? String(data.weekly_target) : '',
          box_name:      data.box_name      ?? '',
          sports:        data.sports        ?? [],
          notes:         data.notes         ?? '',
          theme_color:   data.theme_color   ?? '#F97316',
        })
        if (data.theme_color) {
          document.documentElement.style.setProperty('--theme-primary', data.theme_color)
        }
      }
      setL(false)
    }
    void run()
  }, [])

  const upd = (f: keyof Profile, v: string | string[]) => setP(prev => ({...prev, [f]: v}))
  const toggleSport = (s: string) =>
    upd('sports', p.sports.includes(s) ? p.sports.filter(x => x !== s) : [...p.sports, s])

  const save = async () => {
    setS(true)
    const payload = {
      first_name:    p.first_name    || null,
      email:         p.email         || null,
      birth_date:    p.birth_date    || null,
      weight_kg:     p.weight_kg     ? parseFloat(p.weight_kg)   : null,
      height_cm:     p.height_cm     ? parseInt(p.height_cm)     : null,
      level:         p.level         || null,
      goal:          p.goal          || null,
      weekly_target: p.weekly_target ? parseInt(p.weekly_target) : null,
      box_name:      p.box_name      || null,
      sports:        p.sports.length > 0 ? p.sports : null,
      notes:         p.notes         || null,
      theme_color:   p.theme_color,
      updated_at:    new Date().toISOString(),
    }
    if (pid) await supabase.from('user_profile').update(payload).eq('id', pid)
    else {
      const uid = await getSessionUserId()
      if (!uid) { toast.error('Session expirée, reconnecte-toi'); setS(false); return }
      const { data } = await supabase.from('user_profile').insert({ ...payload, user_id: uid }).select('id').single()
      if (data) setPid(data.id)
    }
    document.documentElement.style.setProperty('--theme-primary', p.theme_color)
    setS(false)
    localStorage.setItem('theme-color', p.theme_color)
    toast.success('Profil enregistré ✓')
  }

  const age = p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25*24*60*60*1000)) : null
  const bmi = p.weight_kg && p.height_cm
    ? parseFloat((parseFloat(p.weight_kg) / ((parseInt(p.height_cm)/100) ** 2)).toFixed(1))
    : null

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '80dvh' }}>
      <p className="text-gray-400 text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">

        <div className="pt-8 pb-5">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Mon profil</h1>
          <p className="text-sm text-gray-400 mt-0.5">Infos personnelles et préférences</p>
        </div>

        <Link href="/box/join"
          className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-4 mb-4 hover:shadow-sm transition">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏢</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Rejoindre une box</p>
              <p className="text-xs text-gray-400">Entre le code de ta salle</p>
            </div>
          </div>
          <span className="text-gray-300">›</span>
        </Link>

        {/* Identité */}
        <div className={section}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Identité</p>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Prénom</label>
              <input type="text" placeholder="Julien" value={p.first_name}
                onChange={e => upd('first_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" placeholder="julien@exemple.com" value={p.email}
                onChange={e => upd('email', e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Date de naissance</label>
                <input type="date" value={p.birth_date}
                  onChange={e => upd('birth_date', e.target.value)}
                  className="w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                {age && <p className="text-xs text-gray-400 mt-1">{age} ans</p>}
              </div>
              <div>
                <label className={labelCls}>Box / Club</label>
                <input type="text" placeholder="CrossFit XYZ" value={p.box_name}
                  onChange={e => upd('box_name', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        {/* Morphologie */}
        <div className={section}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Morphologie</p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className={labelCls}>Poids (kg)</label>
              <input type="number" step="0.5" placeholder="75" value={p.weight_kg}
                onChange={e => upd('weight_kg', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Taille (cm)</label>
              <input type="number" placeholder="178" value={p.height_cm}
                onChange={e => upd('height_cm', e.target.value)} className={inputCls} />
            </div>
          </div>
          {bmi && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">IMC</span>
              <span className="text-sm font-bold text-gray-800">
                {bmi} <span className="text-xs font-normal text-gray-500">
                  {bmi < 18.5 ? 'Insuffisant' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Surpoids' : 'Obésité'}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Profil sportif */}
        <div className={section}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Profil sportif</p>

          <div className="mb-5">
            <label className={labelCls}>Niveau</label>
            <div className="space-y-2">
              {LEVELS.map(l => (
                <button key={l.v} onClick={() => upd('level', l.v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                    p.level === l.v ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <span className={`text-sm font-semibold ${p.level === l.v ? 'text-orange-600' : 'text-gray-700'}`}>{l.l}</span>
                  <span className="text-xs text-gray-400">{l.d}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className={labelCls}>Objectif principal</label>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(g => (
                <button key={g.v} onClick={() => upd('goal', g.v)}
                  className={`p-3 rounded-xl border text-left transition ${
                    p.goal === g.v ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <p className={`text-sm font-semibold ${p.goal === g.v ? 'text-orange-600' : 'text-gray-700'}`}>{g.l}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{g.d}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className={labelCls}>Fréquence cible (séances/semaine)</label>
            <div className="flex gap-2">
              {[2,3,4,5,6].map(n => (
                <button key={n} onClick={() => upd('weekly_target', String(n))}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition ${
                    p.weekly_target === String(n)
                      ? 'border-orange-400 bg-orange-50 text-orange-600'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}>{n}×</button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Sports pratiqués</label>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map(s => (
                <button key={s} onClick={() => toggleSport(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    p.sports.includes(s)
                      ? 'border-orange-400 bg-orange-50 text-orange-600'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Thème */}
        <div className={section}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Couleur du thème</p>
          <p className="text-xs text-gray-400 mb-4">Personnalise la couleur principale de l'app</p>
          <div className="flex flex-wrap gap-4">
            {THEMES.map(c => (
              <button key={c.hex} onClick={() => upd('theme_color', c.hex)}
                className="flex flex-col items-center gap-1.5">
                <div className={`w-9 h-9 rounded-full border-2 transition ${
                  p.theme_color === c.hex ? 'scale-110 border-gray-700' : 'border-transparent'
                }`} style={{ background: c.hex }} />
                <span className="text-xs text-gray-500">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className={section}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Notes</p>
          <textarea rows={3} value={p.notes} onChange={e => upd('notes', e.target.value)}
            placeholder="Contexte, contraintes, historique blessures..."
            className={inputCls + ' resize-none'} />
          <p className="text-xs text-gray-400 mt-2">Alimentera les recommandations IA.</p>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-4 rounded-xl text-white font-bold text-sm transition mb-2 hover:opacity-90 disabled:opacity-50"
          style={{ background: p.theme_color }}>
          {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
        </button>

      </div>
    </div>
  )
}
