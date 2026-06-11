import { supabase } from './supabase'

// ============================================================
// TYPES — calqués sur le schéma SQL
// ============================================================

export type SessionType = {
  id:       string
  name:     string
  color:    string
  emoji:    string
  category: string
}

export type Movement = {
  id:          string
  name:        string
  category:    string
  subcategory?: string
  equipment?:  string[]
}

export type SetInput = {
  reps?:     number
  weight_kg?: number
  tempo?:    string
  is_pr?:    boolean
  notes?:    string
}

export type BlockInput = {
  movement_id:    string   // obligatoire (option A)
  movement_label: string   // dénormalisé pour l'affichage
  block_type?:    'strength' | 'skill' | 'technique' | 'accessory' | 'warmup' | 'cooldown'
  sets:           SetInput[]
  notes?:         string
}

export type WodInput = {
  format_label?:   string
  description?:    string
  result_detail?:  string
  is_rx:           boolean
  time_cap_min?:   number
}

export type SessionInput = {
  date:              string        // 'YYYY-MM-DD'
  session_type_id:   string
  duration_min?:     number
  sleep_hours?:      number
  sleep_quality?:    number        // 1-5
  energy_level?:     number        // 1-5
  rpe?:              number        // 1-10
  feeling_post?:     number        // 1-5
  notes?:            string
  blocks?:           BlockInput[]
  wod?:              WodInput
  pain_labels?:      string[]      // ex: ['Épaule D', 'Poignet G']
}

// ============================================================
// RÉFÉRENTIELS
// ============================================================

// Appelé une fois au chargement du formulaire
export async function getSessionTypes(): Promise<SessionType[]> {
  const { data, error } = await supabase
    .from('session_types')
    .select('id, name, color, emoji, category')
    .order('name')

  if (error) throw new Error(`getSessionTypes: ${error.message}`)
  return data ?? []
}

// Autocomplete mouvements — appelé à chaque frappe (debounce côté composant)
export async function searchMovements(query: string): Promise<Movement[]> {
  if (query.trim().length < 2) return []

  const { data, error } = await supabase
    .from('movements')
    .select('id, name, category, subcategory, equipment')
    .ilike('name', `%${query}%`)   // recherche insensible à la casse
    .order('name')
    .limit(8)

  if (error) throw new Error(`searchMovements: ${error.message}`)
  return data ?? []
}

// ============================================================
// SAUVEGARDE D'UNE SESSION COMPLÈTE
// Ordre obligatoire : session → blocks → sets → wod → pain
// car chaque entité dépend de l'id de la précédente
// ============================================================

export async function saveSession(input: SessionInput): Promise<string> {

  // ── 1. Session principale ──────────────────────────────────
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      date:              input.date,
      session_type_id:   input.session_type_id,
      duration_min:      input.duration_min    ?? null,
      sleep_hours:       input.sleep_hours     ?? null,
      sleep_quality:     input.sleep_quality   ?? null,
      energy_level:      input.energy_level    ?? null,
      rpe:               input.rpe             ?? null,
      feeling_post:      input.feeling_post    ?? null,
      notes:             input.notes           ?? null,
    })
    .select('id')
    .single()

  if (sessionError) throw new Error(`saveSession: ${sessionError.message}`)
  const sessionId = session.id

  // ── 2. Blocs de force + séries ────────────────────────────
  const validBlocks = (input.blocks ?? []).filter(b => b.movement_id)

  for (let i = 0; i < validBlocks.length; i++) {
    const block = validBlocks[i]

    const { data: blockRow, error: blockError } = await supabase
      .from('session_blocks')
      .insert({
        session_id:  sessionId,
        block_order: i + 1,
        title:       block.movement_label,
        block_type:  block.block_type ?? 'strength',
        notes:       block.notes ?? null,
      })
      .select('id')
      .single()

    if (blockError) throw new Error(`saveBlock[${i}]: ${blockError.message}`)

    const setsToInsert = block.sets
      .filter(s => s.reps || s.weight_kg)       // ignorer les lignes vides
      .map((s, si) => ({
        block_id:       blockRow.id,
        movement_id:    block.movement_id,
        movement_label: block.movement_label,
        set_number:     si + 1,
        reps:           s.reps      ?? null,
        weight_kg:      s.weight_kg ?? null,
        tempo:          s.tempo     ?? null,
        is_pr:          s.is_pr     ?? false,
        notes:          s.notes     ?? null,
      }))

    if (setsToInsert.length > 0) {
      const { error: setsError } = await supabase
        .from('block_sets')
        .insert(setsToInsert)
      if (setsError) throw new Error(`saveSets[${i}]: ${setsError.message}`)
    }
  }

  // ── 3. WOD ────────────────────────────────────────────────
  if (input.wod?.format_label) {
    // Résoudre le format_id depuis le nom (peut être null si format custom)
    const { data: fmt } = await supabase
      .from('wod_formats')
      .select('id')
      .eq('name', input.wod.format_label)
      .maybeSingle()

    const { error: wodError } = await supabase
      .from('wods')
      .insert({
        session_id:    sessionId,
        format_id:     fmt?.id       ?? null,
        format_label:  input.wod.format_label,
        description:   input.wod.description   ?? null,
        result_detail: input.wod.result_detail ?? null,
        is_rx:         input.wod.is_rx,
        time_cap_min:  input.wod.time_cap_min  ?? null,
      })

    if (wodError) throw new Error(`saveWod: ${wodError.message}`)
  }

  // ── 4. Alertes douleur ────────────────────────────────────
  if ((input.pain_labels ?? []).length > 0) {
    const { error: painError } = await supabase
      .from('session_pain_alerts')
      .insert(
        input.pain_labels!.map(label => ({
          session_id:      sessionId,
          body_part_label: label,
          severity:        1,   // défaut "légère" — à rendre configurable plus tard
        }))
      )
    if (painError) throw new Error(`savePain: ${painError.message}`)
  }

  return sessionId
}

// ============================================================
// LECTURE — pour le futur dashboard
// ============================================================

// Liste des séances récentes (via la vue SQL qu'on a créée)
export async function getRecentSessions(limit = 30) {
  const { data, error } = await supabase
    .from('v_sessions_summary')
    .select('*')
    .limit(limit)

  if (error) throw new Error(`getRecentSessions: ${error.message}`)
  return data ?? []
}

// Progression sur un mouvement précis
export async function getMovementProgression(movementId: string) {
  const { data, error } = await supabase
    .from('v_movement_progression')
    .select('date, reps, weight_kg, is_pr, tempo')
    .eq('movement_id', movementId)
    .order('date', { ascending: true })

  if (error) throw new Error(`getMovementProgression: ${error.message}`)
  return data ?? []
}

// Bilan hebdomadaire
export async function getWeeklyVolume(weeks = 12) {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const { data, error } = await supabase
    .from('v_weekly_volume')
    .select('week, sessions_count, avg_rpe, avg_sleep, avg_energy, total_minutes')
    .gte('week', since.toISOString().split('T')[0])
    .order('week', { ascending: true })

  if (error) throw new Error(`getWeeklyVolume: ${error.message}`)
  return data ?? []
}

// Timeline des douleurs (pour détecter les patterns de blessures)
export async function getPainTimeline() {
  const { data, error } = await supabase
    .from('v_pain_timeline')
    .select('date, body_part_label, severity, type, session_type, rpe')
    .order('date', { ascending: false })
    .limit(50)

  if (error) throw new Error(`getPainTimeline: ${error.message}`)
  return data ?? []
}
