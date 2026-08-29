import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SalesTrendChart from '@/components/sales-trend-chart'

type LowStockProduct = {
  id: string
  name: string
  stock_quantity: number
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)
  // eslint-disable-next-line react-hooks/purity
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10)

  const [
    { data: summary, error: summaryError },
    { data: lowStock, error: lowStockError },
    { data: topProducts, error: topProductsError },
    { data: paymentRows, error: paymentError },
    { data: profitRows, error: profitError },
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

    supabase
      .from('sale_items')
      .select('product_name, quantity')
      .order('quantity', { ascending: false }),

    supabase
      .from('sales')
      .select('cash_amount, card_amount, transfer_amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', `${weekAgo}T00:00:00`),

    supabase
      .from('daily_profit_summary')
      .select('*')
      .gte('sale_day', weekAgo),
  ])

  const loadError = summaryError || lowStockError || topProductsError || paymentError || profitError

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

  const todayProfitRow = (profitRows || []).find((r) => r.sale_day === today)
  const weekProfit = (profitRows || []).reduce((sum, r) => sum + Number(r.profit || 0), 0)

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

  const todayPaymentTotals = (paymentRows || [])
    .filter((row) => row.created_at.slice(0, 10) === today)
    .reduce(
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

  const productTotals: Record<string, number> = {}

  ;(topProducts || []).forEach((item) => {
    productTotals[item.product_name] =
      (productTotals[item.product_name] || 0) + item.quantity
  })

  const topFive = Object.entries(productTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Reports
      </h1>

      {loadError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Some report data failed to load: {loadError.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Today
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            ₦{Number(todayRow?.total_revenue || 0).toLocaleString()}
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
            ₦{weekTotal.toLocaleString()}
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
            Profit (7 days)
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            ₦{weekProfit.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            Today: ₦{Number(todayProfitRow?.profit || 0).toLocaleString()} · approximate
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
            Top selling products
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
                ₦{todayPaymentTotals.cash.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Card
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                ₦{todayPaymentTotals.card.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Transfer
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                ₦{todayPaymentTotals.transfer.toLocaleString()}
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
                ₦{paymentTotals.cash.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Card
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                ₦{paymentTotals.card.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                Transfer
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                ₦{paymentTotals.transfer.toLocaleString()}
              </span>
            </div>
          </div>
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