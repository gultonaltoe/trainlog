// ST-108 (CA-07) Streaks & badges — computed client-side from logged sessions.
// A "streak" is consecutive WEEKS with ≥1 session (CrossFit athletes rarely
// train daily, so weekly is the meaningful unit). A one-week grace keeps the
// streak alive at the very start of a new week.

const WEEK = 7 * 86400000

function mondayTs(iso: string): number {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function weekStreaks(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 }
  const weeks = new Set(dates.map(mondayTs))
  const thisMon = mondayTs(new Date().toISOString().slice(0, 10))

  // Current: consecutive weeks ending at this week, or last week (grace period).
  let anchor: number | null = weeks.has(thisMon) ? thisMon : weeks.has(thisMon - WEEK) ? thisMon - WEEK : null
  let current = 0
  if (anchor !== null) { let w = anchor; while (weeks.has(w)) { current++; w -= WEEK } }

  // Longest run of consecutive weeks anywhere.
  const sorted = [...weeks].sort((a, b) => a - b)
  let longest = 0, run = 0, prev: number | null = null
  for (const w of sorted) { run = prev !== null && w - prev === WEEK ? run + 1 : 1; longest = Math.max(longest, run); prev = w }

  return { current, longest }
}

export type Badge = { key: string; emoji: string; label: string; earned: boolean; hint: string }

export function computeBadges(opts: {
  total: number; current: number; longest: number; thisWeek: number; weeklyTarget: number; prs: number
}): Badge[] {
  const { total, current, longest, thisWeek, weeklyTarget, prs } = opts
  const streak = Math.max(current, longest)
  return [
    { key: 'first',    emoji: '🎯', label: 'Première séance', earned: total >= 1,   hint: 'Logge ta première séance' },
    { key: 's10',      emoji: '🔟', label: '10 séances',      earned: total >= 10,  hint: `${total}/10 séances` },
    { key: 's50',      emoji: '🏋️', label: '50 séances',      earned: total >= 50,  hint: `${total}/50 séances` },
    { key: 's100',     emoji: '💯', label: '100 séances',     earned: total >= 100, hint: `${total}/100 séances` },
    { key: 'streak4',  emoji: '🔥', label: 'Série de 4 sem.', earned: streak >= 4,  hint: `Meilleure série : ${streak} sem.` },
    { key: 'streak12', emoji: '🏆', label: 'Série de 12 sem.', earned: streak >= 12, hint: `Meilleure série : ${streak} sem.` },
    { key: 'target',   emoji: '✅', label: 'Objectif hebdo',  earned: weeklyTarget > 0 && thisWeek >= weeklyTarget, hint: weeklyTarget > 0 ? `${thisWeek}/${weeklyTarget} cette semaine` : 'Définis un objectif hebdo' },
    { key: 'pr',       emoji: '⚡', label: 'Premier PR',       earned: prs >= 1,     hint: 'Bats un record perso' },
  ]
}
