import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ST-35 P2 — personalised performance tips. Haiku (cheap) + on-demand only
// (client gates calls + caches), so cost is a fraction of a cent per generation.
const MODEL = 'claude-haiku-4-5-20251001'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'config_error', message: 'Clé API manquante' }, { status: 500 })

  let summary: unknown
  try {
    summary = (await req.json()).summary
    if (!summary) throw new Error('summary manquant')
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Corps invalide' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  const PROMPT = `Tu es un coach CrossFit / préparation physique, bref et bienveillant.
Données de performance d'un athlète (JSON) :

${JSON.stringify(summary).slice(0, 6000)}

IMPORTANT sur les chiffres : "best" est la **meilleure charge (1RM/record) en kg** pour un mouvement — NE multiplie JAMAIS par les répétitions, n'additionne pas les séries. Le tonnage n'est pas fourni ici.

Donne **2 à 3** conseils TRÈS COURTS (une phrase simple chacun), concrets, en français, en tutoyant, strictement ancrés sur ces données (catégorie faible à travailler, prochain palier réaliste sur un mouvement, ou deload si stagnation ; tiens compte des blessures/matériel si fournis). Reste simple et motivant.

Réponds UNIQUEMENT en JSON valide, sans markdown : {"tips":["...","..."]}`

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: PROMPT }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    let tips: unknown = []
    try { tips = JSON.parse(raw).tips }
    catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { tips = JSON.parse(m[0]).tips } catch {} } }
    const clean = Array.isArray(tips) ? (tips as unknown[]).filter(t => typeof t === 'string').slice(0, 3) : []
    return NextResponse.json({ tips: clean })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[performance-tips] API error:', message)
    return NextResponse.json({ error: 'api_error', message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', model: MODEL, api_key_configured: !!process.env.ANTHROPIC_API_KEY })
}
