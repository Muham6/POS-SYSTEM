import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'

type Item = {
  id: string
  product_name: string
  system_quantity: number
  counted_quantity: number
}

type CountDetail = {
  id: string
  count_number: string
  created_at: string
  note: string | null
  status: string
  profiles: { full_name: string | null } | null
  stock_count_items: Item[] | null
}

export default async function StockCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin'

  const { data, error } = await supabase
    .from('stock_counts')
    .select(
      'id, count_number, created_at, note, status, profiles!stock_counts_counted_by_fkey ( full_name ), stock_count_items ( id, product_name, system_quantity, counted_quantity )'
    )
    .eq('id', id)
    .maybeSingle()

  const count = data as unknown as CountDetail | null

  if (error || !count) {
    return (
      <div>
        <Link href="/dashboard/stock-count" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Stock counts
        </Link>
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error ? `Couldn't load this count: ${error.message}` : 'Count not found.'}
        </p>
      </div>
    )
  }

  const items = count.stock_count_items || []
  // Variance is the whole point of the record, but it only means anything to
  // whoever can act on it.
  const discrepancies = items.filter((i) => i.counted_quantity !== i.system_quantity)
  const short = discrepancies.filter((i) => i.counted_quantity < i.system_quantity)
  const over = discrepancies.filter((i) => i.counted_quantity > i.system_quantity)

  return (
    <div>
      <Link href="/dashboard/stock-count" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
        ← Stock counts
      </Link>

      <h1 className="mt-2 font-mono text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {count.count_number}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {[
          new Date(count.created_at).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' }),
          isAdmin && count.profiles?.full_name ? `Counted by ${count.profiles.full_name}` : null,
          count.note,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {isAdmin ? (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Products counted</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{items.length}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Short on shelf</p>
            <p className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-300">{short.length}</p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Fewer than recorded</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">More than expected</p>
            <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">{over.length}</p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">More than recorded</p>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Submitted. The owner will compare this against the records — nothing on the system has changed.
        </p>
      )}

      {isAdmin && discrepancies.length > 0 && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This count has not changed any stock. To make the records match the shelf, use{' '}
          <Link href="/dashboard/stock-history/stock-take" className="font-medium underline">
            Stock Take
          </Link>
          , which is admin-only and does adjust stock.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Counted</th>
              {isAdmin && <th className="px-4 py-3 text-right">System said</th>}
              {isAdmin && <th className="px-4 py-3 text-right">Difference</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const diff = i.counted_quantity - i.system_quantity
              return (
                <tr key={i.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-100">{i.product_name}</td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-900 dark:text-neutral-100">
                    {i.counted_quantity}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right text-neutral-500 dark:text-neutral-400">
                      {i.system_quantity}
                    </td>
                  )}
                  {isAdmin && (
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        diff === 0
                          ? 'text-neutral-300 dark:text-neutral-600'
                          : diff < 0
                            ? 'text-red-600 dark:text-red-300'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {diff === 0 ? '—' : diff > 0 ? `+${diff}` : diff}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
