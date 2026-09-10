import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Hiding a nav link isn't a security boundary — these prefixes are the real
// gate for admin-only areas. Keep in sync with the admin-only links built in
// app/dashboard/layout.tsx.
const ADMIN_ONLY_PREFIXES = [
  '/dashboard/products',
  '/dashboard/stock-history',
  '/dashboard/suppliers',
  '/dashboard/sales',
  '/dashboard/shift/history',
  '/dashboard/reports',
  '/dashboard/users',
  '/dashboard/settings',
]

function isAdminOnlyPath(path: string) {
  return ADMIN_ONLY_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

// Runs on every request (via proxy.ts at the project root).
// It does three jobs:
//   1. Keeps the auth session fresh (refreshes the token).
//   2. Guards routes: logged-out users get bounced to /login,
//      logged-in users who hit /login get sent on to /dashboard.
//   3. Guards admin-only areas server-side, so a cashier who knows (or
//      guesses) the URL can't just skip past the hidden nav link.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: this call refreshes the token. Don't remove it.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isLoginPage = path === '/login'

  // Not signed in and trying to reach anything but the login page -> /login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Already signed in but sitting on /login -> send to the dashboard
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user && isAdminOnlyPath(path)) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
