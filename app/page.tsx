'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getRecentSessions, getProfile, deleteDemoData } from '@/lib/api'
import type { SessionSummary, UserProfile } from '@/lib/api'
import { useAppContext } from '@/components/AppContext'
import CoachDashboard from '@/components/CoachDashboard'
import MemberBoxCard from '@/components/MemberBoxCard'
import ProgrammingCard from '@/components/ProgrammingCard'
import ApprovalBanner from '@/components/ApprovalBanner'

// ── Helpers ───────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function getWeekStart(offsetWeeks = 0): Date {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - offsetWeeks * 7)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function getMonthRange(offsetMonths = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1)
  const end   = new Date(now.getFullYear(), now.getMonth() - offsetMonths + 1, 0)
  return { start, end }
}

function sessionsBetween(sessions: SessionSummary[], start: Date, end: Date) {
  return sessions.filter(s => {
    const d = new Date(s.date + 'T00:00:00')
    return d >= start && d <= end
  })
}

function avgRpe(sessions: SessionSummary[]) {
  const rpes = sessions.map(s => s.rpe).filter((r): r is number => r !== null)
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null
}



const DAY_LABELS = ['L','M','M','J','V','S','D']
const MONTHS_FR  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
type Period = '7j' | '30j' | '3m' | 'tout'

function calCells(y: number, m: number): (number | null)[] {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const n = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= n; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
}
function p2(n: number) { return String(n).padStart(2, '0') }
function mkDs(y: number, m: number, d: number) { return `${y}-${p2(m + 1)}-${p2(d)}` }

// ── Composants ─────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

// ── Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const [sessions, setSessions]       = useState<SessionSummary[]>([])
  const [profile, setProfile]         = useState<UserProfile | null>(null)
  const [loading, setLoading]         = useState(true)
  const [deletingDemo, setDeletingDemo] = useState(false)
  const [period, setPeriod]           = useState<Period>('30j')
  const [dashCalY, setDashCalY] = useState(new Date().getFullYear())
  const [dashCalM, setDashCalM] = useState(new Date().getMonth())
  const { active, memberships, loading: ctxLoading } = useAppContext()

  const load = useCallback(async () => {
    let p = await getProfile()
    // Retry once: a profile can come back null in the brief window before the
    // auth token is wired to requests. Avoids getting stuck on the skeleton.
    if (!p) { await new Promise(r => setTimeout(r, 250)); p = await getProfile() }
    if (!p) return  // genuinely no profile — UserInit redirects to /welcome
    setProfile(p)
    const s = await getRecentSessions(200)
    setSessions(s); setLoading(false)
  }, [])

  const handleDeleteDemo = async () => {
    setDeletingDemo(true)
    await deleteDemoData()
    setSessions(s => s.filter(x => !x.is_demo))
    setDeletingDemo(false)
  }

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (profile?.theme_color)
      document.documentElement.style.setProperty('--theme-primary', profile.theme_color)
  }, [profile?.theme_color])

  // ── Données semaine courante ──────────────────────────────
  const weekStart   = getWeekStart(0)
  const weekEnd     = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekDays    = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d })
  const weekDayStrs = weekDays.map(toDateStr)
  const weekSessions = sessionsBetween(sessions, weekStart, weekEnd)
  const weekCount    = weekSessions.length
  const weekTarget   = profile?.weekly_target ?? 0
  const weekAvgRpe   = avgRpe(weekSessions)

  const sessionsByDay: Record<string, SessionSummary[]> = {}
  weekDayStrs.forEach(d => { sessionsByDay[d] = weekSessions.filter(s => s.date === d) })

  // ── Comparaison mois ──────────────────────────────────────
  const thisMo   = getMonthRange(0)
  const lastMo   = getMonthRange(1)
  const thisMoS  = sessionsBetween(sessions, thisMo.start, thisMo.end)
  const lastMoS  = sessionsBetween(sessions, lastMo.start, lastMo.end)
  const deltaCount = thisMoS.length - lastMoS.length
  const thisRpe  = avgRpe(thisMoS)
  const lastRpe  = avgRpe(lastMoS)
  const deltaRpe = thisRpe !== null && lastRpe !== null ? (thisRpe - lastRpe) : null

  // ── Distribution par période ──────────────────────────────
  const now = new Date()
  const periodStart: Record<Period, Date> = {
    '7j':   new Date(now.getTime() - 7  * 86400000),
    '30j':  new Date(now.getTime() - 30 * 86400000),
    '3m':   new Date(now.getTime() - 90 * 86400000),
    'tout': new Date('2000-01-01'),
  }
  const periodSessions = sessions.filter(s => new Date(s.date + 'T00:00:00') >= periodStart[period])
  const typeCounts: Record<string, { count: number; color: string; emoji: string }> = {}
  periodSessions.forEach(s => {
    if (!typeCounts[s.session_type]) typeCounts[s.session_type] = { count: 0, color: s.type_color, emoji: s.type_emoji }
    typeCounts[s.session_type].count++
  })
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1].count - a[1].count)

  // ── Calendrier navigable ─────────────────────────────────
  const calCellArr  = calCells(dashCalY, dashCalM)
  const calNow      = new Date()
  const calToday    = mkDs(calNow.getFullYear(), calNow.getMonth(), calNow.getDate())
  const isCalNow    = dashCalY === calNow.getFullYear() && dashCalM === calNow.getMonth()
  const calByDate: Record<string, SessionSummary[]> = {}
  sessions
    .filter(s => { const d = new Date(s.date + 'T00:00:00'); return d.getFullYear() === dashCalY && d.getMonth() === dashCalM })
    .forEach(s => { if (!calByDate[s.date]) calByDate[s.date] = []; calByDate[s.date].push(s) })
  const prevDashCal = () => { if (dashCalM === 0) { setDashCalY(y => y - 1); setDashCalM(11) } else setDashCalM(m => m - 1) }
  const nextDashCal = () => { if (isCalNow) return; if (dashCalM === 11) { setDashCalY(y => y + 1); setDashCalM(0) } else setDashCalM(m => m + 1) }

  const today  = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Wait for the active context before choosing a view — avoids flashing the
  // athlete dashboard before the box/coach view resolves on reload.
  if (ctxLoading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '80dvh' }}>
      <div className="w-8 h-8 rounded-full border-4 border-orange-400 border-t-transparent animate-spin" />
    </div>
  )

  // Role-aware: in a box as owner/coach/staff → coaching view. Members and
  // solo athletes get the athlete dashboard below.
  if (active.type === 'org' && active.role !== 'member')
    return <CoachDashboard orgId={active.orgId} orgName={active.orgName} role={active.role} />

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-4">

        {/* Header */}
        <div className="pt-8 pb-4">
          {loading
            ? <Skeleton className="h-7 w-40 mb-1.5" />
            : <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">Bonjour {profile?.first_name} 👋</h1>}
          <p className="text-sm text-[var(--muted)] mt-0.5">{capitalize(today)}</p>
        </div>

        {/* Box just approved the join request (ST-80) */}
        <ApprovalBanner />

        {/* Quick actions: Réserver (primary) + Séance (secondary), same line */}
        {(() => {
          const hasBox = active.type === 'org' || memberships.some(m => m.status === 'active')
          return (
            <div className="flex gap-2 mb-4">
              {hasBox && (
                <Link href="/box/book"
                  className="flex-1 text-center text-white text-sm font-black py-3.5 rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}>
                  Réserver un cours
                </Link>
              )}
              <Link href="/log"
                className={`${hasBox ? 'flex-1' : 'flex-1'} text-center py-3.5 rounded-2xl text-sm font-black ${hasBox ? '' : 'text-white'}`}
                style={hasBox
                  ? { background: 'var(--secondary-bg)', color: 'var(--secondary-fg)' }
                  : { background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}>
                Enregistrer une séance
              </Link>
            </div>
          )
        })()}


        {/* Réservations de cours — dans le contexte d'une box, ou dans l'espace
            athlète pour chaque box dont on est membre (owner/coach/membre). */}
        {active.type === 'org'
          ? <><ProgrammingCard orgId={active.orgId} orgName={active.orgName} /><MemberBoxCard orgId={active.orgId} orgName={active.orgName} /></>
          : memberships.filter(m => m.status === 'active').map(m => (
              <div key={m.organizationId}>
                <ProgrammingCard orgId={m.organizationId} orgName={m.organizationName} />
                <MemberBoxCard orgId={m.organizationId} orgName={m.organizationName} />
              </div>
            ))}

        {/* Bannière données démo */}
        {!loading && sessions.some(s => s.is_demo) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800">Données de démo</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {sessions.filter(s => s.is_demo).length} séances fictives dans ton historique
              </p>
            </div>
            <button onClick={handleDeleteDemo} disabled={deletingDemo}
              className="text-xs font-bold text-white bg-amber-500 rounded-xl px-3 py-2 whitespace-nowrap flex-shrink-0 disabled:opacity-50 transition">
              {deletingDemo ? '...' : 'Supprimer'}
            </button>
          </div>
        )}

        {/* Semaine courante */}
        {loading ? <Skeleton className="h-44 mb-4" /> : (
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-5 mb-4">
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-3">Cette semaine</p>
            <div className="flex gap-1 mb-4">
              {weekDays.map((d, i) => {
                const str = toDateStr(d)
                const daySessions = sessionsByDay[str] ?? []
                const isToday = str === toDateStr(new Date())
                return (
                  <div key={str} className="flex-1 flex flex-col items-center gap-1">
                    <span className={`text-xs font-semibold ${isToday ? 'text-orange-500' : 'text-[var(--muted)]'}`}>
                      {DAY_LABELS[i]}
                    </span>
                    {daySessions.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {daySessions.slice(0, 2).map((s, idx) => (
                          <div key={idx} className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                            style={{ background: s.type_color + '20', border: `1.5px solid ${s.type_color}` }}>
                            {s.type_emoji}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`w-8 h-8 rounded-lg border-2 border-dashed ${isToday ? 'border-orange-300' : 'border-[color:var(--border)]'}`} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <div className="flex-1 bg-[var(--bg)] rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-[var(--ink)]">
                  {weekCount}{weekTarget > 0 && <span className="text-base text-[var(--muted)] font-semibold">/{weekTarget}</span>}
                </p>
                <p className="text-xs text-[var(--muted)] mt-0.5">séances</p>
                {weekTarget > 0 ? (
                  <div className="mt-1.5 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (weekCount / weekTarget) * 100)}%`, background: 'var(--theme-primary, #F97316)' }} />
                  </div>
                ) : (
                  <Link href="/profile" className="block mt-1.5 text-[11px] font-bold text-[var(--accent-text)]">
                    🎯 Définis ton objectif →
                  </Link>
                )}
              </div>
              <div className="flex-1 bg-[var(--bg)] rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-[var(--ink)]">
                  {weekAvgRpe !== null ? `${weekAvgRpe.toFixed(1)}/10` : '—'}
                </p>
                <p className="text-xs text-[var(--muted)] mt-0.5">RPE moyen</p>
              </div>
            </div>
          </div>
        )}

        {/* Calendrier navigable */}
        {!loading && (
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevDashCal} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--hover)] text-[var(--sub)] text-lg leading-none">‹</button>
              <p className="text-xs font-bold text-[var(--ink-soft)]">{MONTHS_FR[dashCalM]} {dashCalY}</p>
              <button onClick={nextDashCal} disabled={isCalNow}
                className={`w-7 h-7 flex items-center justify-center rounded-full text-lg leading-none transition ${isCalNow ? 'text-[var(--border)]' : 'hover:bg-[var(--hover)] text-[var(--sub)]'}`}>›</button>
            </div>
            {/* Jours de la semaine */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d, i) => (
                <p key={i} className="text-center text-[10px] font-semibold text-[var(--muted)]">{d}</p>
              ))}
            </div>
            {/* Grille */}
            <div className="grid grid-cols-7 gap-0.5">
              {calCellArr.map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr = mkDs(dashCalY, dashCalM, day)
                const items   = calByDate[dateStr] ?? []
                const first   = items[0]
                const isToday = dateStr === calToday
                return (
                  <Link key={i} href={items.length > 0 ? `/sessions/${items[0].id}` : '#'}
                    className={`flex flex-col items-center justify-center rounded-lg transition ${
                      items.length > 0 ? 'hover:opacity-75' : 'pointer-events-none'
                    }`}
                    style={{
                      minHeight: 40,
                      background: first ? first.type_color + '22' : undefined,
                      outline: isToday ? '2px solid var(--theme-primary, #F97316)' : undefined,
                    }}>
                    <span className={`text-[10px] font-bold leading-none mb-0.5 ${
                      isToday ? 'text-orange-500' : items.length > 0 ? 'text-[var(--ink-soft)]' : 'text-[var(--border-strong)]'
                    }`}>
                      {day}
                    </span>
                    {first && <span className="text-xs leading-none">{first.type_emoji}</span>}
                    {items.length > 1 && <span className="text-[8px] font-bold text-[var(--muted)]">+{items.length - 1}</span>}
                  </Link>
                )
              })}
            </div>
            {/* Résumé */}
            <div className="mt-2 pt-2 border-t border-[color:var(--track)] flex items-center justify-between">
              <p className="text-xs text-[var(--muted)]">
                <span className="font-bold text-[var(--ink-soft)]">{Object.values(calByDate).flat().length}</span> séance{Object.values(calByDate).flat().length !== 1 ? 's' : ''}
              </p>
              <Link href="/sessions" className="text-xs font-semibold text-orange-500">Voir tout →</Link>
            </div>
          </div>
        )}

        {/* Comparaison mois */}
        {!loading && (thisMoS.length > 0 || lastMoS.length > 0) && (
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-5 mb-4">
            <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-3">Mois en cours vs précédent</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: capitalize(thisMo.start.toLocaleDateString('fr-FR', { month: 'long' })),
                  count: thisMoS.length,
                  rpe:   thisRpe,
                  main:  true
                },
                {
                  label: capitalize(lastMo.start.toLocaleDateString('fr-FR', { month: 'long' })),
                  count: lastMoS.length,
                  rpe:   lastRpe,
                  main:  false
                },
              ].map(m => (
                <div key={m.label} className={`rounded-xl p-3 ${m.main ? 'bg-[var(--accent-soft)] border border-[color:var(--accent-soft)]' : 'bg-[var(--bg)] border border-[color:var(--track)]'}`}>
                  <p className={`text-xs font-bold mb-2 ${m.main ? 'text-[var(--accent-text)]' : 'text-[var(--muted)]'}`}>{m.label}</p>
                  <p className={`text-2xl font-black ${m.main ? 'text-[var(--accent-text)]' : 'text-[var(--ink-soft)]'}`}>{m.count}</p>
                  <p className="text-xs text-[var(--muted)]">séances</p>
                  {m.rpe !== null && (
                    <p className="text-xs text-[var(--sub)] mt-1">RPE {m.rpe.toFixed(1)}/10</p>
                  )}
                </div>
              ))}
            </div>
            {(deltaCount !== 0 || deltaRpe !== null) && (
              <div className="mt-3 flex gap-4">
                {deltaCount !== 0 && (
                  <div className={`flex items-center gap-1 text-xs font-semibold ${deltaCount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    <span>{deltaCount > 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(deltaCount)} séance{Math.abs(deltaCount) > 1 ? 's' : ''}</span>
                  </div>
                )}
                {deltaRpe !== null && Math.abs(deltaRpe) > 0.2 && (
                  <div className={`flex items-center gap-1 text-xs font-semibold ${deltaRpe < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    <span>{deltaRpe < 0 ? '↓' : '↑'}</span>
                    <span>RPE {deltaRpe > 0 ? '+' : ''}{deltaRpe.toFixed(1)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

<Link href="/prs"
  className="flex items-center justify-between bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 mb-4 hover:shadow-sm transition">
  <div className="flex items-center gap-3">
    <span className="text-2xl">🏆</span>
    <div>
      <p className="text-sm font-bold text-[var(--ink)]">Personal Records</p>
      <p className="text-xs text-[var(--muted)]">Tes charges maximales par mouvement</p>
    </div>
  </div>
  <span className="text-[var(--border-strong)]">›</span>
</Link>


        {/* Distribution par période */}
        {!loading && sessions.length > 0 && (
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider">Répartition</p>
              <div className="flex gap-1">
                {(['7j','30j','3m','tout'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      period === p
                        ? 'text-white'
                        : 'text-[var(--muted)] bg-[var(--bg)]'
                    }`}
                    style={period === p ? { background: 'var(--theme-primary, #F97316)' } : {}}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {sortedTypes.length === 0 ? (
              <p className="text-xs text-[var(--muted)] text-center py-4">Aucune séance sur cette période</p>
            ) : (
              <div className="space-y-2.5">
                {sortedTypes.map(([type, { count, color, emoji }]) => {
                  const pct = Math.round((count / periodSessions.length) * 100)
                  return (
                    <div key={type} className="flex items-center gap-2.5">
                      <span className="text-base w-5 flex-shrink-0">{emoji}</span>
                      <div className="flex-1 bg-[var(--track)] rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs text-[var(--sub)] whitespace-nowrap text-right w-24">
                        {type} · {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
