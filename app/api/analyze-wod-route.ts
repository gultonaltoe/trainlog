import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { image, mediaType } = await req.json()
  if (!image || !mediaType) {
    return NextResponse.json({ error: 'missing_image' }, { status: 400 })
  }

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        {
          type: 'text',
          text: `Analyse ce tableau de CrossFit ou fitness. Extrais en JSON pur (sans backticks ni markdown).

Format attendu :
{
  "warmup": "description de l'échauffement ou null",
  "strength_notes": "exercices de force/technique ou null",
  "format": "AMRAP|EMOM|E2MOM|For Time|Rounds|Tabata|Every X'|Autre",
  "time_cap": null ou entier en minutes,
  "description": "WOD complet avec mouvements et charges"
}

Si l'image n'est pas lisible ou pas un tableau de sport : {"error": "non reconnu"}`
        }
      ]
    }]
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    return NextResponse.json({ error: 'parse_error', raw: text }, { status: 500 })
  }
}
