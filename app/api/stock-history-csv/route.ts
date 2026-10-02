import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { NextRequest } from 'next/server'
import { SHOP_TIME_ZONE, dayStart, dayEnd, shopToday } from '@/lib/time'

type MovementRow = {
  created_at: string
  product_name: string
  sku: string | null
  movement_type: string
  quantity_change: number
  previous_stock: number
  new_stock: number
  note: string | null
  batch_reference: string | null
  performed_by_name: string | null
  performed_by_role: string | null
}

export async function GET(request: NextRequest) {
  // The Stock History page is admin-only; its export has to be too, or a
  // cashier can download the whole stock log by typing the address.
  const profile = await getProfile()
  if (!profile) return new Response('Not authenticated', { status: 401 })
  if (profile.role !== 'admin') return new Response('Admins only', { status: 403 })

  const { searchParams } = new URL(request.url)

  const productId = searchParams.get('product')
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const batch = searchParams.get('batch')

  const supabase = await createClient()

  let query = supabase
    .from('stock_movement_log')
    .select('*')
    .limit(1000)

  if (productId) {
    query = query.eq('product_id', productId)
  }

  if (type && type !== 'all') {
    query = query.eq('movement_type', type)
  }

  if (from) {
    query = query.gte('created_at', dayStart(from))
  }

  if (to) {
    query = query.lte('created_at', dayEnd(to))
  }

  if (batch) {
    query = query.eq('batch_reference', batch)
  }

  const { data, error } = await query

  if (error) {
    return new Response(`Error: ${error.message}`, {
      status: 500,
    })
  }

  const rows = (data as MovementRow[]) || []

  const header = [
    'Date',
    'Product',
    'SKU',
    'Type',
    'Change',
    'Previous Stock',
    'New Stock',
    'By',
    'Role',
    'Note',
    'Batch',
  ]

  const csvRows = rows.map((m) => [
    new Date(m.created_at).toLocaleString('en-NG', { timeZone: SHOP_TIME_ZONE }),
    m.product_name,
    m.sku || '',
    m.movement_type,
    m.quantity_change,
    m.previous_stock,
    m.new_stock,
    m.performed_by_name || '',
    m.performed_by_role || '',
    m.note || '',
    m.batch_reference || '',
  ])

  const csv = [header, ...csvRows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="stock-history-${shopToday()}.csv"`,
    },
  })
}