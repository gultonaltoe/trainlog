'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DatePicker } from '@/components/ui'

type SessionDetail = {
  id: string
  date: string
  rpe: number | null
  feeling_post: number | null
  duration_min: number | null
  sleep_hours: number | null
  energy_level: number | null
  notes: string | null
  meta: Record<string, unknown> | null
  session_types: { name: string; emoji: string; color: string }
  session_pain_alerts: { id: string; body_part_label: string; severity: number }[]
}
type Block = {
  id: string
  block_order: number
  title: string
  block_type: string
  is_complex: boolean
  complex_label: string | null
  block_sets: {
    id: string; set_number: number; reps: number | null; weight_kg: number | null
    tempo: string | null; pct_rm: number | null; execution: string | null; is_pr: boolean
    movement_label: string
  }[]
}
type Wod = {
  id: string; format_label: string; description: string | null
  result_detail: string | null; is_rx: boolean; time_cap_min: number | null
}

const RPE_COLORS = ['','#3B82F6','#3B82F6','#3B82F6','#F59E0B','#F59E0B','#D97706','#EA580C','#EA580C','#EF4444','#DC2626']
const SEVERITY_LABEL = ['','Légère','Modérée','Sévère']
const SEVERITY_COLOR = ['','#F59E0B','#EA580C','#EF4444']
const EXEC_ICON: Record<string, string> = { good: '✓', ok: '~', fail: '✗' }
const EXEC_COLOR: Record<string, string> = { good: '#10B981', ok: '#F59E0B', fail: '#EF4444' }

function fmtDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

type EditDraft = {
  date: string; duration_min: string; rpe: string
  feeling_post: string; sleep_hours: string; energy_level: string; notes: string
}

export default function SessionDetailPage() {
  const params       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const id           = Array.isArray(params.id) ? params.id[0] : params.id as string
  const from         = searchParams.get('from')

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [blocks,  setBlocks]  = useState<Block[]>([])
  const [wods,    setWods]    = useState<Wod[]>([])
  const [loading, setLoading] = useState(true)

  const [showEdit,    setShowEdit]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [draft,       setDraft]       = useState<EditDraft | null>(null)

  function goBack() {
    if (from === 'sessions') router.push('/sessions')
    else router.back()
  }

  function loadSession() {
    if (!id) return
    Promise.all([
      supabase.from('sessions')
        .select('id, date, rpe, feeling_post, duration_min, sleep_hours, energy_level, notes, meta, session_types(name, emoji, color), session_pain_alerts(id, body_part_label, severity)')
        .eq('id', id).single(),
      supabase.from('session_blocks')
        .select('id, block_order, title, block_type, is_complex, complex_label, block_sets(id, set_number, reps, weight_kg, tempo, pct_rm, execution, is_pr, movement_label)')
        .eq('session_id', id).order('block_order'),
      supabase.from('wods')
        .select('id, format_label, description, result_detail, is_rx, time_cap_min')
        .eq('session_id', id),
    ]).then(([sRes, bRes, wRes]) => {
      const s = sRes.data as unknown as SessionDetail
      setSession(s)
      setBlocks((bRes.data ?? []) as unknown as Block[])
      setWods((wRes.data ?? []) as unknown as Wod[])
      setLoading(false)
    })
  }

  useEffect(() => { loadSession() }, [id])

  function openEdit() {
    if (!session) return
    setDraft({
      date:          session.date,
      duration_min:  session.duration_min != null  ? String(session.duration_min)  : '',
      rpe:           session.rpe          != null  ? String(session.rpe)           : '',
      feeling_post:  session.feeling_post != null  ? String(session.feeling_post)  : '',
      sleep_hours:   session.sleep_hours  != null  ? String(session.sleep_hours)   : '',
      energy_level:  session.energy_level != null  ? String(session.energy_level)  : '',
      notes:         session.notes ?? '',
    })
    setShowEdit(true)
  }

  async function handleSave() {
    if (!draft || !session) return
    setSaving(true)
    await supabase.from('sessions').update({
      date:          draft.date || session.date,
      duration_min:  draft.duration_min  ? parseInt(draft.duration_min)    : null,
      rpe:           draft.rpe           ? parseInt(draft.rpe)             : null,
      feeling_post:  draft.feeling_post  ? parseInt(draft.feeling_post)    : null,
      sleep_hours:   draft.sleep_hours   ? parseFloat(draft.sleep_hours)   : null,
      energy_level:  draft.energy_level  ? parseInt(draft.energy_level)    : null,
      notes:         draft.notes || null,
    }).eq('id', session.id)
    setSaving(false)
    setShowEdit(false)
    loadSession()
  }

  async function handleDelete() {
    if (!session) return
    setDeleting(true)
    await supabase.from('sessions').update({ deleted_at: new Date().toISOString() }).eq('id', session.id)
    router.push('/sessions')
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '80dvh' }}>
      <div className="w-8 h-8 rounded-full border-4 border-orange-400 border-t-transparent animate-spin" />
    </div>
  )

  if (!session) return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: '80dvh' }}>
      <p className="text-3xl">🤷</p>
      <p className="text-sm text-[var(--sub)]">Séance introuvable</p>
      <button onClick={goBack} className="text-orange-500 text-sm font-semibold">← Retour</button>
    </div>
  )

  const st = session.session_types

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-6">

        {/* Top bar */}
        <div className="pt-5 flex items-center justify-between">
          <button onClick={goBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink-soft)] transition">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {from === 'sessions' ? 'Historique' : 'Retour'}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={openEdit}
              className="text-xs font-semibold text-[var(--sub)] hover:text-[var(--ink)] bg-[var(--card)] border border-[color:var(--border)] rounded-lg px-3 py-1.5 transition">
              ✏️ Modifier
            </button>
            <button onClick={() => setShowConfirm(true)}
              className="text-xs font-semibold text-red-500 hover:text-red-700 bg-[var(--card)] border border-red-200 rounded-lg px-3 py-1.5 transition">
              🗑 Supprimer
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="pt-4 pb-5 flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: st.color + '20', border: `2px solid ${st.color}40` }}>
            {st.emoji}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-[var(--ink)]">{st.name}</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">{capitalize(fmtDate(session.date))}</p>
            {session.duration_min && (
              <p className="text-xs text-[var(--muted)]">{session.duration_min} min</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        {(session.rpe !== null || session.feeling_post !== null || session.sleep_hours !== null || session.energy_level !== null) && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {session.rpe !== null && (
              <div className="bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3 text-center">
                <p className="text-lg font-black" style={{ color: RPE_COLORS[session.rpe] }}>{session.rpe}<span className="text-xs font-bold">/10</span></p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">RPE</p>
              </div>
            )}
            {session.feeling_post !== null && (
              <div className="bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3 text-center">
                <p className="text-lg font-black text-[var(--ink)]">{session.feeling_post}</p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">Feeling</p>
              </div>
            )}
            {session.sleep_hours !== null && (
              <div className="bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3 text-center">
                <p className="text-lg font-black text-[var(--ink)]">{session.sleep_hours}h</p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">Sommeil</p>
              </div>
            )}
            {session.energy_level !== null && (
              <div className="bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3 text-center">
                <p className="text-lg font-black text-[var(--ink)]">{session.energy_level}</p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">Énergie</p>
              </div>
            )}
          </div>
        )}

        {/* WODs */}
        {wods.map(wod => (
          <div key={wod.id} className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">WOD — {wod.format_label}</p>
              <div className="flex items-center gap-2">
                {wod.time_cap_min && <span className="text-xs text-[var(--muted)]">{wod.time_cap_min} min cap</span>}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${wod.is_rx ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-[var(--track)] text-[var(--sub)]'}`}>
                  {wod.is_rx ? 'RX' : 'Scaled'}
                </span>
              </div>
            </div>
            {wod.description && <p className="text-sm text-[var(--ink-soft)] whitespace-pre-wrap mb-2">{wod.description}</p>}
            {wod.result_detail && (
              <div className="bg-[var(--accent-soft)] rounded-xl px-3 py-2 mt-2">
                <p className="text-xs font-bold text-[var(--accent-text)] mb-0.5">Résultat</p>
                <p className="text-sm font-semibold text-[var(--ink)]">{wod.result_detail}</p>
              </div>
            )}
          </div>
        ))}

        {/* Blocks */}
        {blocks.map(block => (
          <div key={block.id} className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 mb-3">
            <p className="text-sm font-bold text-[var(--ink)] mb-3">
              {block.is_complex ? `🔗 ${block.complex_label ?? block.title}` : block.title}
            </p>
            <div className="space-y-1.5">
              {block.block_sets
                .sort((a, b) => a.set_number - b.set_number)
                .map(set => (
                  <div key={set.id} className="flex items-center gap-2 text-sm">
                    <span className="text-[11px] text-[var(--muted)] w-5 flex-shrink-0">S{set.set_number}</span>
                    {set.weight_kg !== null && <span className="font-bold text-[var(--ink)]">{set.weight_kg} kg</span>}
                    {set.reps    !== null && <span className="text-[var(--sub)]">× {set.reps}</span>}
                    {set.pct_rm  !== null && <span className="text-xs text-purple-500 font-semibold">{set.pct_rm}%</span>}
                    {set.tempo && <span className="text-xs text-[var(--muted)] font-mono">@{set.tempo}</span>}
                    {set.execution && set.execution in EXEC_ICON && (
                      <span className="text-sm font-bold" style={{ color: EXEC_COLOR[set.execution] }}>
                        {EXEC_ICON[set.execution]}
                      </span>
                    )}
                    {set.is_pr && <span className="ml-auto text-xs font-bold bg-[var(--accent-soft)] text-[var(--accent-text)] px-1.5 py-0.5 rounded-full">PR 🏆</span>}
                  </div>
                ))}
            </div>
          </div>
        ))}

        {/* Pain alerts */}
        {session.session_pain_alerts?.length > 0 && (
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 mb-3">
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">⚠️ Alertes douleur</p>
            <div className="space-y-1.5">
              {session.session_pain_alerts.map(a => (
                <div key={a.id} className="flex items-center justify-between">
                  <p className="text-sm text-[var(--ink-soft)]">{a.body_part_label}</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ background: SEVERITY_COLOR[a.severity] }}>
                    {SEVERITY_LABEL[a.severity]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {session.notes && (
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 mb-3">
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-[var(--ink-soft)] whitespace-pre-wrap">{session.notes}</p>
          </div>
        )}

        {blocks.length === 0 && wods.length === 0 && !session.notes && (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm text-[var(--muted)]">Aucun détail enregistré pour cette séance</p>
          </div>
        )}
      </div>

      {/* ── Edit modal ─────────────────────────────────────── */}
      {showEdit && draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowEdit(false)}>
          <div className="w-full max-w-lg bg-[var(--card)] rounded-t-3xl p-6 pb-10 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-black text-[var(--ink)]">Modifier la séance</h2>
              <button onClick={() => setShowEdit(false)} className="text-[var(--muted)] text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">Date</label>
                <div className="mt-1"><DatePicker value={draft.date} onChange={v => setDraft(d => d && ({ ...d, date: v }))} /></div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">Durée (min)</label>
                <input type="number" placeholder="60" value={draft.duration_min} onChange={e => setDraft(d => d && ({ ...d, duration_min: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">RPE (1-10)</label>
                <input type="number" min={1} max={10} placeholder="7" value={draft.rpe} onChange={e => setDraft(d => d && ({ ...d, rpe: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">Feeling (1-5)</label>
                <input type="number" min={1} max={5} placeholder="3" value={draft.feeling_post} onChange={e => setDraft(d => d && ({ ...d, feeling_post: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">Sommeil (h)</label>
                <input type="number" step="0.5" placeholder="7.5" value={draft.sleep_hours} onChange={e => setDraft(d => d && ({ ...d, sleep_hours: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">Énergie (1-5)</label>
                <input type="number" min={1} max={5} placeholder="4" value={draft.energy_level} onChange={e => setDraft(d => d && ({ ...d, energy_level: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--sub)] uppercase tracking-wide">Notes</label>
              <textarea rows={3} placeholder="Notes libres…" value={draft.notes} onChange={e => setDraft(d => d && ({ ...d, notes: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
              style={{ background: 'var(--theme-primary, #F97316)', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm bg-[var(--card)] rounded-2xl p-6">
            <p className="text-base font-black text-[var(--ink)] mb-1">Supprimer cette séance ?</p>
            <p className="text-sm text-[var(--muted)] mb-5">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[var(--ink-soft)] bg-[var(--track)]">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 transition"
                style={{ opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
