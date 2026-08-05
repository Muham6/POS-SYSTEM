import Link from 'next/link'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardOverview() {
  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin'
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)

  let todayTotal = 0
  let todayCount = 0
  let lowStockCount = 0

  if (isAdmin) {
    const [{ data: todayRow }, { data: lowStock }] = await Promise.all([
      supabase.from('daily_sales_summary').select('*').eq('sale_day', today).maybeSingle(),
      supabase.from('low_stock_products').select('id'),
    ])
    todayTotal = Number(todayRow?.total_revenue) || 0
    todayCount = Number(todayRow?.num_sales) || 0
    lowStockCount = (lowStock || []).length
  }

  const cards = [
    { href: '/dashboard/sell', label: 'Sell', description: 'Ring up a sale', show: true },
    { href: '/dashboard/products', label: 'Products', description: 'Manage inventory & pricing', show: isAdmin },
    { href: '/dashboard/sales', label: 'Sales History', description: 'View past transactions', show: isAdmin },
    { href: '/dashboard/reports', label: 'Reports', description: "Today's numbers & trends", show: isAdmin },
    { href: '/dashboard/users', label: 'Users', description: 'Manage staff accounts', show: isAdmin },
  ].filter((c) => c.show)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900">
        Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Signed in as <span className="font-medium text-neutral-700">{profile?.role}</span>.
      </p>

      {isAdmin && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-neutral-500">Today&apos;s sales</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">₦{todayTotal.toLocaleString()}</p>
            <p className="mt-1 text-sm text-neutral-400">{todayCount} transaction{todayCount === 1 ? '' : 's'}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-neutral-500">Low stock</p>
            <p className={`mt-2 text-2xl font-semibold ${lowStockCount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
              {lowStockCount}
            </p>
            <p className="mt-1 text-sm text-neutral-400">item{lowStockCount === 1 ? '' : 's'} need restocking</p>
          </div>
          <Link
            href="/dashboard/reports"
            className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-emerald-400 hover:shadow-sm"
          >
            <p className="text-xs uppercase tracking-wider text-neutral-500">Full reports</p>
            <p className="mt-2 text-sm font-medium text-emerald-600">View trends & payment breakdown →</p>
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-emerald-400 hover:shadow-sm"
          >
            <p className="text-base font-semibold text-neutral-900">{card.label}</p>
            <p className="mt-1 text-sm text-neutral-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}