'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxMemberGuard } from '@/components/useBoxGuard'
import { getProgramming, type Programming } from '@/lib/programming'
import {
  getWodLeaderboard, getMyWodScore, logWodScore, deleteMyWodScore, parseScore,
  SCORE_TYPE_LABEL, type LeaderboardEntry, type ScoreType, type MyScore,
} from '@/lib/leaderboard'
import { getSessionUserId } from '@/lib/auth'
import { toast } from '@/lib/toast'
import { PageHeader, Card, Button, ui } from '@/components/ui'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtDay = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const PLACEHOLDER: Record<ScoreType, string> = { time: 'mm:ss (ex : 4:32)', reps: 'ex : 120', load: 'ex : 100', rounds: 'ex : 3+7' }
const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

export default function LeaderboardsPage() {
  const org = useBoxMemberGuard()
  const orgId = org?.orgId
  const [date, setDate] = useState(() => iso(new Date()))
  const [wod, setWod] = useState<Programming | null>(null)
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [mine, setMine] = useState<MyScore>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ raw: '', rx: true, note: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => { getSessionUserId().then(setUid) }, [])

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [w, board, my] = await Promise.all([
        getProgramming(orgId, date),
        getWodLeaderboard(orgId, date),
        getMyWodScore(orgId, date),
      ])
      setWod(w); setRows(board); setMine(my)
      setForm(f => ({ ...f, raw: my?.scoreDisplay ?? '', rx: my?.rx ?? true, note: my?.note ?? '' }))
    } catch { setRows([]) }
    setLoading(false)
  }, [orgId, date])
  useEffect(() => { void load() }, [load])

  const scoreType = wod?.scoreType ?? null

  const submit = async () => {
    if (!orgId || !scoreType) return
    const parsed = parseScore(scoreType, form.raw)
    if (!parsed) { toast.error('Score invalide pour ce format'); return }
    setBusy(true)
    try {
      await logWodScore(orgId, date, scoreType, parsed.value, parsed.display, form.rx, form.note)
      toast.success('Score enregistré 💪'); await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(false)
  }

  const remove = async () => {
    if (!orgId) return
    setBusy(true)
    try { await deleteMyWodScore(orgId, date); setForm({ raw: '', rx: true, note: '' }); toast.success('Score retiré'); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(false)
  }

  const shiftDay = (dir: number) => setDate(d => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + dir); return iso(x) })

  if (!org) return null

  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <PageHeader title="Classement" subtitle={org.orgName} backHref="/" />

        {/* Day nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shiftDay(-1)} className="ds-hover w-9 h-9 rounded-xl border border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)]">‹</button>
          <p className="text-sm font-bold text-[var(--ink)] capitalize">{fmtDay(date)}</p>
          <button onClick={() => shiftDay(1)} disabled={date >= iso(new Date())}
            className="ds-hover w-9 h-9 rounded-xl border border-[color:var(--border)] bg-[var(--card)] text-[var(--ink-soft)] disabled:opacity-40">›</button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Chargement…</p>
        ) : !scoreType ? (
          <Card className="p-6 text-center">
            <p className="text-3xl mb-2">🏆</p>
            <p className="text-sm font-bold text-[var(--ink)]">Pas de classement ce jour</p>
            <p className="text-xs text-[var(--muted)] mt-1">Le coach active le classement en choisissant un « type de score » sur le WOD.</p>
          </Card>
        ) : (
          <>
            {/* WOD summary */}
            {(wod?.title || wod?.wodDescription) && (
              <Card className="p-4 mb-4">
                {wod?.title && <p className="text-sm font-black text-[var(--ink)]">{wod.title}</p>}
                {wod?.wodFormat && <p className="text-xs font-bold" style={{ color: 'var(--theme-primary)' }}>{wod.wodFormat}</p>}
                {wod?.wodDescription && <p className="text-sm text-[var(--ink-soft)] whitespace-pre-line mt-1">{wod.wodDescription}</p>}
              </Card>
            )}

            {/* My score */}
            <Card className="p-4 mb-4 space-y-3">
              <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">Mon score · {SCORE_TYPE_LABEL[scoreType]}</p>
              <input className={ui.field} value={form.raw} placeholder={PLACEHOLDER[scoreType]}
                onChange={e => setForm(f => ({ ...f, raw: e.target.value }))} />
              <div className="flex rounded-xl overflow-hidden border border-[color:var(--border)] text-sm font-bold">
                {([[true, 'RX'], [false, 'Scaled']] as const).map(([v, label]) => (
                  <button key={label} onClick={() => setForm(f => ({ ...f, rx: v }))} className="flex-1 py-2 cursor-pointer"
                    style={form.rx === v ? { background: 'var(--theme-primary)', color: '#fff' } : { color: 'var(--sub)' }}>
                    {label}
                  </button>
                ))}
              </div>
              <input className={ui.field} value={form.note} placeholder="Note (option.)"
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              <div className="flex gap-2">
                <Button full onClick={submit} disabled={busy}>{mine ? 'Mettre à jour' : 'Enregistrer mon score'}</Button>
                {mine && <Button variant="secondary" onClick={remove} disabled={busy}>Retirer</Button>}
              </div>
            </Card>

            {/* Ranking */}
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">Classement · {rows.length}</p>
            {rows.length === 0 ? (
              <p className="text-sm text-[var(--border-strong)] py-2">Aucun score encore. Sois le premier 🔥</p>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r, i) => {
                  const me = r.userId === uid
                  return (
                    <div key={r.userId}
                      className="flex items-center gap-3 rounded-xl border p-3"
                      style={me
                        ? { borderColor: 'var(--theme-primary)', background: 'var(--accent-soft)' }
                        : { borderColor: 'var(--border)', background: 'var(--card)' }}>
                      <span className="w-7 text-center text-sm font-black flex-shrink-0" style={{ color: i < 3 ? undefined : 'var(--muted)' }}>{medal(i)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[var(--ink)] truncate">
                          {r.firstName}{me && <span className="text-[var(--muted)] font-semibold"> · toi</span>}
                        </p>
                        {r.note && <p className="text-xs text-[var(--muted)] truncate">{r.note}</p>}
                      </div>
                      {!r.rx && <span className="text-[10px] font-bold text-[var(--sub)] bg-[var(--track)] rounded-full px-2 py-0.5 flex-shrink-0">Scaled</span>}
                      <span className="text-base font-black text-[var(--ink)] flex-shrink-0 tabular-nums">{r.scoreDisplay}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
