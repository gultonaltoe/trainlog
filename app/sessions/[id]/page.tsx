'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────
type SessionType = { name: string; emoji: string; color: string }
type Movement    = { name: string; category: string }
type BlockSet    = { set_number: number; reps: number | null; weight_kg: number | null }
type Block       = { id: string; order_index: number; movements: Movement | null; block_sets: BlockSet[] }
type Wod         = { format_label: string; time_cap_min: number | null; description: string | null; result_detail: string | null; is_rx: boolean }
type PainAlert   = { body_part_label: string; severity: number }
type Session     = {
  id: string; date: string; notes: string | null; duration_min: number | null
  sleep_hours: number | null; energy_level: number | null; rpe: number | null; feeling_post: number | null
  session_types: SessionType
}

const RPE_LABELS  = ['','Très facile','Facile','Un peu dur','Modéré','Modéré+','Dur','Très dur','Intense','Extrême','Maximum']
const RPE_COLORS  = ['','#3B82F6','#3B82F6','#3B82F6','#F59E0B','#F59E0B','#D97706','#EA580C','#EA580C','#EF4444','#DC2626']
const FEEL_EMOJIS = ['','😩','😕','😐','😊','🤩']
const SEV_COLORS  = ['','bg-yellow-100 text-yellow-700','bg-orange-100 text-orange-700','bg-red-100 text-red-700']

function parseNotes(raw: string | null) {
  if (!raw) return { warmup: null, skill: null, other: null }
  const warmupMatch = raw.match(/Échauffement:\s*(.+?)(?=\n(?:Skill\/Force:|$)|\n\n|$)/s)
  const skillMatch  = raw.match(/Skill\/Force:\s*(.+?)(?=\n(?:Échauffement:|Skill\/Force:|$)|\n\n|$)/s)
  const cleanOther  = raw
    .replace(/Échauffement:.*?(?=\n(?:Skill\/Force:|[A-ZÉ])|$)/s, '')
    .replace(/Skill\/Force:.*?(?=\n(?:Échauffement:|[A-ZÉ])|$)/s, '')
    .trim()
  return {
    warmup: warmupMatch?.[1]?.trim() ?? null,
    skill:  skillMatch?.[1]?.trim()  ?? null,
    other:  cleanOther || null,
  }
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

const card = "bg-white rounded-2xl border border-gray-200 p-4 mb-3"

// ── Page ──────────────────────────────────────────────────
export default function SessionDetailPage() {
  const params   = useParams()
  const id       = Array.isArray(params.id) ? params.id[0] : params.id
  const router   = useRouter()

  const [session,    setSession]    = useState<Session | null>(null)
  const [blocks,     setBlocks]     = useState<Block[]>([])
  const [wod,        setWod]        = useState<Wod | null>(null)
  const [painAlerts, setPainAlerts] = useState<PainAlert[]>([])
  const [loading,    setLoading]    = useState(true)
  const [notFound,   setNotFound]   = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('sessions')
        .select('id, date, notes, duration_min, sleep_hours, energy_level, rpe, feeling_post, session_types(name, emoji, color)')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('session_blocks')
        .select('id, order_index, movements(name, category), block_sets(set_number, reps, weight_kg)')
        .eq('session_id', id)
        .order('order_index', { ascending: true }),
      supabase.from('wods')
        .select('format_label, time_cap_min, description, result_detail, is_rx')
        .eq('session_id', id)
        .limit(1)
        .maybeSingle(),
      supabase.from('session_pain_alerts')
        .select('body_part_label, severity')
        .eq('session_id', id),
    ]).then(([s, b, w, p]) => {
      if (!s.data) { setNotFound(true); setLoading(false); return }
      setSession(s.data as unknown as Session)
      setBlocks((b.data ?? []) as unknown as Block[])
      setWod(w.data as Wod | null)
      setPainAlerts((p.data ?? []) as PainAlert[])
      setLoading(false)
    })
  }, [id])

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
          <div>
            <h1 className="text-lg font-black text-gray-900">{t?.name}</h1>
            <p className="text-sm text-gray-400">{capitalize(formatDate(session.date))}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { l: 'Durée',    v: session.duration_min ? `${session.duration_min}'` : '—', c: undefined },
            { l: 'RPE',      v: session.rpe ?? '—', sub: session.rpe ? RPE_LABELS[session.rpe] : null, c: session.rpe ? RPE_COLORS[session.rpe] : undefined },
            { l: 'Ressenti', v: session.feeling_post ? FEEL_EMOJIS[session.feeling_post] : '—', c: undefined },
            { l: 'Sommeil',  v: session.sleep_hours ? `${session.sleep_hours}h` : '—', c: undefined },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xl font-black" style={s.c ? { color: s.c } : { color: '#111827' }}>{String(s.v)}</p>
              {s.sub && <p className="text-xs text-gray-400 leading-tight mt-0.5 truncate">{s.sub}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Échauffement */}
        {warmup && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔥</span>
              <span className="text-sm font-bold text-gray-700">Échauffement</span>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{warmup}</p>
          </div>
        )}

        {/* Skill */}
        {skill && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎯</span>
              <span className="text-sm font-bold text-gray-700">Skill & Technique</span>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{skill}</p>
          </div>
        )}

        {/* Force */}
        {hasBlocks && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🏋️</span>
              <span className="text-sm font-bold text-gray-700">Force & Technique</span>
            </div>
            <div className="space-y-3">
              {blocks.filter(b => b.movements).map((block, bi, arr) => (
                <div key={block.id}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{block.movements!.name}</p>
                  {block.block_sets.length > 0 ? (
                    <div className="space-y-1.5">
                      {[...block.block_sets]
                        .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
                        .map((set, si) => (
                          <div key={si} className="flex items-center gap-3 text-sm">
                            <span className="text-xs text-gray-300 font-bold w-5">S{si+1}</span>
                            <span className="font-semibold text-gray-700">{set.reps ? `${set.reps} reps` : '—'}</span>
                            {set.weight_kg && <span className="text-gray-400">@ {set.weight_kg} kg</span>}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Aucune série enregistrée</p>
                  )}
                  {bi < arr.length - 1 && <div className="border-t border-gray-100 mt-3" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WOD */}
        {wod && (
          <div className="rounded-2xl border p-4 mb-3"
            style={{ background: (t?.color ?? '#F97316') + '08', borderColor: (t?.color ?? '#F97316') + '30' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="text-sm font-bold text-gray-700">WOD</span>
                {wod.format_label && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: t?.color ?? '#F97316' }}>
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

        {/* Douleurs */}
        {painAlerts.length > 0 && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚠️</span>
              <span className="text-sm font-bold text-gray-700">Alertes douleur</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {painAlerts.map((p, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${SEV_COLORS[p.severity]}`}>
                  {p.body_part_label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {other && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📝</span>
              <span className="text-sm font-bold text-gray-700">Notes</span>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{other}</p>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  )
}
