'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type SessionType = { name: string; emoji: string; color: string }
type Movement    = { name: string; category: string }
type BlockSet    = { set_number: number; reps: number | null; weight_kg: number | null }
type Block       = { id: string; order_index: number; movements: Movement | null; block_sets: BlockSet[] }
type Wod         = { id: string; format_label: string; time_cap_min: number | null; description: string | null; result_detail: string | null; is_rx: boolean }
type PainAlert   = { body_part_label: string; severity: number }
type Session     = {
  id: string; date: string; notes: string | null; duration_min: number | null
  sleep_hours: number | null; energy_level: number | null; rpe: number | null; feeling_post: number | null
  session_types: SessionType
}

const RPE_LABELS  = ['','Très facile','Facile','Un peu dur','Modéré','Modéré+','Dur','Très dur','Intense','Extrême','Maximum']
const RPE_COLORS  = ['','#3B82F6','#3B82F6','#3B82F6','#F59E0B','#F59E0B','#D97706','#EA580C','#EA580C','#EF4444','#DC2626']
const FEEL_EMOJIS = ['','😩','😕','😐','😊','🤩']
const FEEL_LABELS = ['','Mauvais','Passable','Correct','Bien','Excellent']
const SEV_COLORS  = ['','bg-yellow-100 text-yellow-700','bg-orange-100 text-orange-700','bg-red-100 text-red-700']

function parseNotes(raw: string | null) {
  if (!raw) return { warmup: null, skill: null, other: null }
  let warmup = null, skill = null
  const others: string[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('Échauffement:'))   warmup = line.replace('Échauffement:', '').trim()
    else if (line.startsWith('Skill/Force:')) skill  = line.replace('Skill/Force:', '').trim()
    else if (line.trim()) others.push(line.trim())
  }
  return { warmup, skill, other: others.length > 0 ? others.join('\n') : null }
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

const card = "bg-white rounded-2xl border border-gray-200 p-4 mb-3"
const inputCls = "w-full rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
const labelCls = "text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block"

export default function SessionDetailPage() {
  const params = useParams()
  const id     = Array.isArray(params.id) ? params.id[0] : params.id as string
  const router = useRouter()

  const [session,    setSession]    = useState<Session | null>(null)
  const [blocks,     setBlocks]     = useState<Block[]>([])
  const [wod,        setWod]        = useState<Wod | null>(null)
  const [painAlerts, setPainAlerts] = useState<PainAlert[]>([])
  const [loading,    setLoading]    = useState(true)
  const [notFound,   setNotFound]   = useState(false)

  // Edit
  const [editing,      setEditing]      = useState(false)
  const [editDuration, setEditDuration] = useState('')
  const [editRpe,      setEditRpe]      = useState(7)
  const [editFeeling,  setEditFeeling]  = useState(3)
  const [editWarmup,   setEditWarmup]   = useState('')
  const [editSkill,    setEditSkill]    = useState('')
  const [editNotes,    setEditNotes]    = useState('')
  const [editResult,   setEditResult]   = useState('')
  const [editRx,       setEditRx]       = useState(true)
  const [saving,       setSaving]       = useState(false)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  const loadData = () => {
    if (!id) return
    Promise.all([
      supabase.from('sessions')
        .select('id, date, notes, duration_min, sleep_hours, energy_level, rpe, feeling_post, session_types(name, emoji, color)')
        .eq('id', id).maybeSingle(),
      supabase.from('session_blocks')
        .select('id, order_index, movements(name, category), block_sets(set_number, reps, weight_kg)')
        .eq('session_id', id).order('order_index', { ascending: true }),
      supabase.from('wods')
        .select('id, format_label, time_cap_min, description, result_detail, is_rx')
        .eq('session_id', id).limit(1).maybeSingle(),
      supabase.from('session_pain_alerts')
        .select('body_part_label, severity').eq('session_id', id),
    ]).then(([s, b, w, p]) => {
      if (!s.data) { setNotFound(true); setLoading(false); return }
      const sess = s.data as unknown as Session
      const wodData = w.data as Wod | null
      const parsed  = parseNotes(sess.notes)
      setSession(sess)
      setBlocks((b.data ?? []) as unknown as Block[])
      setWod(wodData)
      setPainAlerts((p.data ?? []) as PainAlert[])
      setEditDuration(sess.duration_min ? String(sess.duration_min) : '')
      setEditRpe(sess.rpe ?? 7)
      setEditFeeling(sess.feeling_post ?? 3)
      setEditWarmup(parsed.warmup ?? '')
      setEditSkill(parsed.skill   ?? '')
      setEditNotes(parsed.other   ?? '')
      setEditResult(wodData?.result_detail ?? '')
      setEditRx(wodData?.is_rx ?? true)
      setLoading(false)
    })
  }

  useEffect(() => { loadData() }, [id])

  const handleSave = async () => {
    if (!session) return
    setSaving(true)
    const newNotes = [
      editWarmup ? `Échauffement: ${editWarmup}` : '',
      editSkill  ? `Skill/Force: ${editSkill}`   : '',
      editNotes,
    ].filter(Boolean).join('\n') || null

    await supabase.from('sessions').update({
      rpe:          editRpe,
      feeling_post: editFeeling,
      duration_min: editDuration ? parseInt(editDuration) : null,
      notes:        newNotes,
      updated_at:   new Date().toISOString(),
    }).eq('id', session.id)

    if (wod) {
      await supabase.from('wods').update({
        result_detail: editResult || null,
        is_rx:         editRx,
      }).eq('id', wod.id)
    }
    setSaving(false)
    setEditing(false)
    loadData()
  }

  const handleDelete = async () => {
    if (!session) return
    setDeleting(true)
    await supabase.from('sessions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', session.id)
    router.push('/sessions')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Chargement...</p>
    </div>
  )
  if (notFound || !session) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 text-sm mb-3">Séance introuvable.</p>
        <button onClick={() => router.back()} className="text-orange-500 text-sm font-semibold">← Retour</button>
      </div>
    </div>
  )

  const t = session.session_types
  const { warmup, skill, other } = parseNotes(session.notes)
  const hasBlocks = blocks.some(b => b.movements)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4">

        {/* Header */}
        <div className="pt-6 pb-4 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
            ←
          </button>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: t?.color + '15', border: `1.5px solid ${t?.color}30` }}>
            {t?.emoji}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-black text-gray-900">{t?.name}</h1>
            <p className="text-sm text-gray-400">{capitalize(formatDate(session.date))}</p>
          </div>
          <button onClick={() => setEditing(true)}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:text-orange-500 transition text-base">
            ✏️
          </button>
          <button onClick={() => setConfirmDelete(true)}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:text-red-400 transition text-base">
            🗑️
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { l: 'Durée',    v: session.duration_min ? `${session.duration_min}'` : '—', c: undefined },
            { l: 'RPE',      v: String(session.rpe ?? '—'), sub: session.rpe ? RPE_LABELS[session.rpe] : null, c: session.rpe ? RPE_COLORS[session.rpe] : undefined },
            { l: 'Ressenti', v: session.feeling_post ? FEEL_EMOJIS[session.feeling_post] : '—', c: undefined },
            { l: 'Sommeil',  v: session.sleep_hours ? `${session.sleep_hours}h` : '—', c: undefined },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xl font-black" style={s.c ? { color: s.c } : { color: '#111827' }}>{s.v}</p>
              {s.sub && <p className="text-xs text-gray-400 leading-tight mt-0.5 truncate">{s.sub}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {warmup && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2"><span>🔥</span><span className="text-sm font-bold text-gray-700">Échauffement</span></div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{warmup}</p>
          </div>
        )}
        {skill && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2"><span>🎯</span><span className="text-sm font-bold text-gray-700">Skill & Technique</span></div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{skill}</p>
          </div>
        )}
        {hasBlocks && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-3"><span>🏋️</span><span className="text-sm font-bold text-gray-700">Force & Technique</span></div>
            <div className="space-y-3">
              {blocks.filter(b => b.movements).map((block, bi, arr) => (
                <div key={block.id}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{block.movements!.name}</p>
                  {block.block_sets.length > 0 ? (
                    <div className="space-y-1.5">
                      {[...block.block_sets].sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0)).map((set, si) => (
                        <div key={si} className="flex items-center gap-3 text-sm">
                          <span className="text-xs text-gray-300 font-bold w-5">S{si+1}</span>
                          <span className="font-semibold text-gray-700">{set.reps ? `${set.reps} reps` : '—'}</span>
                          {set.weight_kg && <span className="text-gray-400">@ {set.weight_kg} kg</span>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-400 italic">Aucune série</p>}
                  {bi < arr.length - 1 && <div className="border-t border-gray-100 mt-3" />}
                </div>
              ))}
            </div>
          </div>
        )}
        {wod && (
          <div className="rounded-2xl border p-4 mb-3" style={{ background: (t?.color ?? '#F97316') + '08', borderColor: (t?.color ?? '#F97316') + '30' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>⚡</span>
                <span className="text-sm font-bold text-gray-700">WOD</span>
                {wod.format_label && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: t?.color ?? '#F97316' }}>
                    {wod.format_label}{wod.time_cap_min ? ` ${wod.time_cap_min}'` : ''}
                  </span>
                )}
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${wod.is_rx ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {wod.is_rx ? 'RX' : 'Scaled'}
              </span>
            </div>
            {wod.description && <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{wod.description}</p>}
            {wod.result_detail && (
              <div className="bg-white rounded-xl px-3 py-2 mt-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Résultat</p>
                <p className="text-base font-black text-gray-900">{wod.result_detail}</p>
              </div>
            )}
          </div>
        )}
        {painAlerts.length > 0 && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2"><span>⚠️</span><span className="text-sm font-bold text-gray-700">Alertes douleur</span></div>
            <div className="flex flex-wrap gap-2">
              {painAlerts.map((p, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${SEV_COLORS[p.severity]}`}>{p.body_part_label}</span>
              ))}
            </div>
          </div>
        )}
        {other && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2"><span>📝</span><span className="text-sm font-bold text-gray-700">Notes</span></div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{other}</p>
          </div>
        )}
        <div className="h-4" />

        {/* ── Modal édition ── */}
        {editing && (
          <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditing(false)}>
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl"
              style={{ maxHeight: '92vh', overflowY: 'auto', paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
              <div className="px-5 pt-3 pb-4">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-black text-gray-900">Modifier la séance</h3>
                  <button onClick={() => setEditing(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-lg">×</button>
                </div>

                {/* Durée */}
                <div className="mb-4">
                  <label className={labelCls}>Durée (min)</label>
                  <input type="number" value={editDuration} onChange={e => setEditDuration(e.target.value)}
                    placeholder="ex: 75" className="w-28 rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>

                {/* RPE */}
                <div className="mb-4">
                  <label className={labelCls}>
                    RPE — {editRpe}/10 · <span className="text-orange-500 normal-case font-normal">{RPE_LABELS[editRpe]}</span>
                  </label>
                  <div className="flex gap-1 items-end" style={{ height: 52 }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setEditRpe(n)}
                        className="flex-1 rounded-md transition-all duration-100"
                        style={{ height: n === editRpe ? '100%' : `${35 + n * 6}%`, background: n <= editRpe ? RPE_COLORS[n-1] : '#E5E7EB', opacity: n <= editRpe ? 1 : 0.4 }} />
                    ))}
                  </div>
                </div>

                {/* Ressenti */}
                <div className="mb-4">
                  <label className={labelCls}>Ressenti post-séance</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(v => (
                      <button key={v} onClick={() => setEditFeeling(v)}
                        className={`flex-1 py-2 rounded-xl border flex flex-col items-center gap-0.5 transition ${editFeeling === v ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
                        <span className="text-xl">{FEEL_EMOJIS[v]}</span>
                        <span className={`text-xs ${editFeeling === v ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>{FEEL_LABELS[v]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Échauffement */}
                <div className="mb-4">
                  <label className={labelCls}>Échauffement</label>
                  <textarea rows={2} value={editWarmup} onChange={e => setEditWarmup(e.target.value)}
                    placeholder="Ex: EMOM 6' — Dead Hang / Air Squat / Echo Bike..."
                    className={inputCls + ' resize-none'} />
                </div>

                {/* Skill */}
                <div className="mb-4">
                  <label className={labelCls}>Skill & Technique</label>
                  <textarea rows={2} value={editSkill} onChange={e => setEditSkill(e.target.value)}
                    placeholder="Ex: Snatch technique — Every 3' x 4..."
                    className={inputCls + ' resize-none'} />
                </div>

                {/* Résultat WOD */}
                {wod && (
                  <div className="mb-4">
                    <label className={labelCls}>Résultat WOD</label>
                    <div className="flex gap-2 mb-2">
                      {[{v:true,l:'RX'},{v:false,l:'Scaled'}].map(o => (
                        <button key={String(o.v)} onClick={() => setEditRx(o.v)}
                          className={`px-4 py-2 rounded-xl border text-sm font-bold transition ${
                            editRx === o.v
                              ? (o.v ? 'border-green-400 bg-green-50 text-green-700' : 'border-amber-400 bg-amber-50 text-amber-700')
                              : 'border-gray-200 bg-white text-gray-400'
                          }`}>{o.l}</button>
                      ))}
                    </div>
                    <input type="text" value={editResult} onChange={e => setEditResult(e.target.value)}
                      placeholder="Ex: 4+12, 12'35, 187 reps..." className={inputCls} />
                  </div>
                )}

                {/* Notes */}
                <div className="mb-5">
                  <label className={labelCls}>Notes libres</label>
                  <textarea rows={3} value={editNotes} onChange={e => setEditNotes(e.target.value)}
                    placeholder="Ressenti général, contexte particulier..."
                    className={inputCls + ' resize-none'} />
                </div>

                <button onClick={handleSave} disabled={saving}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-bold transition"
                  style={{ background: saving ? '#FED7AA' : 'var(--theme-primary, #F97316)' }}>
                  {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirmation suppression ── */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <p className="text-lg font-black text-gray-900 mb-2">Supprimer cette séance ?</p>
              <p className="text-sm text-gray-500 mb-6">
                {t?.emoji} {t?.name} · {new Date(session.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                <br />Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold">
                  Annuler
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition">
                  {deleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
