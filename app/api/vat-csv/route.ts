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

  const { days, totals } = buildVatBreakdown(rows)

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

  // Tells the accountant how these figures were produced, matching the caveat
  // on the VAT page.
  csvRows.push([])
  csvRows.push([
    `Note: VAT is added on top of the shelf price, and each sale records the exact VAT charged on it at the time, so a later change to the VAT rate does not alter these figures. Gross = what customers paid, including VAT. Net = gross minus VAT. Sales made before VAT was switched on carry zero VAT, because none was charged. Refunded and cancelled sales are excluded, and money refunded on part-returned sales is taken off, along with its VAT. The store's current rate is ${vatRate}%.`,
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
