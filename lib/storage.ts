import { supabase } from './supabase'

// Supabase Storage helpers. Buckets + RLS are created via
// supabase/_release_storage_images.sql (run in the SQL editor).

const MAX_BYTES = 5 * 1024 * 1024  // 5 MB

function checkImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Fichier image requis')
  if (file.size > MAX_BYTES) throw new Error('Image trop lourde (max 5 Mo)')
}

/** Upload a box logo (owner only). Path: box-assets/{orgId}/logo-*.ext. Returns the public URL. */
export async function uploadBoxLogo(orgId: string, file: File): Promise<string> {
  checkImage(file)
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${orgId}/logo-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('box-assets').upload(path, file, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  return supabase.storage.from('box-assets').getPublicUrl(path).data.publicUrl
}

/** Upload an avatar for a user. Path: avatars/{userId}/avatar-*.ext. Returns the public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  checkImage(file)
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
