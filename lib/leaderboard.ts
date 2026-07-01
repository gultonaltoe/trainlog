import { supabase } from './supabase'
import { getSessionUserId } from './auth'

// ST-102 (CA-01) Leaderboards v1. A score is logged against the box's daily WOD
// (wod_date) — benchmarks share the same table (benchmark_id) as a fast follow.
// Ranking direction is set by score_type: 'time' → lower wins, others → higher.

export type ScoreType = 'time' | 'reps' | 'load' | 'rounds'

export const SCORE_TYPE_LABEL: Record<ScoreType, string> = {
  time: 'Temps (mm:ss)', reps: 'Répétitions', load: 'Charge (kg)', rounds: 'Rounds + reps',
}

export const SCORE_TYPE_OPTIONS: [ScoreType, string][] = [
  ['time', 'Temps'], ['reps', 'Répétitions'], ['load', 'Charge'], ['rounds', 'Rounds + reps'],
]

export type LeaderboardEntry = {
  userId: string
  firstName: string
  scoreType: ScoreType
  scoreValue: number
  scoreDisplay: string
  rx: boolean
  note: string | null
}

export type MyScore = { id: string; scoreDisplay: string; rx: boolean; note: string | null } | null

// Parse raw input into a canonical sort value + a human display, per score type.
// Returns null on invalid input.
export function parseScore(type: ScoreType, raw: string): { value: number; display: string } | null {
  const s = raw.trim()
  if (!s) return null
  if (type === 'time') {
    const m = s.match(/^(\d+):([0-5]?\d)$/)
    if (m) { const secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10); return { value: secs, display: `${m[1]}:${m[2].padStart(2, '0')}` } }
    const n = parseInt(s, 10)
    if (!isNaN(n) && n >= 0) return { value: n, display: `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` }
    return null
  }
  if (type === 'rounds') {
    const m = s.match(/^(\d+)\s*\+\s*(\d+)$/)
    if (m) { const r = parseInt(m[1], 10), reps = parseInt(m[2], 10); return { value: r * 1000 + reps, display: `${r}+${reps}` } }
    const n = parseInt(s, 10)
    if (!isNaN(n) && n >= 0) return { value: n * 1000, display: `${n}+0` }
    return null
  }
  const n = parseFloat(s.replace(',', '.'))
  if (isNaN(n) || n < 0) return null
  return { value: n, display: type === 'load' ? `${n} kg` : `${n}` }
}

/** The current user's score for a day's WOD (to prefill the form), or null. */
export async function getMyWodScore(orgId: string, date: string): Promise<MyScore> {
  const uid = await getSessionUserId()
  if (!uid) return null
  const { data } = await supabase.from('wod_scores')
    .select('id, score_display, rx, note')
    .eq('organization_id', orgId).eq('user_id', uid).eq('wod_date', date).maybeSingle()
  if (!data) return null
  const r = data as { id: string; score_display: string; rx: boolean; note: string | null }
  return { id: r.id, scoreDisplay: r.score_display, rx: r.rx, note: r.note }
}

/** Upsert the current user's score for a daily WOD (one row per member per day). */
export async function logWodScore(
  orgId: string, date: string, scoreType: ScoreType,
  value: number, display: string, rx: boolean, note: string,
): Promise<void> {
  const uid = await getSessionUserId()
  if (!uid) throw new Error('Session expirée, reconnecte-toi')
  const existing = await supabase.from('wod_scores').select('id')
    .eq('organization_id', orgId).eq('user_id', uid).eq('wod_date', date).maybeSingle()
  const row = {
    organization_id: orgId, user_id: uid, wod_date: date, benchmark_id: null,
    score_type: scoreType, score_value: value, score_display: display,
    rx, note: note.trim() || null, updated_at: new Date().toISOString(),
  }
  const { error } = existing.data
    ? await supabase.from('wod_scores').update(row).eq('id', (existing.data as { id: string }).id)
    : await supabase.from('wod_scores').insert(row)
  if (error) throw new Error(error.message)
}

/** Delete the current user's score for a daily WOD. */
export async function deleteMyWodScore(orgId: string, date: string): Promise<void> {
  const uid = await getSessionUserId()
  if (!uid) return
  const { error } = await supabase.from('wod_scores').delete()
    .eq('organization_id', orgId).eq('user_id', uid).eq('wod_date', date)
  if (error) throw new Error(error.message)
}

type LbRow = {
  user_id: string; first_name: string; score_type: ScoreType
  score_value: number; score_display: string; rx: boolean; note: string | null
}

function mapRows(data: LbRow[] | null): LeaderboardEntry[] {
  return (data ?? []).map(r => ({
    userId: r.user_id, firstName: r.first_name, scoreType: r.score_type,
    scoreValue: r.score_value, scoreDisplay: r.score_display, rx: r.rx, note: r.note,
  }))
}

/** Ranked leaderboard for a day's WOD (names via SECURITY DEFINER RPC). */
export async function getWodLeaderboard(orgId: string, date: string): Promise<LeaderboardEntry[]> {
  const call = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) =>
    Promise<{ data: LbRow[] | null; error: { message: string } | null }>
  const { data, error } = await call.call(supabase, 'get_wod_leaderboard', { p_org_id: orgId, p_date: date })
  if (error) throw new Error(error.message)
  return mapRows(data)
}

// ── Benchmarks (named workouts, all-time PR per member) ──────────────────────

export type Benchmark = { id: string; name: string; scoreType: ScoreType; description: string | null }

/** Benchmarks defined for a box, alphabetical. */
export async function getBenchmarks(orgId: string): Promise<Benchmark[]> {
  const { data, error } = await supabase.from('benchmarks')
    .select('id, name, score_type, description').eq('organization_id', orgId).order('name')
  if (error) throw new Error(`getBenchmarks: ${error.message}`)
  return ((data ?? []) as { id: string; name: string; score_type: ScoreType; description: string | null }[])
    .map(b => ({ id: b.id, name: b.name, scoreType: b.score_type, description: b.description }))
}

/** Coach/owner creates a benchmark. */
export async function createBenchmark(orgId: string, name: string, scoreType: ScoreType, description: string): Promise<void> {
  const uid = await getSessionUserId()
  const { error } = await supabase.from('benchmarks').insert({
    organization_id: orgId, name: name.trim(), score_type: scoreType, description: description.trim() || null, created_by: uid,
  })
  if (error) throw new Error(error.message)
}

/** Coach/owner deletes a benchmark (cascades its scores). */
export async function deleteBenchmark(id: string): Promise<void> {
  const { error } = await supabase.from('benchmarks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** The current user's score for a benchmark (to prefill), or null. */
export async function getMyBenchmarkScore(benchmarkId: string): Promise<MyScore> {
  const uid = await getSessionUserId()
  if (!uid) return null
  const { data } = await supabase.from('wod_scores')
    .select('id, score_display, rx, note').eq('benchmark_id', benchmarkId).eq('user_id', uid).maybeSingle()
  if (!data) return null
  const r = data as { id: string; score_display: string; rx: boolean; note: string | null }
  return { id: r.id, scoreDisplay: r.score_display, rx: r.rx, note: r.note }
}

/** Upsert the current user's score for a benchmark (one row per member). */
export async function logBenchmarkScore(
  orgId: string, benchmarkId: string, scoreType: ScoreType,
  value: number, display: string, rx: boolean, note: string,
): Promise<void> {
  const uid = await getSessionUserId()
  if (!uid) throw new Error('Session expirée, reconnecte-toi')
  const existing = await supabase.from('wod_scores').select('id')
    .eq('benchmark_id', benchmarkId).eq('user_id', uid).maybeSingle()
  const row = {
    organization_id: orgId, user_id: uid, wod_date: null, benchmark_id: benchmarkId,
    score_type: scoreType, score_value: value, score_display: display,
    rx, note: note.trim() || null, updated_at: new Date().toISOString(),
  }
  const { error } = existing.data
    ? await supabase.from('wod_scores').update(row).eq('id', (existing.data as { id: string }).id)
    : await supabase.from('wod_scores').insert(row)
  if (error) throw new Error(error.message)
}

/** Delete the current user's score for a benchmark. */
export async function deleteMyBenchmarkScore(benchmarkId: string): Promise<void> {
  const uid = await getSessionUserId()
  if (!uid) return
  const { error } = await supabase.from('wod_scores').delete().eq('benchmark_id', benchmarkId).eq('user_id', uid)
  if (error) throw new Error(error.message)
}

/** Ranked all-time leaderboard for a benchmark (names via SECURITY DEFINER RPC). */
export async function getBenchmarkLeaderboard(orgId: string, benchmarkId: string): Promise<LeaderboardEntry[]> {
  const call = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) =>
    Promise<{ data: LbRow[] | null; error: { message: string } | null }>
  const { data, error } = await call.call(supabase, 'get_benchmark_leaderboard', { p_org_id: orgId, p_benchmark_id: benchmarkId })
  if (error) throw new Error(error.message)
  return mapRows(data)
}
