import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins can create accounts' },
      { status: 403 }
    )
  }

  const { email, password, full_name, role } = await request.json()

  if (!email || !password || !full_name || !role) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  if (role !== 'admin' && role !== 'cashier') {
    return NextResponse.json(
      { error: 'Invalid role' },
      { status: 400 }
    )
  }

  const adminClient = createAdminClient()

  const { data: newUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

  if (createError || !newUser.user) {
    return NextResponse.json(
      {
        error: createError?.message || 'Could not create account',
      },
      { status: 400 }
    )
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert(
      {
        id: newUser.user.id,
        full_name,
        email,
        role,
        is_active: true,
      },
      {
        onConflict: 'id',
      }
    )

  if (profileError) {
    // Roll back the auth user so we don't leave an orphaned login with no profile
    await adminClient.auth.admin.deleteUser(newUser.user.id)

    return NextResponse.json(
      { error: profileError.message },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    userId: newUser.user.id,
  })
}