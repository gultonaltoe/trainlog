import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Identifiant unique par navigateur (stocké en localStorage)
export function getUserId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = localStorage.getItem('user-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('user-id', id)
  }
  return id
}

// Singleton — importe `supabase` partout dans l'app, ne recrée jamais le client
export const supabase = createClient(supabaseUrl, supabaseKey)
