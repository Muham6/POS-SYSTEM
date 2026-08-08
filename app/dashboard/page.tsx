import Link from 'next/link'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SalesTrendChart from '@/components/sales-trend-chart'
import { ShoppingCart, TrendingUp, AlertTriangle, Wallet } from 'lucide-react'

export default async function DashboardOverview() {
  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin'
  const supabase = await createClient()

 
const today = new Date().toISOString().slice(0, 10)
// eslint-disable-next-line react-hooks/purity
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  let todayTotal = 0
  let todayCount = 0
  let todayProfit = 0
  let lowStockCount = 0
  let trendData: { sale_day: string; total_revenue: number }[] = []

  if (isAdmin) {
    const [{ data: summary }, { data: lowStock }, { data: profitRows }] = await Promise.all([
      supabase.from('daily_sales_summary').select('*').gte('sale_day', weekAgo).order('sale_day', { ascending: false }),
      supabase.from('low_stock_products').select('id'),
      supabase.from('daily_profit_summary').select('*').eq('sale_day', today),
    ])
    const todayRow = (summary || []).find((r) => r.sale_day === today)
    todayTotal = Number(todayRow?.total_revenue) || 0
    todayCount = Number(todayRow?.num_sales) || 0
    todayProfit = Number(profitRows?.[0]?.profit) || 0
    lowStockCount = (lowStock || []).length
    trendData = summary || []
  }

  return (
    <div>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {profile?.full_name ? `Hi, ${profile.full_name.split(' ')[0]}` : 'Welcome'}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          href="/dashboard/sell"
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
        >
          <ShoppingCart size={18} />
          New Sale
        </Link>
      </div>

      {isAdmin && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-2 text-neutral-500">
                <Wallet size={16} />
                <p className="text-xs uppercase tracking-wider">Today</p>
              </div>
              <p className="mt-2 text-xl font-semibold text-neutral-900 sm:text-2xl">
                ₦{todayTotal.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-neutral-400">{todayCount} sale{todayCount === 1 ? '' : 's'}</p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-2 text-neutral-500">
                <TrendingUp size={16} />
                <p className="text-xs uppercase tracking-wider">Profit today</p>
              </div>
              <p className="mt-2 text-xl font-semibold text-neutral-900 sm:text-2xl">
                ₦{todayProfit.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-neutral-400">approximate</p>
            </div>

            <Link
              href="/dashboard/products"
              className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-red-300"
            >
              <div className={`flex items-center gap-2 ${lowStockCount > 0 ? 'text-red-500' : 'text-neutral-500'}`}>
                <AlertTriangle size={16} />
                <p className="text-xs uppercase tracking-wider">Low stock</p>
              </div>
              <p className={`mt-2 text-xl font-semibold sm:text-2xl ${lowStockCount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                {lowStockCount}
              </p>
              <p className="mt-1 text-xs text-neutral-400">tap to view</p>
            </Link>

            <Link
              href="/dashboard/reports"
              className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-emerald-300"
            >
              <div className="flex items-center gap-2 text-neutral-500">
                <TrendingUp size={16} />
                <p className="text-xs uppercase tracking-wider">Full reports</p>
              </div>
              <p className="mt-3 text-sm font-medium text-emerald-600">View trends →</p>
            </Link>
          </div>

          <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Last 7 days</h2>
            <div className="mt-3">
              <SalesTrendChart data={trendData} />
            </div>
          </div>
        </>
      )}

      {!isAdmin && (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <ShoppingCart size={28} className="mx-auto mb-3 text-neutral-300" />
          <p className="text-sm text-neutral-500">Ready when you are — tap New Sale above to get started.</p>
        </div>
      )}
    </div>
  )
}