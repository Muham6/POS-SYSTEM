import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { getProfile } from '@/lib/auth'
import {
  buildVatBreakdown,
  fetchCompletedSalesForMonth,
  getVatRate,
  monthLabel,
  resolveMonth,
} from '@/lib/vat'

export async function GET(request: NextRequest) {
  // The VAT report itself is admin-only (see ADMIN_ONLY_PREFIXES in
  // lib/supabase/middleware.ts); the export of it has to be too.
  const profile = await getProfile()

  if (!profile || profile.role !== 'admin') {
    return new Response('Error: admins only.', {
      status: 403,
    })
  }

  const { searchParams } = new URL(request.url)

  const month = resolveMonth(searchParams.get('month'))

  const supabase = await createClient()

  const { vatRate, error: settingsError } = await getVatRate(supabase)

  if (settingsError) {
    return new Response(`Error: ${settingsError}`, {
      status: 500,
    })
  }

  if (!(vatRate > 0)) {
    return new Response(
      'Error: no VAT rate is set for this store. Add one in Settings first.',
      {
        status: 400,
      }
    )
  }

  const { rows, error } = await fetchCompletedSalesForMonth(supabase, month)

  if (error) {
    return new Response(`Error: ${error}`, {
      status: 500,
    })
  }

  const { days, totals } = buildVatBreakdown(rows, vatRate)

  const header = [
    'Date',
    'Completed Sales',
    'Gross (VAT inclusive)',
    'Net of VAT',
    `VAT at ${vatRate}%`,
  ]

  const csvRows: (string | number)[][] = days.map((d) => [
    d.day,
    d.numSales,
    d.gross.toFixed(2),
    d.net.toFixed(2),
    d.vat.toFixed(2),
  ])

  csvRows.push([
    `TOTAL ${monthLabel(month)}`,
    totals.numSales,
    totals.gross.toFixed(2),
    totals.net.toFixed(2),
    totals.vat.toFixed(2),
  ])

  // Historical sales don't store the rate that applied on the day, so the
  // accountant needs to see which rate produced these numbers.
  csvRows.push([])
  csvRows.push([
    `Note: VAT-inclusive pricing. VAT = total - total / (1 + ${vatRate}/100). All rows calculated at the store's current VAT rate of ${vatRate}%, which may differ from the rate in force during the period. Refunded and cancelled sales excluded.`,
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
      'Content-Disposition': `attachment; filename="vat-report-${month}.csv"`,
    },
  })
}
