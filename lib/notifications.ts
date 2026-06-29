import { supabase } from './supabase'

// In-app notifications for the current user. Rows are created server-side
// (DB triggers / definer functions); RLS scopes reads + mark-read to the owner.

export type AppNotification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

type Row = {
  id: string; type: string; title: string; body: string | null
  link: string | null; read_at: string | null; created_at: string
}

/** The current user's notifications, newest first (RLS scopes to them). */
export async function getNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(`getNotifications: ${error.message}`)
  return ((data ?? []) as Row[]).map(r => ({
    id: r.id, type: r.type, title: r.title, body: r.body,
    link: r.link, readAt: r.read_at, createdAt: r.created_at,
  }))
}

/** The latest unread notification of a given type for the current user, or null. */
export async function getUnreadByType(type: string): Promise<AppNotification | null> {
  const { data, error } = await supabase.from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('type', type).is('read_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error || !data) return null
  const r = data as Row
  return { id: r.id, type: r.type, title: r.title, body: r.body, link: r.link, readAt: r.read_at, createdAt: r.created_at }
}

export async function markRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
}

export async function markAllRead(): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
}
