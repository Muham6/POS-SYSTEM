import { createBrowserClient } from '@supabase/ssr'

// Used inside Client Components ('use client') — e.g. the login form and
// the sign-out button. Runs in the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
