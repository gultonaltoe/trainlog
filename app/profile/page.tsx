'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { getSessionUserId } from '@/lib/auth'
import { useAppContext } from '@/components/AppContext'
import { setDataSharing } from '@/lib/orgs'
import ThemeToggle from '@/components/ThemeToggle'
import { StickyBar, Select, Toggle } from '@/components/ui'
import { useUnsavedGuard } from '@/components/useUnsavedGuard'
import { uploadAvatar } from '@/lib/storage'
import ImagePicker from '@/components/ImagePicker'
import type { Json } from '@/lib/database.types'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propriétaire', coach: 'Coach', member: 'Membre',
}

type Profile = {
  first_name: string; email: string; birth_date: string
  weight_kg: string; height_cm: string; level: string; goal: string
  weekly_target: string; box_name: string; sports: string[]
  notes: string; theme_color: string; avatar_url: string
}
const EMPTY: Profile = {
  first_name:'', email:'', birth_date:'', weight_kg:'', height_cm:'',
  level:'', goal:'', weekly_target:'', box_name:'', sports:[], notes:'', theme_color:'#F97316', avatar_url:''
}
const LEVELS = [
  {v:'débutant',     l:'Débutant',     d:'Je découvre les mouvements'},
  {v:'intermédiaire',l:'Intermédiaire',d:'Technique en place, je progresse'},
  {v:'avancé',       l:'Avancé',       d:'Mouvements maîtrisés, bonnes charges'},
  {v:'élite',        l:'Élite',        d:'Très haut niveau (RX+)'},
  {v:'compétiteur',  l:'Compétiteur',  d:'Je participe à des compétitions'},
]
const GOALS = [
  {v:'santé',l:'🌿 Santé',d:'Bien-être général'},
  {v:'remise_en_forme',l:'💪 Remise en forme',d:'Retrouver la forme'},
  {v:'performance',l:'⚡ Performance',d:'Progresser & PRs'},
  {v:'compétition',l:'🏆 Compétition',d:'Préparer des compétitions'},
]
const SPORTS = ['CrossFit','Haltérophilie','Run','Renfo','Endurance','Hyrox','Natation','Vélo','Autre']

// Structured training profile for AI recommendations (ST-41), stored in the
// user_profile.training_profile jsonb column.
type TrainingProfile = {
  injuries: string
  available_days: string[]
  preferred_times: string
  equipment: string[]
  goal_detail: string
  experience: Record<string, string>
}
const EMPTY_TP: TrainingProfile = { injuries:'', available_days:[], preferred_times:'', equipment:[], goal_detail:'', experience:{} }
const DAYS = [['mon','Lun'],['tue','Mar'],['wed','Mer'],['thu','Jeu'],['fri','Ven'],['sat','Sam'],['sun','Dim']] as const
const TIMES = [{value:'matin',label:'Matin'},{value:'midi',label:'Midi'},{value:'soir',label:'Soir'},{value:'flexible',label:'Peu importe'}]
const EQUIPMENT = ['Barre','Haltères','Kettlebell','Anneaux','Rameur','Assault bike','Corde à sauter','Box','Wall ball','Élastiques']
const MOVEMENTS = [['snatch','Arraché'],['clean_jerk','Épaulé-jeté'],['muscle_up','Muscle-up'],['hspu','HSPU'],['double_unders','Double-unders'],['pull_up','Tractions']] as const
const XP_LEVELS = [{value:'none',label:'Non acquis'},{value:'beginner',label:'Débutant'},{value:'intermediate',label:'Intermédiaire'},{value:'advanced',label:'Avancé'}]
const THEMES = [
  {name:'Orange',hex:'#F97316'},{name:'Bleu',hex:'#3B82F6'},{name:'Violet',hex:'#8B5CF6'},
  {name:'Vert',hex:'#10B981'},{name:'Rouge',hex:'#EF4444'},{name:'Rose',hex:'#EC4899'},
  {name:'Teal',hex:'#14B8A6'},{name:'Indigo',hex:'#6366F1'},
]

const inputCls = "w-full rounded-xl border border-[color:var(--muted)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-orange-400"
const labelCls = "block text-xs font-bold text-[var(--sub)] uppercase tracking-wide mb-2"
const section  = "bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-5 mb-4"

export default function ProfilePage() {
  const { memberships, refresh } = useAppContext()
  const [sharing, setSharing] = useState<Record<string, boolean>>({})
  const [p, setP]     = useState<Profile>(EMPTY)
  const [saved, setSaved] = useState<Profile>(EMPTY)   // last-persisted snapshot
  const [tp, setTp] = useState<TrainingProfile>(EMPTY_TP)
  const [tpSaved, setTpSaved] = useState<TrainingProfile>(EMPTY_TP)
  const [loading, setL] = useState(true)
  const [saving, setS]  = useState(false)
  const [pid, setPid]   = useState<string|null>(null)
  const dirty = JSON.stringify(p) !== JSON.stringify(saved) || JSON.stringify(tp) !== JSON.stringify(tpSaved)
  useUnsavedGuard(dirty)

  // Prefill Box/Club from the user's active membership when empty (display only,
  // not marked dirty) so it's filled once they've joined a box.
  useEffect(() => {
    const act = memberships.find(m => m.status === 'active')
    if (!act) return
    setP(prev => prev.box_name ? prev : { ...prev, box_name: act.organizationName })
    setSaved(prev => prev.box_name ? prev : { ...prev, box_name: act.organizationName })
  }, [memberships])

  const toggleShare = async (orgId: string, val: boolean) => {
    setSharing(s => ({ ...s, [orgId]: val }))
    try { await setDataSharing(orgId, val); refresh() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur'); setSharing(s => ({ ...s, [orgId]: !val })) }
  }

  const updTp = (patch: Partial<TrainingProfile>) => setTp(prev => ({ ...prev, ...patch }))
  const toggleIn = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

  const [avatarUploading, setAvatarUploading] = useState(false)
  const onPickAvatar = async (file: File) => {
    const uid = await getSessionUserId()
    if (!uid) { toast.error('Session expirée'); return }
    setAvatarUploading(true)
    try {
      const url = await uploadAvatar(uid, file)
      setP(prev => ({ ...prev, avatar_url: url }))
      toast.success('Photo mise à jour — pense à enregistrer')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setAvatarUploading(false)
  }

  useEffect(() => {
    const run = async () => {
      const uid = await getSessionUserId()
      if (!uid) { setL(false); return }
      // Prefill email from the auth session so a new profile isn't blank (ST-42).
      const { data: auth } = await supabase.auth.getUser()
      const authEmail = auth.user?.email ?? ''
      const { data } = await supabase.from('user_profile').select('*').eq('user_id', uid).limit(1).maybeSingle()
      if (data) {
        setPid(data.id)
        const prof: Profile = {
          first_name:    data.first_name    ?? '',
          email:         data.email         ?? authEmail,
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
          avatar_url:    data.avatar_url    ?? '',
        }
        setP(prof); setSaved(prof)
        const tpLoaded = { ...EMPTY_TP, ...(data.training_profile as Partial<TrainingProfile> | null ?? {}) }
        setTp(tpLoaded); setTpSaved(tpLoaded)
        if (data.theme_color) {
          document.documentElement.style.setProperty('--theme-primary', data.theme_color)
        }
      } else {
        const prof = { ...EMPTY, email: authEmail }
        setP(prof); setSaved(prof)
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
      avatar_url:    p.avatar_url    || null,
      training_profile: tp as unknown as Json,
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
    setSaved(p)
    setTpSaved(tp)
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
      <p className="text-[var(--muted)] text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-4">

        <div className="pt-8 pb-5 flex items-center gap-4">
          <ImagePicker onPick={onPickAvatar} disabled={avatarUploading} capture="user">
            {open => (
              <button onClick={open} disabled={avatarUploading}
                className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 cursor-pointer border border-[color:var(--border)]"
                aria-label="Changer la photo">
                {p.avatar_url
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-2xl bg-[var(--track)]">👤</span>}
                <span className="absolute inset-x-0 bottom-0 text-[9px] font-bold text-white text-center bg-black/45 py-0.5">
                  {avatarUploading ? '…' : 'Modifier'}
                </span>
              </button>
            )}
          </ImagePicker>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">Mon profil</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">Infos personnelles et préférences</p>
          </div>
        </div>

        {/* Mes box — active memberships are tappable, pending show their state */}
        {memberships.length > 0 && (
          <div className="space-y-2 mb-4">
            {memberships.map(m => {
              const pending = m.status === 'pending'
              const card = (
                <div className={`flex items-center justify-between rounded-2xl border p-4 ${
                  pending ? 'bg-amber-50 border-amber-200' : 'bg-[var(--card)] border-[color:var(--border)] hover:shadow-sm transition'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">{pending ? '⏳' : '🏢'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--ink)] truncate">
                        {pending ? 'Demande en attente' : m.organizationName}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {pending ? 'En attente de validation par la box' : ROLE_LABEL[m.role]}
                      </p>
                    </div>
                  </div>
                  {!pending && <span className="text-[var(--border-strong)]">›</span>}
                </div>
              )
              return pending
                ? <div key={m.organizationId}>{card}</div>
                : <Link key={m.organizationId} href={`/box/profile?org=${m.organizationId}`}>{card}</Link>
            })}
          </div>
        )}

        {/* Partage des données avec chaque box */}
        {memberships.some(m => m.status === 'active') && (
          <div className={section}>
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-1">Partage des données</p>
            <p className="text-xs text-[var(--muted)] mb-4">Autorise une box à voir tes séances et performances. Tu peux le désactiver à tout moment.</p>
            <div className="space-y-3">
              {memberships.filter(m => m.status === 'active').map(m => (
                <Toggle key={m.organizationId} label={m.organizationName}
                  checked={sharing[m.organizationId] ?? m.dataSharing}
                  onChange={v => toggleShare(m.organizationId, v)} />
              ))}
            </div>
          </div>
        )}

        <Link href="/box/join"
          className="flex items-center justify-between bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 mb-4 hover:shadow-sm transition">
          <div className="flex items-center gap-3">
            <span className="text-2xl">➕</span>
            <div>
              <p className="text-sm font-bold text-[var(--ink)]">Rejoindre une box</p>
              <p className="text-xs text-[var(--muted)]">Entre le code de ta salle</p>
            </div>
          </div>
          <span className="text-[var(--border-strong)]">›</span>
        </Link>

        {/* Identité */}
        <div className={section}>
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-4">Identité</p>
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
                  className="w-full rounded-xl border border-[color:var(--muted)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-orange-400" />
                {age && <p className="text-xs text-[var(--muted)] mt-1">{age} ans</p>}
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
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-4">Morphologie</p>
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
            <div className="bg-[var(--bg)] rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-[var(--sub)]">IMC</span>
              <span className="text-sm font-bold text-[var(--ink)]">
                {bmi} <span className="text-xs font-normal text-[var(--sub)]">
                  {bmi < 18.5 ? 'Insuffisant' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Surpoids' : 'Obésité'}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Profil sportif */}
        <div className={section}>
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-4">Profil sportif</p>

          <div className="mb-5">
            <label className={labelCls}>Niveau</label>
            <div className="space-y-2">
              {LEVELS.map(l => (
                <button key={l.v} onClick={() => upd('level', l.v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                    p.level === l.v ? 'border-orange-400 bg-[var(--accent-soft)]' : 'border-[color:var(--border)] bg-[var(--card)] hover:border-[color:var(--border-strong)]'
                  }`}>
                  <span className={`text-sm font-semibold ${p.level === l.v ? 'text-[var(--accent-text)]' : 'text-[var(--ink-soft)]'}`}>{l.l}</span>
                  <span className="text-xs text-[var(--muted)]">{l.d}</span>
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
                    p.goal === g.v ? 'border-orange-400 bg-[var(--accent-soft)]' : 'border-[color:var(--border)] bg-[var(--card)] hover:border-[color:var(--border-strong)]'
                  }`}>
                  <p className={`text-sm font-semibold ${p.goal === g.v ? 'text-[var(--accent-text)]' : 'text-[var(--ink-soft)]'}`}>{g.l}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{g.d}</p>
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
                      ? 'border-orange-400 bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]'
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
                      ? 'border-orange-400 bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--sub)]'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Thème */}
        <div className={section}>
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-1">Couleur du thème</p>
          <p className="text-xs text-[var(--muted)] mb-4">Personnalise la couleur principale de l'app</p>
          <div className="flex flex-wrap gap-4">
            {THEMES.map(c => (
              <button key={c.hex} onClick={() => upd('theme_color', c.hex)}
                className="flex flex-col items-center gap-1.5">
                <div className={`w-9 h-9 rounded-full border-2 transition ${
                  p.theme_color === c.hex ? 'scale-110 border-[color:var(--ink)]' : 'border-transparent'
                }`} style={{ background: c.hex }} />
                <span className="text-xs text-[var(--sub)]">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Apparence (clair / sombre / auto) */}
        <div className={section}>
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-1">Apparence</p>
          <p className="text-xs text-[var(--muted)] mb-4">Mode clair, sombre, ou selon ton appareil</p>
          <ThemeToggle />
        </div>

        {/* Profil d'entraînement (alimente les recommandations IA) */}
        <div className={section}>
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-1">Profil d’entraînement</p>
          <p className="text-xs text-[var(--muted)] mb-4">Ces infos alimenteront les recommandations IA.</p>

          <div className="space-y-5">
            {/* Blessures */}
            <div>
              <label className={labelCls}>Blessures / limitations</label>
              <textarea rows={2} value={tp.injuries} onChange={e => updTp({ injuries: e.target.value })}
                placeholder="Ex : épaule droite fragile, éviter le rachis chargé…"
                className={inputCls + ' resize-none'} />
            </div>

            {/* Disponibilités */}
            <div>
              <label className={labelCls}>Jours dispo</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(([v, l]) => {
                  const on = tp.available_days.includes(v)
                  return (
                    <button key={v} type="button" onClick={() => updTp({ available_days: toggleIn(tp.available_days, v) })}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition"
                      style={on ? { background: p.theme_color, color:'#fff', borderColor:'transparent' } : { color:'var(--sub)', borderColor:'var(--border)' }}>
                      {l}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className={labelCls}>Moment préféré</label>
              <Select value={tp.preferred_times} onChange={v => updTp({ preferred_times: v })} options={TIMES} placeholder="Choisir" />
            </div>

            {/* Matériel */}
            <div>
              <label className={labelCls}>Matériel accessible</label>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT.map(e => {
                  const on = tp.equipment.includes(e)
                  return (
                    <button key={e} type="button" onClick={() => updTp({ equipment: toggleIn(tp.equipment, e) })}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition"
                      style={on ? { background: p.theme_color, color:'#fff', borderColor:'transparent' } : { color:'var(--sub)', borderColor:'var(--border)' }}>
                      {e}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Objectif détaillé */}
            <div>
              <label className={labelCls}>Objectif détaillé</label>
              <textarea rows={2} value={tp.goal_detail} onChange={e => updTp({ goal_detail: e.target.value })}
                placeholder="Ex : enchaîner 10 muscle-ups, courir 5 km sous 25 min…"
                className={inputCls + ' resize-none'} />
            </div>

            {/* Niveau par mouvement */}
            <div>
              <label className={labelCls}>Niveau par mouvement</label>
              <div className="space-y-2">
                {MOVEMENTS.map(([v, l]) => (
                  <div key={v} className="flex items-center gap-3">
                    <span className="text-sm text-[var(--ink-soft)] flex-1 min-w-0">{l}</span>
                    <div className="w-40 flex-shrink-0">
                      <Select value={tp.experience[v] ?? ''} onChange={lvl => updTp({ experience: { ...tp.experience, [v]: lvl } })}
                        options={XP_LEVELS} placeholder="—" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <StickyBar>
          {dirty && <p className="text-[11px] text-[var(--muted)] mb-1.5 text-center">Modifications non enregistrées</p>}
          <button onClick={save} disabled={saving || !dirty}
            className="w-full py-4 rounded-xl text-white font-bold text-sm transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
            style={{ background: p.theme_color }}>
            {saving ? 'Enregistrement...' : dirty ? 'Enregistrer le profil' : 'Profil à jour ✓'}
          </button>
        </StickyBar>

      </div>
    </div>
  )
}
