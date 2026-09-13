import { NextRequest, NextResponse } from 'next/server'
import { createClient as createStandaloneClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Verifies a manager's own credentials so they can authorise a single over-limit
// discount on the Sell screen, WITHOUT touching the cashier's session.
//
// Why this has to live on the server: calling supabase.auth.signInWithPassword()
// in the browser would replace the signed-in cashier's session with the manager's,
// silently switching who is logged in and who gets recorded as the cashier on the
// sale. The credential check therefore happens here, on a throwaway Supabase client
// that has no access to the request cookies at all, so nothing it does can write,
// refresh, or clear the caller's auth cookies.

function fail(reason: string, message: string, status: number) {
  return NextResponse.json({ ok: false, reason, message }, { status })
}

export async function POST(req: NextRequest) {
  // The caller must already be signed in (any staff member). This is the normal
  // cookie-bound client — used ONLY to identify the caller, never to sign anyone
  // in or out — and it keeps this route from being an open endpoint that anyone
  // could use to test email/password pairs against the store.
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()

  if (!caller) {
    return fail('not_authenticated', 'Your session has expired. Sign in again and retry.', 401)
  }

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    return fail('missing_credentials', "Enter the manager's email and password.", 400)
  }

  // A separate, cookie-free client. persistSession/autoRefreshToken are off, so the
  // session it obtains lives only in this function's memory for the length of the
  // request and is never written anywhere the cashier's browser or cookies can see.
  const verifier = createStandaloneClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )

  const { data: signIn, error: signInError } = await verifier.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !signIn?.user) {
    // Deliberately vague — don't reveal whether the email exists.
    return fail('invalid_credentials', 'That email and password don’t match. Try again.', 401)
  }

  // A valid password alone is not enough: only an admin may approve an override,
  // so a cashier entering their own correct credentials here is rejected.
  const { data: profile } = await verifier
    .from('profiles')
    .select('role, full_name, is_active')
    .eq('id', signIn.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return fail(
      'not_a_manager',
      'Those details are correct, but that account is not a manager — only a manager can approve a discount.',
      403
    )
  }

  if (profile.is_active === false) {
    return fail('inactive_manager', 'That manager’s account is deactivated and cannot approve discounts.', 403)
  }

  // Note: we intentionally do NOT call verifier.auth.signOut(). It defaults to a
  // global scope, which would revoke the manager's refresh tokens on every device
  // they're signed in on. Nothing was persisted, so there is nothing to clean up.

  // No token, session, or user id ever leaves this route — just the outcome and the
  // manager's display name, so the Sell screen can show who approved the discount.
  return NextResponse.json({ ok: true, manager_name: profile.full_name || email })
}
