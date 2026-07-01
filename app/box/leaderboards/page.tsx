'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxMemberGuard } from '@/components/useBoxGuard'
import { getProgramming, type Programming } from '@/lib/programming'
import {
  getWodLeaderboard, getMyWodScore, logWodScore, deleteMyWodScore,
  getBenchmarks, createBenchmark, deleteBenchmark,
  getBenchmarkLeaderboard, getMyBenchmarkScore, logBenchmarkScore, deleteMyBenchmarkScore,
  parseScore, SCORE_TYPE_LABEL, SCORE_TYPE_OPTIONS,
  type LeaderboardEntry, type ScoreType, type MyScore, type Benchmark,
} from '@/lib/leaderboard'
import { getSessionUserId } from '@/lib/auth'
import { toast } from '@/lib/toast'
import { PageHeader, Card, Button, Field, Select, ui } from '@/components/ui'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtDay = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const PLACEHOLDER: Record<ScoreType, string> = { time: 'mm:ss (ex : 4:32)', reps: 'ex : 120', load: 'ex : 100', rounds: 'ex : 3+7' }
const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

// ── My-score entry (shared by WOD + benchmark). Remounted per context (key). ──
function ScoreForm({ scoreType, mine, busy, onSubmit, onRemove }: {
  scoreType: ScoreType; mine: MyScore; busy: boolean
  onSubmit: (raw: string, rx: boolean, note: string) => void; onRemove: () => void
}) {
  const [raw, setRaw] = useState(mine?.scoreDisplay ?? '')
  const [rx, setRx] = useState(mine?.rx ?? true)
  const [note, setNote] = useState(mine?.note ?? '')
  return (
    <Card className="p-4 mb-4 space-y-3">
      <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">Mon score · {SCORE_TYPE_LABEL[scoreType]}</p>
      <input className={ui.field} value={raw} placeholder={PLACEHOLDER[scoreType]} onChange={e => setRaw(e.target.value)} />
      <div className="flex rounded-xl overflow-hidden border border-[color:var(--border)] text-sm font-bold">
        {([[true, 'RX'], [false, 'Scaled']] as const).map(([v, label]) => (
          <button key={label} onClick={() => setRx(v)} className="flex-1 py-2 cursor-pointer"
            style={rx === v ? { background: 'var(--theme-primary)', color: '#fff' } : { color: 'var(--sub)' }}>{label}</button>
        ))}
      </div>
      <input className={ui.field} value={note} placeholder="Note (option.)" onChange={e => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button full onClick={() => onSubmit(raw, rx, note)} disabled={busy}>{mine ? 'Mettre à jour' : 'Enregistrer mon score'}</Button>
        {mine && <Button variant="secondary" onClick={onRemove} disabled={busy}>Retirer</Button>}
      </div>
    </Card>
  )
}

function Ranking({ rows, uid }: { rows: LeaderboardEntry[]; uid: string | null }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--border-strong)] py-2">Aucun score encore. Sois le premier 🔥</p>
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => {
        const me = r.userId === uid
        return (
          <div key={r.userId} className="flex items-center gap-3 rounded-xl border p-3"
            style={me ? { borderColor: 'var(--theme-primary)', background: 'var(--accent-soft)' } : { borderColor: 'var(--border)', background: 'var(--card)' }}>
            <span className="w-7 text-center text-sm font-black flex-shrink-0" style={{ color: i < 3 ? undefined : 'var(--muted)' }}>{medal(i)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--ink)] truncate">{r.firstName}{me && <span className="text-[var(--muted)] font-semibold"> · toi</span>}</p>
              {r.note && <p className="text-xs text-[var(--muted)] truncate">{r.note}</p>}
            </div>
            {!r.rx && <span className="text-[10px] font-bold text-[var(--sub)] bg-[var(--track)] rounded-full px-2 py-0.5 flex-shrink-0">Scaled</span>}
            <span className="text-base font-black text-[var(--ink)] flex-shrink-0 tabular-nums">{r.scoreDisplay}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function LeaderboardsPage() {
  const org = useBoxMemberGuard()
  const orgId = org?.orgId
  const isCoach = !!org && org.role !== 'member'
  const [tab, setTab] = useState<'wod' | 'bench'>('wod')
  const [uid, setUid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { getSessionUserId().then(setUid) }, [])

  if (!org) return null

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <PageHeader title="Classement" subtitle={org.orgName} backHref="/" />
        <div className="flex rounded-xl overflow-hidden border border-[color:var(--border)] bg-[var(--card)] text-sm font-bold mb-4">
          {([['wod', 'WOD du jour'], ['bench', 'Benchmarks']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-2.5 cursor-pointer"
              style={tab === t ? { background: 'var(--ink)', color: 'var(--card)' } : { color: 'var(--sub)' }}>{label}</button>
          ))}
        </div>
        {tab === 'wod'
          ? <WodTab orgId={orgId!} uid={uid} busy={busy} setBusy={setBusy} />
          : <BenchTab orgId={orgId!} uid={uid} isCoach={isCoach} busy={busy} setBusy={setBusy} />}
      </div>
    </div>
  )
}

// ── WOD du jour ──────────────────────────────────────────────────────────────
function WodTab({ orgId, uid, busy, setBusy }: { orgId: string; uid: string | null; busy: boolean; setBusy: (b: boolean) => void }) {
  const [date, setDate] = useState(() => iso(new Date()))
  const [wod, setWod] = useState<Programming | null>(null)
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [mine, setMine] = useState<MyScore>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [w, board, my] = await Promise.all([getProgramming(orgId, date), getWodLeaderboard(orgId, date), getMyWodScore(orgId, date)])
      setWod(w); setRows(board); setMine(my)
    } catch { setRows([]) }
    setLoading(false)
  }, [orgId, date])
  useEffect(() => { void load() }, [load])

  const scoreType = wod?.scoreType ?? null

  const submit = async (raw: string, rx: boolean, note: string) => {
    if (!scoreType) return
    const parsed = parseScore(scoreType, raw)
    if (!parsed) { toast.error('Score invalide pour ce format'); return }
    setBusy(true)
    try { await logWodScore(orgId, date, scoreType, parsed.value, parsed.display, rx, note); toast.success('Score enregistré 💪'); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(false)
  }
  const remove = async () => { setBusy(true); try { await deleteMyWodScore(orgId, date); toast.success('Score retiré'); await load() } catch { /* */ } setBusy(false) }
  const shiftDay = (d: number) => setDate(x => { const n = new Date(x + 'T00:00:00'); n.setDate(n.getDate() + d); return iso(n) })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => shiftDay(-1)} className="ds-hover w-9 h-9 rounded-xl border border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]">‹</button>
        <p className="text-sm font-bold text-[var(--ink)] capitalize">{fmtDay(date)}</p>
        <button onClick={() => shiftDay(1)} disabled={date >= iso(new Date())}
          className="ds-hover w-9 h-9 rounded-xl border border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)] disabled:opacity-40">›</button>
      </div>
      {loading ? <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
        : !scoreType ? (
          <Card className="p-6 text-center">
            <p className="text-3xl mb-2">🏆</p>
            <p className="text-sm font-bold text-[var(--ink)]">Pas de classement ce jour</p>
            <p className="text-xs text-[var(--muted)] mt-1">Le coach active le classement en choisissant un « type de score » sur le WOD.</p>
          </Card>
        ) : (
          <>
            {(wod?.title || wod?.wodDescription) && (
              <Card className="p-4 mb-4">
                {wod?.title && <p className="text-sm font-black text-[var(--ink)]">{wod.title}</p>}
                {wod?.wodFormat && <p className="text-xs font-bold" style={{ color: 'var(--theme-primary)' }}>{wod.wodFormat}</p>}
                {wod?.wodDescription && <p className="text-sm text-[var(--ink-soft)] whitespace-pre-line mt-1">{wod.wodDescription}</p>}
              </Card>
            )}
            <ScoreForm key={`wod-${date}-${mine?.id ?? 'none'}`} scoreType={scoreType} mine={mine} busy={busy} onSubmit={submit} onRemove={remove} />
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">Classement · {rows.length}</p>
            <Ranking rows={rows} uid={uid} />
          </>
        )}
    </>
  )
}

// ── Benchmarks ───────────────────────────────────────────────────────────────
function BenchTab({ orgId, uid, isCoach, busy, setBusy }: { orgId: string; uid: string | null; isCoach: boolean; busy: boolean; setBusy: (b: boolean) => void }) {
  const [list, setList] = useState<Benchmark[] | null>(null)
  const [sel, setSel] = useState<Benchmark | null>(null)
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [mine, setMine] = useState<MyScore>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<{ name: string; scoreType: ScoreType | ''; description: string }>({ name: '', scoreType: '', description: '' })

  const loadList = useCallback(async () => {
    try { setList(await getBenchmarks(orgId)) } catch { setList([]) }
  }, [orgId])
  useEffect(() => { void loadList() }, [loadList])

  const loadDetail = useCallback(async (b: Benchmark) => {
    setDetailLoading(true)
    try { const [board, my] = await Promise.all([getBenchmarkLeaderboard(orgId, b.id), getMyBenchmarkScore(b.id)]); setRows(board); setMine(my) }
    catch { setRows([]) }
    setDetailLoading(false)
  }, [orgId])

  const open = (b: Benchmark) => { setSel(b); void loadDetail(b) }

  const create = async () => {
    if (!form.name.trim() || !form.scoreType) { toast.error('Nom + type de score requis'); return }
    setBusy(true)
    try { await createBenchmark(orgId, form.name, form.scoreType, form.description); toast.success('Benchmark créé'); setForm({ name: '', scoreType: '', description: '' }); setAdding(false); await loadList() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(false)
  }
  const removeBench = async (b: Benchmark) => {
    setBusy(true)
    try { await deleteBenchmark(b.id); toast.success('Supprimé'); setSel(null); await loadList() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(false)
  }
  const submit = async (raw: string, rx: boolean, note: string) => {
    if (!sel) return
    const parsed = parseScore(sel.scoreType, raw)
    if (!parsed) { toast.error('Score invalide pour ce format'); return }
    setBusy(true)
    try { await logBenchmarkScore(orgId, sel.id, sel.scoreType, parsed.value, parsed.display, rx, note); toast.success('Score enregistré 💪'); await loadDetail(sel) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(false)
  }
  const removeScore = async () => { if (!sel) return; setBusy(true); try { await deleteMyBenchmarkScore(sel.id); toast.success('Score retiré'); await loadDetail(sel) } catch { /* */ } setBusy(false) }

  // Detail view of a selected benchmark
  if (sel) {
    return (
      <>
        <button onClick={() => setSel(null)} className="text-sm font-bold text-[var(--sub)] mb-3 cursor-pointer">‹ Tous les benchmarks</button>
        <Card className="p-4 mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-black text-[var(--ink)]">{sel.name}</p>
              <p className="text-xs font-bold" style={{ color: 'var(--theme-primary)' }}>{SCORE_TYPE_LABEL[sel.scoreType]}</p>
            </div>
            {isCoach && <button onClick={() => removeBench(sel)} disabled={busy} className="text-xs font-bold text-red-500 flex-shrink-0 cursor-pointer">Supprimer</button>}
          </div>
          {sel.description && <p className="text-sm text-[var(--ink-soft)] whitespace-pre-line mt-1">{sel.description}</p>}
        </Card>
        {detailLoading ? <p className="text-sm text-[var(--muted)] text-center py-8">Chargement…</p> : (
          <>
            <ScoreForm key={`bench-${sel.id}-${mine?.id ?? 'none'}`} scoreType={sel.scoreType} mine={mine} busy={busy} onSubmit={submit} onRemove={removeScore} />
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">Classement · {rows.length}</p>
            <Ranking rows={rows} uid={uid} />
          </>
        )}
      </>
    )
  }

  // List of benchmarks
  return (
    <>
      {isCoach && (adding ? (
        <Card className="p-4 mb-4 space-y-3">
          <Field label="Nom du benchmark"><input className={ui.field} value={form.name} placeholder="Fran, Cindy, Back Squat 1RM…" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Type de score">
            <Select<ScoreType> value={form.scoreType} placeholder="Choisir…" onChange={v => setForm(f => ({ ...f, scoreType: v }))}
              options={SCORE_TYPE_OPTIONS.map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Description (option.)"><textarea rows={2} className={ui.field} value={form.description} placeholder="21-15-9 Thrusters + Pull-ups…" onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
          <div className="flex gap-2">
            <Button full onClick={create} disabled={busy}>Créer</Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </Card>
      ) : (
        <button onClick={() => setAdding(true)} className="ds-hover w-full mb-4 py-2.5 rounded-2xl border border-dashed border-[color:var(--border-strong)] text-sm font-bold text-[var(--ink-soft)]">+ Nouveau benchmark</button>
      ))}

      {list === null ? <p className="text-sm text-[var(--muted)] text-center py-8">Chargement…</p>
        : list.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm font-bold text-[var(--ink)]">Aucun benchmark</p>
            <p className="text-xs text-[var(--muted)] mt-1">{isCoach ? 'Crée un benchmark (Fran, Cindy…) pour lancer un classement all-time.' : 'Le coach n’a pas encore créé de benchmark.'}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {list.map(b => (
              <button key={b.id} onClick={() => open(b)} className="ds-hover w-full text-left rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-3 flex items-center justify-between gap-2 cursor-pointer">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--ink)] truncate">{b.name}</p>
                  <p className="text-xs text-[var(--muted)]">{SCORE_TYPE_LABEL[b.scoreType]}</p>
                </div>
                <span className="text-[var(--border-strong)]">›</span>
              </button>
            ))}
          </div>
        )}
    </>
  )
}
