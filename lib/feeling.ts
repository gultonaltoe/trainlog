// Single source of truth for the 1–5 post-session feeling scale (mirror of the
// energy scale). Used for input (log) and display (séance détail) so saisie and
// lecture always match — fixes the raw "3" showing in history.
export const FEELING_LEVELS = [
  { v: 1, emoji: '😩', label: 'Mauvais' },
  { v: 2, emoji: '😕', label: 'Passable' },
  { v: 3, emoji: '😐', label: 'Correct' },
  { v: 4, emoji: '😊', label: 'Bien' },
  { v: 5, emoji: '🤩', label: 'Excellent' },
] as const

export type FeelingLevel = (typeof FEELING_LEVELS)[number]

export const feelingOf = (v: number | null | undefined): FeelingLevel | null =>
  FEELING_LEVELS.find(f => f.v === v) ?? null
