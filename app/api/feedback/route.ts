import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/feedback — saves a feedback row (as the authenticated user, via their
// forwarded JWT so RLS applies and no service-role key is needed) and fires two
// best-effort notifications: an email (Resend) and a Confluence log row. Neither
// side effect can lose the feedback — it's persisted first; failures are reported.

export const runtime = 'nodejs'

const FEEDBACK_TYPES = ['bug', 'suggestion', 'question', 'autre'] as const

type Entry = { date: string; user: string; message: string; type: string | null }

// ── Email via Resend (REST, no SDK dependency) ───────────────────────────────
async function sendFeedbackEmail(e: Entry): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const to = process.env.FEEDBACK_NOTIFY_EMAIL
  if (!key || !to) return false   // not configured → skip silently
  const from = process.env.FEEDBACK_FROM_EMAIL || 'Trainlift <onboarding@resend.dev>'
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to,
      subject: `[Trainlift] Feedback${e.type ? ` · ${e.type}` : ''} — ${e.user}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1a1a1a">
        <p><strong>${e.type ?? 'feedback'}</strong> de <strong>${esc(e.user)}</strong></p>
        <p style="white-space:pre-wrap;background:#f8f7f5;border:1px solid #ece9e4;border-radius:10px;padding:12px">${esc(e.message)}</p>
        <p style="color:#9a9a9a;font-size:12px">${esc(e.date)}</p>
      </div>`,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  return true
}

// ── Append a row to the Confluence log page (storage-format XHTML) ───────────
async function appendToConfluence(e: Entry): Promise<boolean> {
  const base = process.env.CONFLUENCE_BASE_URL          // e.g. https://your-site.atlassian.net/wiki
  const pageId = process.env.CONFLUENCE_FEEDBACK_PAGE_ID
  const email = process.env.ATLASSIAN_EMAIL
  const token = process.env.ATLASSIAN_API_TOKEN
  if (!base || !pageId || !email || !token) return false   // not configured → skip

  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64')
  const get = await fetch(`${base}/rest/api/content/${pageId}?expand=body.storage,version`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })
  if (!get.ok) throw new Error(`Confluence GET ${get.status}`)
  const page = await get.json()
  const version: number = page.version.number
  const title: string = page.title
  let storage: string = page.body.storage.value

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const row = `<tr><td>${esc(e.date)}</td><td>${esc(e.user)}</td><td><p>${esc(e.message)}</p></td></tr>`

  // Append into the existing table (before </tbody>, else last </table>); never overwrite.
  if (storage.includes('</tbody>')) {
    storage = storage.replace(/<\/tbody>(?![\s\S]*<\/tbody>)/, `${row}</tbody>`)
  } else if (storage.includes('</table>')) {
    storage = storage.replace(/<\/table>(?![\s\S]*<\/table>)/, `${row}</table>`)
  } else {
    // No table yet → seed one with a header.
    storage += `<table><tbody><tr><th>Date</th><th>User</th><th>Message</th></tr>${row}</tbody></table>`
  }

  const put = await fetch(`${base}/rest/api/content/${pageId}`, {
    method: 'PUT',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: pageId, type: 'page', title,
      version: { number: version + 1 },
      body: { storage: { value: storage, representation: 'storage' } },
    }),
  })
  if (!put.ok) throw new Error(`Confluence PUT ${put.status}: ${await put.text()}`)
  return true
}

export async function POST(req: NextRequest) {
  // Identify the caller from their forwarded access token (RLS-respecting insert).
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'Message requis' }, { status: 400 })

  const type = FEEDBACK_TYPES.includes(body.type as typeof FEEDBACK_TYPES[number]) ? (body.type as string) : null
  const ratingNum = Number(body.rating)
  const rating = Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : null
  const page = typeof body.page === 'string' ? body.page : null
  const userName = typeof body.user_name === 'string' && body.user_name.trim() ? body.user_name.trim() : null

  // 1. Persist (RLS: any authenticated user may insert).
  const { error } = await supa.from('feedback').insert({ user_name: userName, type, rating, message, page })
  if (error) return NextResponse.json({ error: `Enregistrement échoué: ${error.message}` }, { status: 500 })

  // 2–3. Best-effort notifications — never block on these.
  const userLabel = user.email ?? user.id
  const entry: Entry = {
    date: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
    user: userName ? `${userName} <${userLabel}>` : userLabel,
    message, type,
  }
  const [email, confluence] = await Promise.allSettled([sendFeedbackEmail(entry), appendToConfluence(entry)])
  const ok = (r: PromiseSettledResult<boolean>) => r.status === 'fulfilled' && r.value
  if (email.status === 'rejected') console.error('feedback email failed:', email.reason)
  if (confluence.status === 'rejected') console.error('feedback confluence failed:', confluence.reason)

  return NextResponse.json({ ok: true, saved: true, notified: { email: ok(email), confluence: ok(confluence) } })
}

// Quick config check: GET /api/feedback → which integrations are wired up.
export function GET() {
  return NextResponse.json({
    status: 'ok',
    email_configured: !!(process.env.RESEND_API_KEY && process.env.FEEDBACK_NOTIFY_EMAIL),
    confluence_configured: !!(process.env.CONFLUENCE_BASE_URL && process.env.CONFLUENCE_FEEDBACK_PAGE_ID
      && process.env.ATLASSIAN_EMAIL && process.env.ATLASSIAN_API_TOKEN),
  })
}
