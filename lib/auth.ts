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
