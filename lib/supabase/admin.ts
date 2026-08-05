import { createClient } from '@supabase/supabase-js'

// SERVER-ONLY. Never import this in a Client Component ('use client') file,
// and never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}