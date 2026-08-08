import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

type MovementRow = {
  created_at: string
  product_name: string
  sku: string | null
  movement_type: string
  quantity_change: number
  previous_stock: number
  new_stock: number
  note: string | null
  performed_by_name: string | null
  performed_by_role: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('product')
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = await createClient()

  let query = supabase.from('stock_movement_log').select('*').limit(1000)

  if (productId) query = query.eq('product_id', productId)
  if (type && type !== 'all') query = query.eq('movement_type', type)
  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const { data, error } = await query

  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 })
  }

  const rows = (data as MovementRow[]) || []

  const header = ['Date', 'Product', 'SKU', 'Type', 'Change', 'Previous Stock', 'New Stock', 'By', 'Role', 'Note']

  const csvRows = rows.map((m) => [
    new Date(m.created_at).toLocaleString('en-NG'),
    m.product_name,
    m.sku || '',
    m.movement_type,
    m.quantity_change,
    m.previous_stock,
    m.new_stock,
    m.performed_by_name || '',
    m.performed_by_role || '',
    m.note || '',
  ])

  const csv = [header, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="stock-history-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}