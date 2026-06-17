import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — import `supabase` everywhere, never recreate the client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { detectSessionInUrl: false },
})
