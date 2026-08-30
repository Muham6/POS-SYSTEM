import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyLowStock } from '@/lib/send-push'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Any signed-in staff member can trigger this — it fires right after a sale
  // they made drops something below its reorder threshold.
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []

  const cleaned = items
    .filter((i: unknown) => i && typeof i === 'object')
    .map((i: { name?: unknown; stock_quantity?: unknown }) => ({
      name: String(i.name || 'Product'),
      stock_quantity: Number(i.stock_quantity) || 0,
    }))
    .slice(0, 20)

  await notifyLowStock(cleaned)

  return NextResponse.json({ success: true })
}
