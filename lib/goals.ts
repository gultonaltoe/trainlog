import { supabase } from './supabase'
import { requireUserId } from './auth'

// ST-35 (goals) — minimal per-movement performance goals.
export type Goal = { id: string; movementId: string; movementName: string; target: number; unit: string }

export async function getGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('performance_goals')
    .select('id, movement_id, movement_name, target_value, unit')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`getGoals: ${error.message}`)
  return (data ?? []).map(g => ({
    id: g.id, movementId: g.movement_id, movementName: g.movement_name,
    target: Number(g.target_value), unit: g.unit,
  }))
}

export async function upsertGoal(movementId: string, movementName: string, target: number, unit: string): Promise<void> {
  const uid = await requireUserId()
  const { error } = await supabase.from('performance_goals')
    .upsert({ user_id: uid, movement_id: movementId, movement_name: movementName, target_value: target, unit },
            { onConflict: 'user_id,movement_id,unit' })
  if (error) throw new Error(`upsertGoal: ${error.message}`)
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('performance_goals').delete().eq('id', id)
  if (error) throw new Error(`deleteGoal: ${error.message}`)
}
