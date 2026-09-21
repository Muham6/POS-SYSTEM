import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Supabase has no permanent ban, only a duration. A century is permanent for
// every practical purpose, and reactivating clears it anyway.
const PERMANENT_BAN = '876000h'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can change account status' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId : null
  const active = typeof body?.active === 'boolean' ? body.active : null

  if (!userId || active === null) {
    return NextResponse.json({ error: 'userId and active are required' }, { status: 400 })
  }

  // The UI hides the button for your own row, but a request can be crafted.
  if (userId === user.id) {
    return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Auth layer first. Deactivating only the profile row would stop the app UI
  // but leave the login itself working — a dismissed cashier could still sign
  // in and reach the database directly with the public anon key.
  const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : PERMANENT_BAN,
  })

  if (banError) {
    return NextResponse.json({ error: banError.message }, { status: 400 })
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ is_active: active })
    .eq('id', userId)

  if (profileError) {
    return NextResponse.json(
      { error: `Login was ${active ? 'unlocked' : 'locked'} but the account status failed to save: ${profileError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
