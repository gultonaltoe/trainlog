import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — importe `supabase` partout dans l'app, ne recrée jamais le client
export const supabase = createClient(supabaseUrl, supabaseKey)
