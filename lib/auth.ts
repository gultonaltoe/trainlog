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
 * Canonical email for auth: lowercased + trimmed; for gmail/googlemail the dots
 * in the local part are stripped and the domain unified. Prevents dot-variant
 * duplicate accounts (Gmail ignores dots; Supabase treats them as distinct).
 * Mirrors the SQL normalize_email() used for invite matching.
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
