import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

type SaleRow = {
  sale_number: string
  created_at: string
  subtotal: number
  discount: number
  total: number
  cash_amount: number
  card_amount: number
  transfer_amount: number
  payment_method: string
  profiles: {
    full_name: string | null
  } | null
  customers: {
    name: string | null
    company_or_store: string | null
  } | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = await createClient()

  let query = supabase
    .from('sales')
    .select(
      `
      sale_number,
      created_at,
      subtotal,
      discount,
      total,
      cash_amount,
      card_amount,
      transfer_amount,
      payment_method,
      profiles (
        full_name
      ),
      customers (
        name,
        company_or_store
      )
    `
    )
    .order('created_at', { ascending: false })

  if (from) {
    query = query.gte('created_at', `${from}T00:00:00`)
  }

  if (to) {
    query = query.lte('created_at', `${to}T23:59:59`)
  }

  const { data } = await query

  const rows = (data as unknown as SaleRow[]) || []

  const header = [
    'Invoice',
    'Date',
    'Cashier',
    'Customer',
    'Payment Method',
    'Cash',
    'Card',
    'Transfer',
    'Subtotal',
    'Discount',
    'Total',
  ]

  const csvRows = rows.map((s) => [
    s.sale_number,
    new Date(s.created_at).toLocaleString('en-NG'),
    s.profiles?.full_name || '',
    s.customers?.name || s.customers?.company_or_store || '',
    s.payment_method,
    s.cash_amount,
    s.card_amount,
    s.transfer_amount,
    s.subtotal,
    s.discount,
    s.total,
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
      'Content-Disposition': `attachment; filename="sales-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  })
}