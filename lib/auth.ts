import { supabase } from './supabase'

/**
 * Thrown when an operation needs a signed-in user but none is present.
 * Lets callers tell "logged out" (expected, show nothing) apart from
 * "the query failed" (a real bug we must not hide).
 */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated')
    this.name = 'NotAuthenticatedError'
  }
}

/**
 * Dot-insensitive MATCHING KEY for gmail/googlemail (mirrors the SQL
 * normalize_email() used for invite matching). NOTE: only for comparing two
 * addresses — never use it for what we send or store. We persist/send the email
 * exactly as typed (lowercased+trimmed) so it stays faithful and always
 * delivers; only invite matching collapses gmail dot-variants, server-side.
 */
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase()
  const m = e.match(/^([^@]+)@(?:gmail|googlemail)\.com$/)
  return m ? `${m[1].replace(/\./g, '')}@gmail.com` : e
}

/** The current signed-in user's id, or null if logged out. */
export async function getSessionUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user.id ?? null
}

/** The current signed-in user's id, or throw NotAuthenticatedError. */
export async function requireUserId(): Promise<string> {
  const id = await getSessionUserId()
  if (!id) throw new NotAuthenticatedError()
  return id
}
