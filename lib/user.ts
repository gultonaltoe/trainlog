// Device-scoped user ID — generated once, stored in localStorage
// No auth required: each device gets a stable UUID

const KEY = 'trainlog_uid'

export function getUserId(): string {
  if (typeof window === 'undefined') return ''
  let uid = localStorage.getItem(KEY)
  if (!uid) {
    uid = crypto.randomUUID()
    localStorage.setItem(KEY, uid)
  }
  return uid
}

export function hasUserId(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(KEY)
}

export function clearUserId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}
