// Seed test data to validate Layer 2 analytics flows
// Usage: node scripts/seed-test-data.mjs
// ─────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'

try {
  const env = readFileSync('.env.local', 'utf-8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^=]+)=(.+)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
} catch {
  console.error('❌ .env.local introuvable')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── Helpers ──────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

async function getSessionTypeId(name) {
  const { data } = await supabase.from('session_types').select('id').eq('name', name).limit(1).maybeSingle()
  return data?.id ?? null
}

async function getMovementId(name) {
  const { data } = await supabase.from('movements').select('id').ilike('name', name).limit(1).maybeSingle()
  return data?.id ?? null
}

async function createSession(date, typeId, rpe = 7, duration = 75) {
  const { data, error } = await supabase.from('sessions').insert({
    date, session_type_id: typeId,
    duration_min: duration, rpe, feeling_post: 4,
    sleep_hours: 7.5, energy_level: 3,
  }).select('id').single()
  if (error) throw new Error(`createSession: ${error.message}`)
  return data.id
}

async function createBlock(sessionId, order, movementId, movementLabel) {
  const { data, error } = await supabase.from('session_blocks').insert({
    session_id: sessionId, block_order: order,
    title: movementLabel, block_type: 'strength',
  }).select('id').single()
  if (error) throw new Error(`createBlock: ${error.message}`)
  return data.id
}

async function createSets(blockId, movementId, movementLabel, sets) {
  const rows = sets.map((s, i) => ({
    block_id: blockId, movement_id: movementId,
    movement_label: movementLabel, set_number: i + 1,
    reps: s.reps, weight_kg: s.weight, is_pr: false,
  }))
  const { error } = await supabase.from('block_sets').insert(rows)
  if (error) throw new Error(`createSets: ${error.message}`)
}

async function savePR(movementId, movementLabel, value, date, sessionId) {
  await supabase.from('personal_records').insert({
    movement_id: movementId, movement_name: movementLabel,
    value, unit: 'kg', date, session_id: sessionId,
  })
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding test data...\n')

  const cfTypeId = await getSessionTypeId('CrossFit')
  if (!cfTypeId) { console.error('❌ Session type "CrossFit" not found'); process.exit(1) }

  // Find movements
  const backSquatId  = await getMovementId('Back Squat')
  const cleanId      = await getMovementId('Clean')
  const deadliftId   = await getMovementId('Deadlift')

  if (!backSquatId)  console.warn('⚠️  "Back Squat" not found in movements')
  if (!cleanId)      console.warn('⚠️  "Clean" not found in movements')
  if (!deadliftId)   console.warn('⚠️  "Deadlift" not found in movements')

  // ── Back Squat progression over 12 weeks ─────────────────
  // Shows progressive overload → trend analytics
  const squatData = [
    { daysBack: 84, sets: [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] },
    { daysBack: 77, sets: [{ reps: 5, weight: 82.5 }, { reps: 5, weight: 82.5 }, { reps: 3, weight: 85 }] },
    { daysBack: 70, sets: [{ reps: 5, weight: 85 }, { reps: 5, weight: 85 }, { reps: 4, weight: 87.5 }] },
    { daysBack: 63, sets: [{ reps: 3, weight: 87.5 }, { reps: 3, weight: 87.5 }, { reps: 2, weight: 90 }] },
    { daysBack: 56, sets: [{ reps: 5, weight: 82.5 }, { reps: 5, weight: 82.5 }, { reps: 5, weight: 82.5 }] }, // deload
    { daysBack: 49, sets: [{ reps: 5, weight: 87.5 }, { reps: 5, weight: 90 }, { reps: 3, weight: 92.5 }] },
    { daysBack: 42, sets: [{ reps: 5, weight: 90 }, { reps: 5, weight: 92.5 }, { reps: 3, weight: 95 }] },
    { daysBack: 35, sets: [{ reps: 3, weight: 95 }, { reps: 3, weight: 97.5 }, { reps: 1, weight: 100 }] },
    { daysBack: 28, sets: [{ reps: 5, weight: 92.5 }, { reps: 5, weight: 92.5 }, { reps: 5, weight: 92.5 }] }, // stagnation starts
    { daysBack: 21, sets: [{ reps: 5, weight: 92.5 }, { reps: 5, weight: 92.5 }, { reps: 3, weight: 95 }] }, // stagnation
    { daysBack: 14, sets: [{ reps: 5, weight: 92.5 }, { reps: 5, weight: 92.5 }, { reps: 5, weight: 92.5 }] }, // stagnation × 3
    { daysBack: 7,  sets: [{ reps: 3, weight: 97.5 }, { reps: 2, weight: 100 }, { reps: 1, weight: 105 }] }, // breakthrough
  ]

  if (backSquatId) {
    console.log('📦 Creating Back Squat sessions...')
    for (const sq of squatData) {
      const date = daysAgo(sq.daysBack)
      const sid  = await createSession(date, cfTypeId, 7)
      const bid  = await createBlock(sid, 1, backSquatId, 'Back Squat')
      await createSets(bid, backSquatId, 'Back Squat', sq.sets)
      const maxW = Math.max(...sq.sets.map(s => s.weight))
      await savePR(backSquatId, 'Back Squat', maxW, date, sid)
    }
    console.log('  ✓ Back Squat: 12 sessions created')
  }

  // ── Clean: fewer sessions, shows m/m comparison ─────────
  const cleanData = [
    { daysBack: 60, sets: [{ reps: 3, weight: 70 }, { reps: 3, weight: 72.5 }, { reps: 1, weight: 75 }] },
    { daysBack: 45, sets: [{ reps: 3, weight: 75 }, { reps: 2, weight: 77.5 }, { reps: 1, weight: 80 }] },
    { daysBack: 30, sets: [{ reps: 3, weight: 77.5 }, { reps: 2, weight: 80 }, { reps: 1, weight: 82.5 }] },
    { daysBack: 15, sets: [{ reps: 3, weight: 80 }, { reps: 2, weight: 82.5 }, { reps: 1, weight: 85 }] },
    { daysBack: 5,  sets: [{ reps: 2, weight: 82.5 }, { reps: 1, weight: 87.5 }, { reps: 1, weight: 90 }] },
  ]

  if (cleanId) {
    console.log('📦 Creating Clean sessions...')
    for (const cl of cleanData) {
      const date = daysAgo(cl.daysBack)
      const sid  = await createSession(date, cfTypeId, 8)
      const bid  = await createBlock(sid, 1, cleanId, 'Clean')
      await createSets(bid, cleanId, 'Clean', cl.sets)
      const maxW = Math.max(...cl.sets.map(s => s.weight))
      await savePR(cleanId, 'Clean', maxW, date, sid)
    }
    console.log('  ✓ Clean: 5 sessions created')
  }

  // ── Deadlift: heavy, shows high Brzycki 1RM estimation ──
  const dlData = [
    { daysBack: 50, sets: [{ reps: 5, weight: 120 }, { reps: 3, weight: 130 }, { reps: 1, weight: 140 }] },
    { daysBack: 36, sets: [{ reps: 5, weight: 125 }, { reps: 3, weight: 135 }, { reps: 1, weight: 145 }] },
    { daysBack: 22, sets: [{ reps: 5, weight: 130 }, { reps: 3, weight: 140 }, { reps: 1, weight: 150 }] },
    { daysBack: 8,  sets: [{ reps: 5, weight: 130 }, { reps: 3, weight: 140 }, { reps: 1, weight: 155 }] },
  ]

  if (deadliftId) {
    console.log('📦 Creating Deadlift sessions...')
    for (const dl of dlData) {
      const date = daysAgo(dl.daysBack)
      const sid  = await createSession(date, cfTypeId, 8)
      const bid  = await createBlock(sid, 1, deadliftId, 'Deadlift')
      await createSets(bid, deadliftId, 'Deadlift', dl.sets)
      const maxW = Math.max(...dl.sets.map(s => s.weight))
      await savePR(deadliftId, 'Deadlift', maxW, date, sid)
    }
    console.log('  ✓ Deadlift: 4 sessions created')
  }

  console.log('\n✅ Seed complete! Go to /prs to see Layer 2 analytics.')
}

main().catch(e => { console.error(e); process.exit(1) })
