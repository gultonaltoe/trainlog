import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Utilise Sonnet pour une meilleure lecture des tableaux manuscrits
// Coût : ~0.001€/photo — négligeable
const MODEL = 'claude-sonnet-4-6'

export async function POST(req: NextRequest) {
  // Vérification de la clé API
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[analyze-wod] ANTHROPIC_API_KEY manquante')
    return NextResponse.json(
      { error: 'config_error', message: 'Clé API manquante' },
      { status: 500 }
    )
  }

  let image: string, mediaType: string
  try {
    const body = await req.json()
    image     = body.image
    mediaType = body.mediaType || 'image/jpeg'
    if (!image) throw new Error('image manquante')
  } catch (e) {
    return NextResponse.json({ error: 'bad_request', message: 'Corps de requête invalide' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })

  const PROMPT = `Tu analyses une photo de tableau d'entraînement sportif (CrossFit, fitness, haltérophilie...).

INSTRUCTIONS:
- Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans backticks, sans explication
- Lis attentivement tout le texte visible, même manuscrit
- Si une section n'est pas présente ou illisible: mets null

FORMAT DE RÉPONSE OBLIGATOIRE:
{
  "warmup": "description de l'échauffement tel qu'écrit, ou null",
  "strength_notes": "exercices de force/skill/technique avec charges si indiquées, ou null",
  "format": "un parmi: AMRAP|EMOM|E2MOM|For Time|Tabata|Every X'|Rounds|Autre — ou null",
  "time_cap": null ou nombre entier (minutes),
  "description": "WOD/conditioning complet: mouvements, répétitions, charges — ou null"
}

Si l'image n'est pas un tableau d'entraînement: {"error": "image_non_reconnue"}

EXEMPLES DE SORTIES ATTENDUES:
Photo avec "AMRAP 15: 10 Thrusters 43kg, 15 Pull-ups, 20 Box Jumps":
{"warmup":null,"strength_notes":null,"format":"AMRAP","time_cap":15,"description":"10 Thrusters 43kg\\n15 Pull-ups\\n20 Box Jumps"}

Photo avec "WARMUP: 2 rounds 10 air squat / SKILL: Snatch tech / WOD For Time: 21-15-9 Thruster + C2B":
{"warmup":"2 rounds 10 air squat","strength_notes":"Snatch technique","format":"For Time","time_cap":null,"description":"21-15-9\\nThrusters\\nChest-to-Bar Pull-ups"}`

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
              data: image,
            }
          },
          { type: 'text', text: PROMPT }
        ]
      }]
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    console.log('[analyze-wod] Raw response:', raw.slice(0, 200))

    // Tentative de parsing direct
    try {
      const parsed = JSON.parse(raw)
      return NextResponse.json(parsed)
    } catch {
      // Si le JSON est entouré de texte, on l'extrait
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          return NextResponse.json(parsed)
        } catch {
          console.error('[analyze-wod] JSON parse failed after extraction:', match[0])
        }
      }
      // Réponse non parseable → retourner le texte brut pour debug
      return NextResponse.json({
        error: 'parse_error',
        raw: raw.slice(0, 500),
        message: 'Réponse non JSON'
      }, { status: 422 })
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[analyze-wod] API error:', message)
    return NextResponse.json(
      { error: 'api_error', message },
      { status: 500 }
    )
  }
}

// Route GET pour tester que l'endpoint existe et que la clé est configurée
export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY
  return NextResponse.json({
    status: 'ok',
    model: MODEL,
    api_key_configured: hasKey,
  })
}
