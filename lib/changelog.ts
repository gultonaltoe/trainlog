import { supabase } from './supabase'

export type ChangelogTag = 'new_feature' | 'improvement' | 'fix'
export type ChangelogEntry = { id: string; title: string; body: string; tag: ChangelogTag; publishedAt: string }
type Row = { id: string; title: string; body: string; tag: string; published_at: string }

/** All changelog entries, newest first (RLS: any authenticated user can read). */
export async function getChangelog(): Promise<ChangelogEntry[]> {
  const { data, error } = await supabase
    .from('changelog_entries')
    .select('id, title, body, tag, published_at')
    .order('published_at', { ascending: false })
  if (error) throw new Error(`getChangelog: ${error.message}`)
  return ((data ?? []) as Row[]).map(r => ({
    id: r.id, title: r.title, body: r.body, tag: r.tag as ChangelogTag, publishedAt: r.published_at,
  }))
}
