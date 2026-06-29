// Single source of truth for the 1–5 energy scale (ST-73). Used for both input
// (log) and display (séance détail) so saisie and lecture always match.
// ST-74 will refine the emojis here — one place to change.
export const ENERGY_LEVELS = [
  { v: 1, emoji: '😴', label: 'Épuisé' },
  { v: 2, emoji: '😕', label: 'Fatigué' },
  { v: 3, emoji: '😐', label: 'Neutre' },
  { v: 4, emoji: '😊', label: 'Bien' },
  { v: 5, emoji: '⚡', label: 'Au top' },
] as const

export type EnergyLevel = (typeof ENERGY_LEVELS)[number]

/** The scale entry for a stored value, or null. */
export const energyOf = (v: number | null | undefined): EnergyLevel | null =>
  ENERGY_LEVELS.find(e => e.v === v) ?? null
