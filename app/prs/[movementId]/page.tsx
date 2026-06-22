'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSessionUserId } from '@/lib/auth'

type PR = {
  id: string; value: number; unit: string; date: string
  session_id: string | null; movement_name: string
}
type SetData = {
  weight_kg: number; reps: number | null; date: string; session_id: string
}
type WeekVol = { week: string; tonnage: number }

// Brzycki 1RM formula (accurate up to ~10 reps)
function brzycki(weight: number, reps: number): number {
  if (reps <= 1)  return weight
  if (reps > 12)  return 0
  return Math.round(weight / (1.0278 - 0.0278 * reps))
}

function startOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return monday.toISOString().split('T')[0]
}

function formatDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatDateLong(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MovementPRPage() {
  const params     = useParams()
  const movementId = decodeURIComponent(Array.isArray(params.movementId) ? params.movementId[0] : params.movementId as string)
  const router     = useRouter()

  const [prs,     setPrs]     = useState<PR[]>([])
  const [sets,    setSets]    = useState<SetData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      const uid = await getSessionUserId()
      if (!uid) { setLoading(false); return }
      const [prRes, setsRes] = await Promise.all([
        supabase.from('personal_records')
          .select('id, value, unit, date, session_id, movement_name')
          .eq('movement_id', movementId)
          .eq('user_id', uid)
          .order('date', { ascending: true }),
        supabase.from('block_sets')
          .select('weight_kg, reps, session_blocks!inner(sessions!inner(id, date, user_id))')
          .eq('movement_id', movementId)
          .not('weight_kg', 'is', null)
          .order('session_blocks(sessions(date))', { ascending: true }),
      ])
      setPrs((prRes.data ?? []) as PR[])
      const rawSets = (setsRes.data ?? []) as unknown as {
        weight_kg: number; reps: number | null
        session_blocks: { sessions: { id: string; date: string; user_id: string } }
      }[]
      setSets(rawSets
        .filter(s => s.session_blocks.sessions.user_id === uid)
        .map(s => ({
          weight_kg:  s.weight_kg,
          reps:       s.reps,
          date:       s.session_blocks.sessions.date,
          session_id: s.session_blocks.sessions.id,
        })))
      setLoading(false)
    }
    void run()
  }, [movementId])

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '80dvh' }}>
      <div className="w-8 h-8 rounded-full border-4 border-orange-400 border-t-transparent animate-spin" />
    </div>
  )

  // ── Core data ────────────────────────────────────────────
  const best     = prs.length ? Math.max(...prs.map(p => p.value)) : 0
  const name     = prs[0]?.movement_name ?? 'Mouvement'
  const unit     = prs[0]?.unit ?? 'kg'
  const recent   = [...prs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15)

  // ── Estimated 1RM per session ────────────────────────────
  const e1rmBySess: Record<string, number> = {}
  sets.forEach(s => {
    if (!s.reps || s.reps < 1 || s.reps > 12) return
    const est = brzycki(s.weight_kg, s.reps)
    if (est > (e1rmBySess[s.session_id] ?? 0)) e1rmBySess[s.session_id] = est
  })
  const e1rmPoints = Object.entries(e1rmBySess)
    .map(([sid, est]) => ({ est, date: sets.find(s => s.session_id === sid)?.date ?? '' }))
    .filter(p => p.date)
    .sort((a, b) => a.date.localeCompare(b.date))
  const bestE1rm = e1rmPoints.length ? Math.max(...e1rmPoints.map(p => p.est)) : 0

  // ── Trend: compare last 4 sessions vs previous 4 ────────
  const sortedPrs = [...prs].sort((a, b) => a.date.localeCompare(b.date))
  const last4  = sortedPrs.slice(-4).map(p => p.value)
  const prev4  = sortedPrs.slice(-8, -4).map(p => p.value)
  const avgLast = last4.length  ? last4.reduce((a, b) => a + b, 0) / last4.length  : 0
  const avgPrev = prev4.length  ? prev4.reduce((a, b) => a + b, 0) / prev4.length  : 0
  const trendPct = avgPrev > 0 ? ((avgLast - avgPrev) / avgPrev) * 100 : null
  const trendDir = trendPct === null ? null : trendPct > 2 ? 'up' : trendPct < -2 ? 'down' : 'stable'

  // ── Stagnation: last 3+ sessions same weight ─────────────
  const lastWeights = sortedPrs.slice(-4).map(p => p.value)
  const lastThree   = lastWeights.slice(-3)
  const isStagnant  = lastThree.length >= 3 && lastThree.every(w => w === lastThree[0])

  // ── Month-over-month ─────────────────────────────────────
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`
  })()
  const thisMonthBest = Math.max(0, ...prs.filter(p => p.date.startsWith(thisMonth)).map(p => p.value))
  const lastMonthBest = Math.max(0, ...prs.filter(p => p.date.startsWith(lastMonth)).map(p => p.value))
  const momPct = lastMonthBest > 0 ? ((thisMonthBest - lastMonthBest) / lastMonthBest) * 100 : null

  // ── Weekly volume (tonnage) ──────────────────────────────
  const volMap: Record<string, number> = {}
  sets.forEach(s => {
    if (!s.reps) return
    const wk = startOfWeek(s.date)
    volMap[wk] = (volMap[wk] ?? 0) + s.weight_kg * s.reps
  })
  const weekVols: WeekVol[] = Object.entries(volMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, tonnage]) => ({ week, tonnage }))
  const maxVol = weekVols.length ? Math.max(...weekVols.map(w => w.tonnage)) : 0

  // ── Chart: PR history ─────────────────────────────────────
  const chartData = sortedPrs.slice(-12)
  const minV  = chartData.length ? Math.min(...chartData.map(p => p.value)) * 0.92 : 0
  const maxV  = chartData.length ? Math.max(...chartData.map(p => p.value)) * 1.05 : 100
  const W = 300, H = 80
  const toXY = (i: number, v: number, len: number) => ({
    x: len > 1 ? (i / (len - 1)) * W : W / 2,
    y: H - ((v - minV) / (maxV - minV || 1)) * H,
  })
  const pts = chartData.map((p, i) => { const {x,y} = toXY(i, p.value, chartData.length); return `${x},${y}` }).join(' ')
  const area = chartData.length > 1 ? `0,${H} ${pts} ${W},${H}` : ''

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4">

        {/* Header */}
        <div className="pt-6 pb-4 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">←</button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900 truncate">{name}</h1>
            <p className="text-sm text-gray-400">{prs.length} performance{prs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* PR actuel */}
        <div className="bg-orange-500 rounded-2xl p-5 mb-4 flex items-center justify-between">
          <div>
            <p className="text-orange-200 text-xs font-bold uppercase tracking-wide mb-1">Record personnel</p>
            <p className="text-4xl font-black text-white">{best} <span className="text-2xl font-semibold text-orange-200">{unit}</span></p>
            {prs.length > 0 && (
              <p className="text-orange-200 text-xs mt-1">{formatDateLong(sortedPrs[sortedPrs.length - 1]?.date ?? '')}</p>
            )}
          </div>
          <span className="text-5xl">🏆</span>
        </div>

        {/* ── Analytics strip ────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-4">

          {/* Trend */}
          <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tendance</p>
            {trendDir === 'up' && (
              <>
                <p className="text-xl font-black text-green-500">↑</p>
                <p className="text-xs font-bold text-green-600">+{trendPct!.toFixed(1)}%</p>
              </>
            )}
            {trendDir === 'down' && (
              <>
                <p className="text-xl font-black text-red-500">↓</p>
                <p className="text-xs font-bold text-red-600">{trendPct!.toFixed(1)}%</p>
              </>
            )}
            {trendDir === 'stable' && (
              <>
                <p className="text-xl font-black text-blue-400">→</p>
                <p className="text-xs font-bold text-blue-500">Stable</p>
              </>
            )}
            {trendDir === null && (
              <p className="text-xs text-gray-300 mt-2">—</p>
            )}
          </div>

          {/* Estimated 1RM */}
          <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">1RM estimé</p>
            {bestE1rm > 0 ? (
              <>
                <p className="text-xl font-black text-purple-600">{bestE1rm}</p>
                <p className="text-xs text-purple-400 font-semibold">kg Brzycki</p>
              </>
            ) : (
              <p className="text-xs text-gray-300 mt-2">—</p>
            )}
          </div>

          {/* Mois/Mois */}
          <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">M / M</p>
            {momPct !== null ? (
              <>
                <p className={`text-xl font-black ${momPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {momPct >= 0 ? '↑' : '↓'}
                </p>
                <p className={`text-xs font-bold ${momPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {momPct >= 0 ? '+' : ''}{momPct.toFixed(1)}%
                </p>
              </>
            ) : thisMonthBest > 0 ? (
              <>
                <p className="text-xl font-black text-gray-400">—</p>
                <p className="text-xs text-gray-400 font-semibold">{thisMonthBest} {unit}</p>
              </>
            ) : (
              <p className="text-xs text-gray-300 mt-2">—</p>
            )}
          </div>
        </div>

        {/* Stagnation alert */}
        {isStagnant && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Stagnation détectée</p>
              <p className="text-xs text-amber-600 mt-0.5">Même charge sur 3 séances. Try: séance deload, varier les reps, ou tenter un nouveau max.</p>
            </div>
          </div>
        )}

        {/* PR chart */}
        {chartData.length >= 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
              Progression — {chartData.length} séances
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
              {area && <polygon points={area} fill="#F97316" fillOpacity="0.1" />}
              <polyline points={pts} fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {chartData.map((p, i) => {
                const { x, y } = toXY(i, p.value, chartData.length)
                const isMax = p.value === best
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={isMax ? 5 : 3} fill={isMax ? '#F97316' : '#FDBA74'} stroke="white" strokeWidth="1.5" />
                    {isMax && (
                      <text x={x} y={y - 9} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#F97316">{p.value}</text>
                    )}
                  </g>
                )
              })}
            </svg>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>{formatDate(chartData[0].date)}</span>
              <span>{formatDate(chartData[chartData.length - 1].date)}</span>
            </div>
          </div>
        )}

        {/* Estimated 1RM timeline */}
        {e1rmPoints.length >= 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">1RM estimé (Brzycki)</p>
              <span className="text-xs text-purple-500 font-bold">{bestE1rm} kg max</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
              {(() => {
                const minE = Math.min(...e1rmPoints.map(p => p.est)) * 0.92
                const maxE = Math.max(...e1rmPoints.map(p => p.est)) * 1.05
                const ePts = e1rmPoints.map((p, i) => {
                  const x = e1rmPoints.length > 1 ? (i / (e1rmPoints.length - 1)) * W : W / 2
                  const y = H - ((p.est - minE) / (maxE - minE || 1)) * H
                  return { x, y, est: p.est }
                })
                const ptStr = ePts.map(p => `${p.x},${p.y}`).join(' ')
                const areaStr = `0,${H} ${ptStr} ${W},${H}`
                return (
                  <>
                    <polygon points={areaStr} fill="#A855F7" fillOpacity="0.1" />
                    <polyline points={ptStr} fill="none" stroke="#A855F7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {ePts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r={p.est === bestE1rm ? 5 : 3} fill={p.est === bestE1rm ? '#A855F7' : '#D8B4FE'} stroke="white" strokeWidth="1.5" />
                        {p.est === bestE1rm && (
                          <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#A855F7">{p.est}</text>
                        )}
                      </g>
                    ))}
                  </>
                )
              })()}
            </svg>
            <p className="text-[10px] text-gray-400 mt-2 text-center">Calculé à partir de tes séries multi-reps (≤ 12 reps)</p>
          </div>
        )}

        {/* Volume hebdo */}
        {weekVols.length >= 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Volume hebdo (tonnage kg)</p>
            <div className="flex items-end gap-1" style={{ height: 60 }}>
              {weekVols.map((wv, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(8, (wv.tonnage / (maxVol || 1)) * 52)}px`,
                      background: i === weekVols.length - 1 ? 'var(--theme-primary, #F97316)' : '#FED7AA',
                    }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-1.5">
              <span>{formatDate(weekVols[0].week)}</span>
              <span>{formatDate(weekVols[weekVols.length - 1].week)}</span>
            </div>
          </div>
        )}

        {/* Historique */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Historique</p>
          <div className="space-y-2">
            {recent.map(p => {
              const isPR = p.value === best
              const sessDate = sets.filter(s => s.session_id === p.session_id)
              const bestSet = sessDate.length
                ? sessDate.reduce((max, s) => s.weight_kg > max.weight_kg ? s : max, sessDate[0])
                : null
              const e1rm = bestSet?.reps && bestSet.reps <= 12 ? brzycki(bestSet.weight_kg, bestSet.reps) : null
              return (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${isPR ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    {isPR && <span className="text-base">🏆</span>}
                    <div>
                      <p className="text-sm font-bold text-gray-800">{formatDateLong(p.date)}</p>
                      <div className="flex items-center gap-2">
                        {p.session_id && (
                          <a href={`/sessions/${p.session_id}`} className="text-xs text-orange-500 hover:underline">Voir →</a>
                        )}
                        {e1rm && e1rm !== p.value && (
                          <span className="text-xs text-purple-400">1RM ~{e1rm}kg</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className={`text-lg font-black ${isPR ? 'text-orange-600' : 'text-gray-800'}`}>
                    {p.value} <span className="text-sm font-normal text-gray-400">{p.unit}</span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>
        <div className="h-4" />

      </div>
    </div>
  )
}
