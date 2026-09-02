import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyShiftClosed } from '@/lib/send-push'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

  const body = await req.json().catch(() => null)
  const expected = Number(body?.expected)
  const counted = Number(body?.counted)
  const variance = Number(body?.variance)

  if (!Number.isFinite(expected) || !Number.isFinite(counted) || !Number.isFinite(variance)) {
    return NextResponse.json({ error: 'invalid_summary' }, { status: 400 })
  }

  await notifyShiftClosed({
    cashierName: profile?.full_name || 'A cashier',
    expected,
    counted,
    variance,
  })

  return NextResponse.json({ success: true })
}
