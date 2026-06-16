import { supabase } from './supabase'
import { getUserId } from './user'

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export async function seedDemoData(sports: string[]) {
  const uid = getUserId()
  const hasCrossfit    = sports.some(s => s === 'crossfit')
  const hasHaltero     = sports.some(s => s === 'haltérophilie')
  const hasRun         = sports.some(s => s === 'run')

  const { data: types } = await supabase.from('session_types').select('id, name')
  if (!types) return

  const typeId = (name: string) => types.find(t => t.name.toLowerCase().includes(name.toLowerCase()))?.id

  const cfId  = typeId('crossfit')  || typeId('cross')
  const htId  = typeId('haltéro')   || typeId('halte')
  const runId = typeId('run')       || typeId('end')

  const sessions: {
    date: string; session_type_id: string; duration_min: number;
    rpe: number; feeling_post: number; sleep_hours: number; energy_level: number; notes: string | null;
    user_id: string
  }[] = []

  if (hasCrossfit && cfId) {
    sessions.push(
      { date: daysAgo(2),  session_type_id: cfId, duration_min: 65, rpe: 8, feeling_post: 4, sleep_hours: 7,   energy_level: 4, notes: 'Fran en 5\'23" 💪 PR personnel !', user_id: uid },
      { date: daysAgo(5),  session_type_id: cfId, duration_min: 70, rpe: 7, feeling_post: 3, sleep_hours: 6.5, energy_level: 3, notes: 'AMRAP 20\' — 21-15-9 DL + BJ + TTB. Score : 3 rounds + 14', user_id: uid },
      { date: daysAgo(9),  session_type_id: cfId, duration_min: 60, rpe: 9, feeling_post: 4, sleep_hours: 8,   energy_level: 5, notes: 'Murph en 42\'15" avec gilet 10kg', user_id: uid },
      { date: daysAgo(13), session_type_id: cfId, duration_min: 55, rpe: 6, feeling_post: 4, sleep_hours: 7.5, energy_level: 4, notes: null, user_id: uid },
      { date: daysAgo(18), session_type_id: cfId, duration_min: 70, rpe: 8, feeling_post: 3, sleep_hours: 6,   energy_level: 3, notes: 'Open 23.2 — 9 rounds + 12', user_id: uid },
      { date: daysAgo(23), session_type_id: cfId, duration_min: 65, rpe: 7, feeling_post: 4, sleep_hours: 7,   energy_level: 4, notes: null, user_id: uid },
    )
  }

  if (hasHaltero && htId) {
    sessions.push(
      { date: daysAgo(3),  session_type_id: htId, duration_min: 75, rpe: 7, feeling_post: 4, sleep_hours: 7.5, energy_level: 4, notes: 'Arraché : 3×3 à 70%. Sensation bonne sur la fixation.', user_id: uid },
      { date: daysAgo(8),  session_type_id: htId, duration_min: 80, rpe: 8, feeling_post: 4, sleep_hours: 7,   energy_level: 4, notes: 'Épaulé-Jeté : 5×2 à 80%. PR approche !', user_id: uid },
      { date: daysAgo(15), session_type_id: htId, duration_min: 70, rpe: 6, feeling_post: 3, sleep_hours: 6.5, energy_level: 3, notes: null, user_id: uid },
      { date: daysAgo(22), session_type_id: htId, duration_min: 75, rpe: 7, feeling_post: 4, sleep_hours: 8,   energy_level: 5, notes: 'Back Squat : 6×2 à 85%. Tempo @30X1.', user_id: uid },
    )
  }

  if (hasRun && runId) {
    sessions.push(
      { date: daysAgo(4),  session_type_id: runId, duration_min: 45, rpe: 6, feeling_post: 5, sleep_hours: 8, energy_level: 5, notes: '7km — allure 5\'12"/km. Belle sortie recovery.', user_id: uid },
      { date: daysAgo(10), session_type_id: runId, duration_min: 35, rpe: 8, feeling_post: 4, sleep_hours: 7, energy_level: 4, notes: 'Fractionné 6×400m / 90" récup. Allure moy : 3\'58"/km.', user_id: uid },
      { date: daysAgo(17), session_type_id: runId, duration_min: 60, rpe: 7, feeling_post: 4, sleep_hours: 7.5, energy_level: 4, notes: '10km en 50\'32". Progression visible !', user_id: uid },
      { date: daysAgo(24), session_type_id: runId, duration_min: 30, rpe: 5, feeling_post: 5, sleep_hours: 8, energy_level: 5, notes: null, user_id: uid },
    )
  }

  // Fallback: at least insert 2 generic sessions if no type matched
  if (sessions.length === 0) {
    const anyType = types[0]?.id
    if (anyType) {
      sessions.push(
        { date: daysAgo(3),  session_type_id: anyType, duration_min: 60, rpe: 7, feeling_post: 4, sleep_hours: 7, energy_level: 4, notes: 'Première séance — bonne énergie !', user_id: uid },
        { date: daysAgo(8),  session_type_id: anyType, duration_min: 55, rpe: 6, feeling_post: 3, sleep_hours: 7, energy_level: 3, notes: null, user_id: uid },
      )
    }
  }

  await supabase.from('sessions').insert(sessions)

  // PRs
  const prs: { movement_name: string; value: number; unit: string; date: string; user_id: string }[] = []

  if (hasCrossfit || hasHaltero) {
    prs.push(
      { movement_name: 'Back Squat',   value: 110, unit: 'kg', date: daysAgo(30), user_id: uid },
      { movement_name: 'Deadlift',     value: 140, unit: 'kg', date: daysAgo(45), user_id: uid },
      { movement_name: 'Strict Press', value: 65,  unit: 'kg', date: daysAgo(20), user_id: uid },
    )
    if (hasHaltero) {
      prs.push(
        { movement_name: 'Squat Snatch', value: 72, unit: 'kg', date: daysAgo(10), user_id: uid },
        { movement_name: 'Clean & Jerk', value: 90, unit: 'kg', date: daysAgo(8),  user_id: uid },
      )
    } else {
      prs.push(
        { movement_name: 'Power Clean', value: 85, unit: 'kg', date: daysAgo(15), user_id: uid },
      )
    }
  }

  if (hasRun) {
    prs.push(
      { movement_name: '5km',  value: 1475, unit: 'sec', date: daysAgo(17), user_id: uid },
      { movement_name: '10km', value: 3032, unit: 'sec', date: daysAgo(17), user_id: uid },
    )
  }

  if (prs.length > 0) {
    await supabase.from('personal_records').insert(prs)
  }
}
