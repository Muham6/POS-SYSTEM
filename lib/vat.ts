import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type VatSaleRow = {
  created_at: string
  total: number | string | null
  // Recorded at the moment of sale. NULL on sales rung up before VAT was charged.
  vat_amount?: number | string | null
  // Refunds against this sale. A fully returned sale is 'refunded' and never
  // reaches the report; these are the part-returns on sales still completed.
  returns?: { total_refund: number | string | null }[] | null
}

export type VatDayRow = {
  day: string
  numSales: number
  gross: number
  net: number
  vat: number
}

export type VatTotals = {
  numSales: number
  gross: number
  net: number
  vat: number
}

// VAT is charged ON TOP of the shelf price and stored on the sale, so a filing
// uses the exact figure the customer was charged rather than one re-derived at
// whatever the rate happens to be today.
//
// Sales predating that carry no vat_amount. Those are reported as zero VAT,
// because no VAT was ever added to them — inventing some retrospectively would
// overstate what the shop owes.
export function vatForSale(row: VatSaleRow): number {
  const recorded = row.vat_amount
  if (recorded === null || recorded === undefined) return 0
  return Number(recorded) || 0
}

export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Anything missing or malformed in the query string falls back to this month,
// so a hand-edited URL can never render a report for a nonsense period.
export function resolveMonth(raw?: string | string[] | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value && isValidMonth(value) ? value : currentMonth()
}

export function monthRange(month: string): {
  from: string
  toExclusive: string
} {
  const [year, m] = month.split('-').map(Number)
  const nextYear = m === 12 ? year + 1 : year
  const nextMonth = m === 12 ? 1 : m + 1

  return {
    from: `${month}-01T00:00:00`,
    toExclusive: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00`,
  }
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)

  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString('en-NG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

// The month picker offers this month and the months behind it — VAT is filed in
// arrears, so the previous month is the one that actually gets used most.
export function monthOptions(count = 24): string[] {
  const now = new Date()
  const options: string[] = []

  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    options.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    )
  }

  return options
}

const PAGE_SIZE = 1000

// Supabase caps a single select at 1000 rows. A busy month can pass that, and a
// silently truncated VAT return is worse than no VAT return, so page through.
export async function fetchCompletedSalesForMonth(
  supabase: SupabaseServerClient,
  month: string
): Promise<{ rows: VatSaleRow[]; error: string | null }> {
  const { from, toExclusive } = monthRange(month)
  const rows: VatSaleRow[] = []

  for (let page = 0; page < 200; page++) {
    const { data, error } = await supabase
      .from('sales')
      .select('created_at, total, vat_amount, returns ( total_refund )')
      // Only completed sales are VAT owed — refunded and cancelled sales are not.
      .eq('status', 'completed')
      .gte('created_at', from)
      .lt('created_at', toExclusive)
      .order('created_at', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (error) return { rows, error: error.message }

    const batch = (data as VatSaleRow[]) || []
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) break
  }

  return { rows, error: null }
}

export function buildVatBreakdown(rows: VatSaleRow[]): { days: VatDayRow[]; totals: VatTotals } {
  const byDay = new Map<string, VatDayRow>()

  rows.forEach((row) => {
    const day = String(row.created_at).slice(0, 10)
    const total = Number(row.total) || 0
    const refunded = (row.returns || []).reduce((sum, r) => sum + (Number(r.total_refund) || 0), 0)
    const gross = Math.max(total - refunded, 0)
    // A refund hands back the VAT on those goods too. process_return refunds
    // at the same proportion of the total the customer paid, so the VAT still
    // owed falls in the same proportion.
    const vat = total > 0 ? vatForSale(row) * (gross / total) : 0

    let entry = byDay.get(day)

    if (!entry) {
      entry = { day, numSales: 0, gross: 0, net: 0, vat: 0 }
      byDay.set(day, entry)
    }

    entry.numSales += 1
    entry.gross += gross
    entry.vat += vat
    entry.net += gross - vat
  })

  const days = Array.from(byDay.values()).sort((a, b) =>
    a.day.localeCompare(b.day)
  )

  const totals = days.reduce<VatTotals>(
    (acc, d) => {
      acc.numSales += d.numSales
      acc.gross += d.gross
      acc.net += d.net
      acc.vat += d.vat
      return acc
    },
    { numSales: 0, gross: 0, net: 0, vat: 0 }
  )

  return { days, totals }
}

export async function getVatRate(
  supabase: SupabaseServerClient
): Promise<{ vatRate: number; error: string | null }> {
  const { data, error } = await supabase
    .from('store_settings')
    .select('vat_rate')
    .eq('id', 1)
    .maybeSingle()

  return {
    vatRate: Number(data?.vat_rate) || 0,
    error: error?.message || null,
  }
}
