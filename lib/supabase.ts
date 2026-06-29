import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — import `supabase` everywhere, never recreate the client.
// Typed with the generated Database schema (supabase gen types) so queries
// are checked against the real DB. Regenerate after schema changes:
//   supabase gen types typescript --project-id hhcqomkcdjgttgwfcymu > lib/database.types.ts
// Implicit flow (not PKCE): magic-link emails carry the session in the URL hash,
// so a link requested on one device works when opened on another (e.g. request on
// laptop, open the email on a phone). PKCE keeps the code-verifier in the
// originating browser only, which broke cross-device login.
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: { flowType: 'implicit' },
})
