import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyLargeDiscount } from '@/lib/send-push'

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
  const discount = Number(body?.discount)
  const subtotal = Number(body?.subtotal)
  const percent = Number(body?.percent)

  if (!Number.isFinite(discount) || !Number.isFinite(subtotal) || !Number.isFinite(percent)) {
    return NextResponse.json({ error: 'invalid_discount' }, { status: 400 })
  }

  await notifyLargeDiscount({
    cashierName: profile?.full_name || 'A cashier',
    saleNumber: String(body?.saleNumber || '').slice(0, 40) || 'a sale',
    discount,
    subtotal,
    percent,
  })

  return NextResponse.json({ success: true })
}
