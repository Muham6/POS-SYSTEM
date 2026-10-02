import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SalesTrendChart from '@/components/sales-trend-chart'
import { money } from '@/lib/money'
import { fetchAllRows } from '@/lib/fetch-all'
import { friendlyError } from '@/lib/friendly-error'
import { dayStart, shopDay, shopToday, shopDaysAgo } from '@/lib/time'

type PaidOutRow = {
  created_at: string
  total_refund: number
  refund_cash: number
  refund_card: number
  refund_transfer: number
  sales: { status: string; cashier_id: string | null; created_at: string } | null
}

type LowStockProduct = {
  id: string
  name: string
  stock_quantity: number
}

type TopProductRow = {
  product_name: string
  quantity: number
}

type PaymentRow = {
  status: string
  total: number
  cash_amount: number
  card_amount: number
  transfer_amount: number
  discount: number
  created_at: string
  cashier_id: string | null
  profiles: { full_name: string } | null
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const today = shopToday()
  const weekAgo = shopDaysAgo(7)

  const [
    { data: summary, error: summaryError },
    { data: lowStock, error: lowStockError },
    topProductsResult,
    paymentResult,
    { data: stockRows, error: stockError },
    returnedItemsResult,
    paidOutResult,
  ] = await Promise.all([
    supabase
      .from('daily_sales_summary')
      .select('*')
      .gte('sale_day', weekAgo)
      .order('sale_day', { ascending: false }),

    supabase
      .from('low_stock_products')
      .select('*')
      .limit(10),

    // Scoped to the same 7 days as the rest of the page. It used to read every
    // sale_item ever recorded, which both disagreed with the "last 7 days"
    // framing everywhere else and would have silently truncated at 1000 rows
    // once the shop had sold enough.
    fetchAllRows((fromRow, toRow) =>
      supabase
        .from('sale_items')
        .select('product_name, quantity, sales!inner ( created_at, status )')
        .eq('sales.status', 'completed')
        .gte('sales.created_at', dayStart(weekAgo))
        .range(fromRow, toRow)
    ),

    fetchAllRows((fromRow, toRow) =>
      supabase
        .from('sales')
        // Must name the FK: sales points at profiles twice (cashier_id and
        // voided_by), so a bare profiles(...) embed is ambiguous and errors.
        .select(
          'status, total, cash_amount, card_amount, transfer_amount, discount, created_at, cashier_id, profiles!sales_cashier_id_fkey ( full_name )'
        )
        // A fully refunded sale still took its money on the day; the refund
        // comes off separately below, the same way the till count works.
        .in('status', ['completed', 'refunded'])
        .gte('created_at', dayStart(weekAgo))
        .range(fromRow, toRow)
    ),

    supabase
      .from('products')
      .select('stock_quantity, cost_price')
      .eq('is_active', true),

    // Items brought back from this week's completed sales, so top sellers
    // aren't credited with goods that came back.
    fetchAllRows<{ product_name: string; quantity: number }>((fromRow, toRow) =>
      supabase
        .from('return_items')
        .select('product_name, quantity, returns!inner ( sales!inner ( created_at, status ) )')
        .eq('returns.sales.status', 'completed')
        .gte('returns.sales.created_at', dayStart(weekAgo))
        .range(fromRow, toRow)
    ),

    // Refunds paid out this week, with the sale they were against.
    fetchAllRows((fromRow, toRow) =>
      supabase
        .from('returns')
        .select('created_at, total_refund, refund_cash, refund_card, refund_transfer, sales ( status, cashier_id, created_at )')
        .gte('created_at', dayStart(weekAgo))
        .range(fromRow, toRow)
    ),
  ])

  const topProducts = topProductsResult.rows as unknown as TopProductRow[]
  const paymentRows = paymentResult.rows as unknown as PaymentRow[]
  const paidOutRows = paidOutResult.rows as unknown as PaidOutRow[]

  const loadError =
    summaryError?.message ||
    lowStockError?.message ||
    topProductsResult.error ||
    paymentResult.error ||
    stockError?.message ||
    returnedItemsResult.error ||
    paidOutResult.error

  const stockValuation = (stockRows || []).reduce(
    (acc, p) => {
      if (p.cost_price === null) {
        acc.missingCostCount += 1
      } else {
        acc.total += Number(p.cost_price) * p.stock_quantity
      }
      return acc
    },
    { total: 0, missingCostCount: 0 }
  )

  const rows = summary || []

  const todayRow = rows.find((r) => r.sale_day === today)

  const weekTotal = rows.reduce(
    (sum, r) => sum + Number(r.total_revenue),
    0
  )

  const weekSales = rows.reduce(
    (sum, r) => sum + Number(r.num_sales),
    0
  )

  const typedPaymentRows = (paymentRows as unknown as PaymentRow[]) || []

  const cashierTotals: Record<
    string,
    { name: string; revenue: number; count: number; discount: number; discountedSales: number }
  > = {}
  typedPaymentRows.forEach((row) => {
    // A cashier's takings are their completed sales; a fully refunded sale
    // isn't takings at all. Part-refunds come off below.
    if (row.status !== 'completed') return
    const key = row.cashier_id || 'unknown'
    const name = row.profiles?.full_name || 'Unknown'
    if (!cashierTotals[key]) cashierTotals[key] = { name, revenue: 0, count: 0, discount: 0, discountedSales: 0 }
    cashierTotals[key].revenue +=
      (Number(row.cash_amount) || 0) + (Number(row.card_amount) || 0) + (Number(row.transfer_amount) || 0)
    cashierTotals[key].count += 1

    const rowDiscount = Number(row.discount) || 0
    if (rowDiscount > 0) {
      cashierTotals[key].discount += rowDiscount
      cashierTotals[key].discountedSales += 1
    }
  })
  paidOutRows.forEach((r) => {
    // Only refunds against this week's completed sales — the ones counted above.
    if (r.sales?.status !== 'completed' || new Date(r.sales.created_at) < new Date(dayStart(weekAgo))) return
    const entry = cashierTotals[r.sales.cashier_id || 'unknown']
    if (entry) entry.revenue -= Number(r.total_refund) || 0
  })
  const cashierBreakdown = Object.values(cashierTotals).sort((a, b) => b.revenue - a.revenue)

  const paymentTotals = (paymentRows || []).reduce(
    (acc, row) => {
      acc.cash += Number(row.cash_amount) || 0
      acc.card += Number(row.card_amount) || 0
      acc.transfer += Number(row.transfer_amount) || 0
      return acc
    },
    {
      cash: 0,
      card: 0,
      transfer: 0,
    }
  )

  // Money handed back comes out of the method it was refunded by, on the day
  // it was handed back — matching Sales History's takings table.
  const todayRefunds = { cash: 0, card: 0, transfer: 0 }
  paidOutRows.forEach((r) => {
    paymentTotals.cash -= Number(r.refund_cash) || 0
    paymentTotals.card -= Number(r.refund_card) || 0
    paymentTotals.transfer -= Number(r.refund_transfer) || 0
    if (shopDay(r.created_at) === today) {
      todayRefunds.cash += Number(r.refund_cash) || 0
      todayRefunds.card += Number(r.refund_card) || 0
      todayRefunds.transfer += Number(r.refund_transfer) || 0
    }
  })

  const todayPaymentTotals = (paymentRows || [])
    .filter((row) => shopDay(row.created_at) === today)
    .reduce(
      (acc, row) => {
        acc.cash += Number(row.cash_amount) || 0
        acc.card += Number(row.card_amount) || 0
        acc.transfer += Number(row.transfer_amount) || 0
        return acc
      },
      {
        cash: -todayRefunds.cash,
        card: -todayRefunds.card,
        transfer: -todayRefunds.transfer,
      }
    )

  const productTotals: Record<string, number> = {}

  ;(topProducts || []).forEach((item) => {
    productTotals[item.product_name] =
      (productTotals[item.product_name] || 0) + item.quantity
  })
  returnedItemsResult.rows.forEach((item) => {
    productTotals[item.product_name] = (productTotals[item.product_name] || 0) - item.quantity
  })

  const topFive = Object.entries(productTotals)
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Reports
      </h1>

      {loadError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Some report data failed to load: {friendlyError(loadError)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Today
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {money(Number(todayRow?.total_revenue || 0))}
          </p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
            {todayRow?.num_sales || 0} sales
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Last 7 days
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {money(weekTotal)}
          </p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
            {weekSales} sales
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Low stock items
          </p>
          <p className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-300">
            {(lowStock || []).length}
          </p>
          <Link
            href="/dashboard/products"
            className="mt-1 inline-block text-sm text-emerald-600 hover:underline dark:text-emerald-400"
          >
            View products →
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Inventory value
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {money(stockValuation.total)}
          </p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            {stockValuation.missingCostCount > 0
              ? `Excludes ${stockValuation.missingCostCount} product${stockValuation.missingCostCount === 1 ? '' : 's'} with no cost price`
              : 'At cost price'}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Last 7 days</h2>
        <div className="mt-3">
          <SalesTrendChart data={rows} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Top selling products (last 7 days)
          </h2>

          <div className="mt-3 space-y-2">
            {topFive.map(([name, qty]) => (
              <div
                key={name}
                className="flex justify-between text-sm"
              >
                <span className="text-neutral-700 dark:text-neutral-300">
                  {name}
                </span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {qty} sold
                </span>
              </div>
            ))}

            {topFive.length === 0 && (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">
                No sales yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Low stock alerts
          </h2>

          <div className="mt-3 space-y-2">
            {((lowStock as LowStockProduct[]) || []).map((p) => (
              <div
                key={p.id}
                className="flex justify-between text-sm"
              >
                <span className="text-neutral-700 dark:text-neutral-300">
                  {p.name}
                </span>
                <span className="font-medium text-red-600 dark:text-red-300">
                  {p.stock_quantity} left
                </span>
              </div>
            ))}

            {(lowStock || []).length === 0 && (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">
                Nothing low right now.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Today by payment method
          </h2>

          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Cash
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {money(todayPaymentTotals.cash)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Card
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {money(todayPaymentTotals.card)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Transfer
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {money(todayPaymentTotals.transfer)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Last 7 days by payment method
          </h2>

          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Cash
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {money(paymentTotals.cash)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Card
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {money(paymentTotals.card)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Transfer
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {money(paymentTotals.transfer)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Sales by cashier (last 7 days)
        </h2>

        <div className="mt-3 space-y-2">
          {cashierBreakdown.map((c) => (
            <div key={c.name} className="flex justify-between text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">
                {c.name} <span className="text-neutral-400 dark:text-neutral-500">· {c.count} sale{c.count === 1 ? '' : 's'}</span>
                {c.discount > 0 && (
                  <span className="block text-xs text-amber-600 dark:text-amber-400">
                    {money(c.discount)} discounted across {c.discountedSales} sale
                    {c.discountedSales === 1 ? '' : 's'}
                  </span>
                )}
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{money(c.revenue)}</span>
            </div>
          ))}

          {cashierBreakdown.length === 0 && (
            <p className="text-sm text-neutral-400 dark:text-neutral-500">No sales yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/dashboard/sales"
          className="inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          View Full Sales History
        </Link>
      </div>
    </div>
  )
}