import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { money } from '@/lib/money'
import { Users } from 'lucide-react'

type Customer = {
  id: string
  name: string | null
  company_or_store: string | null
  phone: string | null
  created_at: string
}

type SaleRow = {
  customer_id: string | null
  total: number | string | null
  status: string
  created_at: string
}

const PAGE_SIZE = 1000

// Supabase caps a select at 1000 rows. A shop that has been running a while
// will pass that, and a silently truncated list would understate what regulars
// have spent — so page through it.
async function fetchCustomerSales(supabase: Awaited<ReturnType<typeof createClient>>) {
  const rows: SaleRow[] = []

  for (let page = 0; page < 200; page++) {
    const { data, error } = await supabase
      .from('sales')
      .select('customer_id, total, status, created_at')
      .not('customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (error) return { rows, error: error.message }

    const batch = (data as SaleRow[]) || []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  return { rows, error: null }
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const search = (q || '').trim()
  const supabase = await createClient()

  const [{ data: customerData, error: customerError }, { rows: sales, error: salesError }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('id, name, company_or_store, phone, created_at')
        .order('created_at', { ascending: false }),
      fetchCustomerSales(supabase),
    ])

  const loadError = customerError?.message || salesError

  // A refunded sale is money given back, so it doesn't count as spend — but it
  // still counts as a visit, because she did come in.
  const stats = new Map<string, { spent: number; visits: number; last: string | null }>()
  sales.forEach((s) => {
    if (!s.customer_id) return
    const entry = stats.get(s.customer_id) || { spent: 0, visits: 0, last: null }
    if (s.status !== 'refunded') entry.spent += Number(s.total) || 0
    entry.visits += 1
    if (!entry.last || s.created_at > entry.last) entry.last = s.created_at
    stats.set(s.customer_id, entry)
  })

  const customers = ((customerData as Customer[]) || [])
    .filter((c) => {
      if (!search) return true
      const hay = `${c.name || ''} ${c.company_or_store || ''} ${c.phone || ''}`.toLowerCase()
      return hay.includes(search.toLowerCase())
    })
    .map((c) => ({ ...c, ...(stats.get(c.id) || { spent: 0, visits: 0, last: null }) }))
    .sort((a, b) => {
      // Most recently seen first — who's actually active matters more than who
      // was added first.
      if (a.last && b.last) return a.last > b.last ? -1 : 1
      if (a.last) return -1
      if (b.last) return 1
      return 0
    })

  const withPurchases = customers.filter((c) => c.visits > 0).length
  const totalSpend = customers.reduce((sum, c) => sum + c.spent, 0)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Customers</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {customers.length} {customers.length === 1 ? 'customer' : 'customers'} · {withPurchases} have
            bought something · {money(totalSpend)} spent in total
          </p>
        </div>

        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name, store or phone…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-64 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            Search
          </button>
        </form>
      </div>

      {loadError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Couldn&apos;t load customers: {loadError}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3 text-right">Visits</th>
              <th className="px-4 py-3 text-right">Total spent</th>
              <th className="px-4 py-3">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                className="border-t border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/customers/${c.id}`}
                    className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {c.name || c.company_or_store || 'Unnamed'}
                  </Link>
                  {c.name && c.company_or_store && (
                    <span className="block text-xs text-neutral-400 dark:text-neutral-500">
                      {c.company_or_store}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">{c.visits}</td>
                <td className="px-4 py-3 text-right font-medium text-neutral-900 dark:text-neutral-100">
                  {money(c.spent)}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {c.last
                    ? new Date(c.last).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Never bought'}
                </td>
              </tr>
            ))}

            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Users size={28} className="mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">
                    {search
                      ? `No customer matches "${search}".`
                      : 'No customers yet. Add one while ringing up a sale on the Sell screen.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
