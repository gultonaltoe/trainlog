// ─────────────────────────────────────────────────────────
// Import CSV → Supabase
// Usage: node scripts/import.mjs sessions.csv
// ─────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'

// ── Charger .env.local manuellement (évite le bug --env-file avec .mjs) ──
try {
  const env = readFileSync('.env.local', 'utf-8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^=]+)=(.+)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
  console.log('1. .env.local chargé')
} catch {
  console.error('❌ .env.local introuvable — lance le script depuis la racine du projet')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('❌ Variables Supabase manquantes dans .env.local')
  process.exit(1)
}
console.log('2. Variables OK:', url.slice(0, 30) + '...')

const supabase = createClient(url, key)

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('❌ Usage: node scripts/import.mjs sessions.csv')
  process.exit(1)
}
console.log('3. Fichier CSV:', csvPath)

// ── Parser CSV ────────────────────────────────────────────
function parseCSVRow(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes }
    else if (char === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += char }
  }
  result.push(current)
  return result
}

function parseCSV(content) {
  const lines = content.replace(/\r/g, '').split('\n').filter(l => l.trim())
  const headers = parseCSVRow(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = parseCSVRow(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim() })
    return obj
  }).filter(row => Object.values(row).some(v => v))
}

// ── Helpers ───────────────────────────────────────────────
function parseDate(str) {
  if (!str?.trim()) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim()
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return null
}

function mapFeeling(text) {
  if (!text?.trim()) return null
  const t = text.toLowerCase()
  if (t.includes('excellent') || t.includes('très bien') || t.includes('top')) return 5
  if (t.includes('bien') || t.includes('bon'))                                  return 4
  if (t.includes('moyen') || t.includes('correct') || t.includes('ok'))         return 3
  if (t.includes('mauvais') || t.includes('difficile'))                         return 2
  if (t.includes('nul') || t.includes('terrible') || t.includes('épuisé'))     return 1
  return 3
}

// ── Lire le CSV ───────────────────────────────────────────
let rows
try {
  const content = readFileSync(csvPath, 'utf-8')
  rows = parseCSV(content)
  console.log(`4. ${rows.length} lignes lues`)
  console.log('   Colonnes:', Object.keys(rows[0] || {}).join(' | '))
} catch (e) {
  console.error('❌ Erreur lecture CSV:', e.message)
  process.exit(1)
}

// ── Types de séance ───────────────────────────────────────
console.log('5. Connexion Supabase...')
let typeMap = {}
try {
  const { data, error } = await supabase.from('session_types').select('id, name')
  if (error) throw error
  data.forEach(t => { typeMap[t.name.toLowerCase()] = t.id })
  console.log('   Types:', Object.keys(typeMap).join(', '))
} catch (e) {
  console.error('❌ Erreur Supabase:', e.message)
  process.exit(1)
}

// ── Import ────────────────────────────────────────────────
console.log('\n📥 Import en cours...\n')
let imported = 0, skipped = 0, errors = 0

for (const [i, row] of rows.entries()) {
  const date        = parseDate(row['Date'] || row['date'])
  const typeName    = (row['Type de séance'] || row['Type'] || '').trim()
  const contenu     = (row['Contenu principal'] || '').trim()
  const charge      = (row['Charge / Volume clé'] || '').trim()
  const wod         = (row['WOD'] || '').trim()
  const rpeRaw      = (row['RPE (1-10)'] || row['RPE'] || '').trim()
  const ressenti    = (row['Ressenti post-séance'] || row['Ressenti'] || '').trim()
  const douleur     = (row['Douleur / alerte'] || row['Douleur'] || '').trim()
  const commentaire = (row['Commentaire'] || '').trim()

  if (!date) {
    console.log(`  ⚠️  Ligne ${i+2}: date invalide "${row['Date']}" — ignorée`)
    skipped++; continue
  }

  const typeId = typeMap[typeName.toLowerCase()]
  if (!typeId) {
    console.log(`  ⚠️  Ligne ${i+2}: type inconnu "${typeName}" (${date}) — ignorée`)
    skipped++; continue
  }

  const rpe     = rpeRaw ? parseInt(rpeRaw) : null
  const feeling = mapFeeling(ressenti)

  const notesParts = []
  if (contenu)     notesParts.push(`Force/Technique: ${contenu}`)
  if (charge)      notesParts.push(`Charge/Volume: ${charge}`)
  if (commentaire) notesParts.push(commentaire)

  try {
    const { data: session, error: sErr } = await supabase.from('sessions')
      .insert({
        date,
        session_type_id: typeId,
        rpe:          (rpe >= 1 && rpe <= 10) ? rpe : null,
        feeling_post: feeling,
        notes:        notesParts.join('\n') || null,
        meta:         { imported: true },
      })
      .select('id').single()

    if (sErr) throw sErr
    const sessionId = session.id

    if (wod) {
      await supabase.from('wods').insert({
        session_id:   sessionId,
        format_label: 'Import',
        description:  wod,
        is_rx:        true,
      })
    }

    const douleurClean = douleur.toLowerCase()
    if (douleur && !['non','aucune','-','n/a',''].includes(douleurClean)) {
      const parts = douleur.split(/[,;/]+/).map(p => p.trim()).filter(Boolean)
      for (const part of parts) {
        await supabase.from('session_pain_alerts').insert({
          session_id: sessionId, body_part_label: part, severity: 1,
        })
      }
    }

    imported++
    console.log(`  ✓ ${date}  ${typeName}${rpe ? '  RPE '+rpe : ''}`)

  } catch (e) {
    console.error(`  ✗ Ligne ${i+2} (${date}): ${e.message}`)
    errors++
  }
}

console.log(`\n${'═'.repeat(38)}`)
console.log(`  ✅ Import terminé`)
console.log(`     Importées : ${imported}`)
console.log(`     Ignorées  : ${skipped}`)
console.log(`     Erreurs   : ${errors}`)
console.log(`${'═'.repeat(38)}\n`)
