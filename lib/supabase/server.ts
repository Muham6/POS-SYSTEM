import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Used inside Server Components, layouts, and route handlers.
// Reads/writes the auth session from cookies on the server.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component where cookies can't be set.
            // Safe to ignore — the middleware refreshes the session instead.
          }
        },
      },
    }
  )
}
