import { supabase } from './supabase'
import { requireUserId } from './auth'
import type { Json } from './database.types'

// Structured training profile for AI recommendations (ST-41). Lives under
// user_profile.training_profile (jsonb). Edited from Progression (ST: moved out
// of the account profile).
export type TrainingProfile = {
  injuries: string
  available_days: string[]
  preferred_times: string
  equipment: string[]
  goal_detail: string
  experience: Record<string, string>
}
export const EMPTY_TP: TrainingProfile = { injuries: '', available_days: [], preferred_times: '', equipment: [], goal_detail: '', experience: {} }

export const TP_DAYS = [['mon', 'Lun'], ['tue', 'Mar'], ['wed', 'Mer'], ['thu', 'Jeu'], ['fri', 'Ven'], ['sat', 'Sam'], ['sun', 'Dim']] as const
export const TP_TIMES = [{ value: 'matin', label: 'Matin' }, { value: 'midi', label: 'Midi' }, { value: 'soir', label: 'Soir' }, { value: 'flexible', label: 'Peu importe' }]
export const TP_EQUIPMENT = ['Barre', 'Haltères', 'Kettlebell', 'Anneaux', 'Rameur', 'Assault bike', 'Corde à sauter', 'Box', 'Wall ball', 'Élastiques']
export const TP_MOVEMENTS = [['snatch', 'Arraché'], ['clean_jerk', 'Épaulé-jeté'], ['muscle_up', 'Muscle-up'], ['hspu', 'HSPU'], ['double_unders', 'Double-unders'], ['pull_up', 'Tractions']] as const
export const TP_XP_LEVELS = [{ value: 'none', label: 'Non acquis' }, { value: 'beginner', label: 'Débutant' }, { value: 'intermediate', label: 'Intermédiaire' }, { value: 'advanced', label: 'Avancé' }]

export async function getTrainingProfile(): Promise<TrainingProfile> {
  const uid = await requireUserId()
  const { data, error } = await supabase.from('user_profile').select('training_profile').eq('user_id', uid).maybeSingle()
  if (error) throw new Error(`getTrainingProfile: ${error.message}`)
  return { ...EMPTY_TP, ...((data?.training_profile as Partial<TrainingProfile> | null) ?? {}) }
}

export async function saveTrainingProfile(tp: TrainingProfile): Promise<void> {
  const uid = await requireUserId()
  const { error } = await supabase.from('user_profile')
    .update({ training_profile: tp as unknown as Json, updated_at: new Date().toISOString() })
    .eq('user_id', uid)
  if (error) throw new Error(`saveTrainingProfile: ${error.message}`)
}
