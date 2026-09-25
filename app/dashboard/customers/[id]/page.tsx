import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { money } from '@/lib/money'
import { ShoppingBag } from 'lucide-react'

type SaleItem = {
  product_name: string
  quantity: number
  unit_name: string | null
  line_total: number | string | null
}

type Visit = {
  id: string
  sale_number: string
  created_at: string
  total: number | string | null
  status: string
  sale_items: SaleItem[] | null
}

export default async function CustomerStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: customer, error: customerError }, { data: saleData, error: salesError }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('id, name, company_or_store, phone, created_at')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('sales')
        .select('id, sale_number, created_at, total, status, sale_items ( product_name, quantity, unit_name, line_total )')
        .eq('customer_id', id)
        .order('created_at', { ascending: false }),
    ])

  if (customerError || !customer) {
    return (
      <div>
        <Link href="/dashboard/customers" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Customers
        </Link>
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {customerError ? `Couldn't load this customer: ${customerError.message}` : 'Customer not found.'}
        </p>
      </div>
    )
  }

  const visits = (saleData as unknown as Visit[]) || []
  const paidVisits = visits.filter((v) => v.status !== 'refunded')

  const totalSpent = paidVisits.reduce((sum, v) => sum + (Number(v.total) || 0), 0)
  const averageBasket = paidVisits.length > 0 ? totalSpent / paidVisits.length : 0

  // What she buys most often, by quantity across every visit.
  const productTotals = new Map<string, number>()
  visits.forEach((v) => {
    if (v.status === 'refunded') return
    ;(v.sale_items || []).forEach((i) => {
      productTotals.set(i.product_name, (productTotals.get(i.product_name) || 0) + i.quantity)
    })
  })
  const favourites = [...productTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const displayName = customer.name || customer.company_or_store || 'Unnamed customer'
  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <Link href="/dashboard/customers" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
        ← Customers
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{displayName}</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {[
            customer.name && customer.company_or_store ? customer.company_or_store : null,
            customer.phone,
            `Customer since ${new Date(customer.created_at).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {salesError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Couldn&apos;t load their purchases: {salesError.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Total spent</p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{money(totalSpent)}</p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Refunds excluded</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Visits</p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{visits.length}</p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            {visits.length > paidVisits.length
              ? `${visits.length - paidVisits.length} fully refunded`
              : 'All completed'}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Average basket</p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{money(averageBasket)}</p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Per visit</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Last seen</p>
          <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {visits[0]
              ? new Date(visits[0].created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            {visits[0] ? new Date(visits[0].created_at).toLocaleTimeString('en-NG', { timeStyle: 'short' }) : 'Never bought'}
          </p>
        </div>
      </div>

      {favourites.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            What they buy most
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {favourites.map(([name, qty]) => (
              <span
                key={name}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
              >
                {name} <span className="text-neutral-400 dark:text-neutral-500">× {qty}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        Every visit
      </h2>

      {visits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <ShoppingBag size={28} className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            They haven&apos;t bought anything yet. Attach them to a sale on the Sell screen and it will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => {
            const refunded = v.status === 'refunded'
            return (
              <div
                key={v.id}
                className={`rounded-xl border p-5 ${
                  refunded
                    ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50'
                    : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">{dateLabel(v.created_at)}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {new Date(v.created_at).toLocaleTimeString('en-NG', { timeStyle: 'short' })} · {v.sale_number}
                      {refunded && (
                        <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                          Refunded
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        refunded
                          ? 'text-neutral-400 line-through dark:text-neutral-500'
                          : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {money(Number(v.total) || 0)}
                    </p>
                    <Link
                      href={`/dashboard/sales/${v.id}`}
                      className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      View receipt →
                    </Link>
                  </div>
                </div>

                <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  {(v.sale_items || []).map((i, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {i.product_name} <span className="text-neutral-400 dark:text-neutral-500">× {i.quantity} {i.unit_name || ''}</span>
                      </span>
                      <span className="text-neutral-700 dark:text-neutral-300">{money(Number(i.line_total) || 0)}</span>
                    </div>
                  ))}
                  {(v.sale_items || []).length === 0 && (
                    <p className="text-sm text-neutral-400 dark:text-neutral-500">No item details recorded.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
