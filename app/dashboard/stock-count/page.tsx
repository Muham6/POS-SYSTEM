import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { ClipboardList } from 'lucide-react'
import { friendlyError } from '@/lib/friendly-error'

type CountRow = {
  id: string
  count_number: string
  created_at: string
  note: string | null
  status: string
  profiles: { full_name: string | null } | null
  stock_count_items: { id: string }[] | null
}

export default async function StockCountsPage() {
  const supabase = await createClient()
  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin'

  // RLS already limits a cashier to their own counts; no filter needed here.
  const { data, error } = await supabase
    .from('stock_counts')
    .select('id, count_number, created_at, note, status, profiles!stock_counts_counted_by_fkey ( full_name ), stock_count_items ( id )')
    .order('created_at', { ascending: false })
    .limit(100)

  const counts = (data as unknown as CountRow[]) || []

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Stock counts</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            {isAdmin
              ? 'What staff counted on the shelf, against what the system believed at the time. Counts never change stock on their own.'
              : 'Counts you have submitted. These do not change anything — they tell the owner where the shelf and the records disagree.'}
          </p>
        </div>

        <Link
          href="/dashboard/stock-count/new"
          className="whitespace-nowrap rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Start a count
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Couldn&apos;t load stock counts: {friendlyError(error.message)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">When</th>
              {isAdmin && <th className="px-4 py-3">Counted by</th>}
              <th className="px-4 py-3 text-right">Products</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((c) => (
              <tr
                key={c.id}
                className="border-t border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/stock-count/${c.id}`}
                    className="font-mono text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {c.count_number}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                  {new Date(c.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{c.profiles?.full_name || '—'}</td>
                )}
                <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">
                  {(c.stock_count_items || []).length}
                </td>
                <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{c.note || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === 'reviewed'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    {c.status === 'reviewed' ? 'Reviewed' : 'Awaiting review'}
                  </span>
                </td>
              </tr>
            ))}

            {counts.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-12 text-center">
                  <ClipboardList size={28} className="mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">
                    No counts yet. Use &quot;Start a count&quot; to record what&apos;s on the shelf.
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
