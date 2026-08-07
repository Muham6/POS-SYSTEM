import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
    { data: summary },
    { data: lowStock },
    { data: topProducts },
    { data: paymentRows },
    { data: profitRows },
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
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
        Reports
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Today
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900">
            ₦{Number(todayRow?.total_revenue || 0).toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            {todayRow?.num_sales || 0} sales
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Last 7 days
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900">
            ₦{weekTotal.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            {weekSales} sales
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Low stock items
          </p>
          <p className="mt-2 text-2xl font-semibold text-red-600">
            {(lowStock || []).length}
          </p>
          <Link
            href="/dashboard/products"
            className="mt-1 inline-block text-sm text-emerald-600 hover:underline"
          >
            View products →
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Profit (7 days)
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900">
            ₦{weekProfit.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Today: ₦{Number(todayProfitRow?.profit || 0).toLocaleString()} · approximate
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Top selling products
          </h2>

          <div className="mt-3 space-y-2">
            {topFive.map(([name, qty]) => (
              <div
                key={name}
                className="flex justify-between text-sm"
              >
                <span className="text-neutral-700">
                  {name}
                </span>
                <span className="font-medium text-neutral-900">
                  {qty} sold
                </span>
              </div>
            ))}

            {topFive.length === 0 && (
              <p className="text-sm text-neutral-400">
                No sales yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Low stock alerts
          </h2>

          <div className="mt-3 space-y-2">
            {((lowStock as LowStockProduct[]) || []).map((p) => (
              <div
                key={p.id}
                className="flex justify-between text-sm"
              >
                <span className="text-neutral-700">
                  {p.name}
                </span>
                <span className="font-medium text-red-600">
                  {p.stock_quantity} left
                </span>
              </div>
            ))}

            {(lowStock || []).length === 0 && (
              <p className="text-sm text-neutral-400">
                Nothing low right now.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Today by payment method
          </h2>

          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">
                Cash
              </span>
              <span className="font-medium text-neutral-900">
                ₦{todayPaymentTotals.cash.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">
                Card
              </span>
              <span className="font-medium text-neutral-900">
                ₦{todayPaymentTotals.card.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">
                Transfer
              </span>
              <span className="font-medium text-neutral-900">
                ₦{todayPaymentTotals.transfer.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Last 7 days by payment method
          </h2>

          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">
                Cash
              </span>
              <span className="font-medium text-neutral-900">
                ₦{paymentTotals.cash.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">
                Card
              </span>
              <span className="font-medium text-neutral-900">
                ₦{paymentTotals.card.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">
                Transfer
              </span>
              <span className="font-medium text-neutral-900">
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