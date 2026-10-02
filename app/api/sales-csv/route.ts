import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { fetchAllRows } from '@/lib/fetch-all'
import { NextRequest } from 'next/server'
import { SHOP_TIME_ZONE, dayStart, dayEnd, shopToday } from '@/lib/time'

type SaleRow = {
  sale_number: string
  created_at: string
  status: string
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
  const profile = await getProfile()

  if (!profile) {
    return new Response('Not authenticated', { status: 401 })
  }

  // Paged, because a single read stops at 1000 rows without saying so.
  const { rows: data, error } = await fetchAllRows((fromRow, toRow) => {
    let query = supabase
      .from('sales')
      .select(
        `
        sale_number,
        created_at,
        status,
        subtotal,
        discount,
        total,
        cash_amount,
        card_amount,
        transfer_amount,
        payment_method,
        profiles!sales_cashier_id_fkey (
          full_name
        ),
        customers (
          name,
          company_or_store
        )
      `
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(fromRow, toRow)

    // Same scoping as the page: a cashier exports only their own sales.
    if (profile.role !== 'admin') query = query.eq('cashier_id', profile.id)
    // An admin exporting one person's sales, as filtered on the page.
    const staff = searchParams.get('staff')
    if (profile.role === 'admin' && staff) query = query.eq('cashier_id', staff)

    if (from) {
      query = query.gte('created_at', dayStart(from))
    }

    if (to) {
      query = query.lte('created_at', dayEnd(to))
    }

    return query
  })

  if (error) {
    return new Response(`Error: ${error}`, { status: 500 })
  }

  const rows = (data as unknown as SaleRow[]) || []

  const header = [
    'Invoice',
    'Date',
    'Status',
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
    new Date(s.created_at).toLocaleString('en-NG', { timeZone: SHOP_TIME_ZONE }),
    s.status,
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
      'Content-Disposition': `attachment; filename="sales-${shopToday()}.csv"`,
    },
  })
}