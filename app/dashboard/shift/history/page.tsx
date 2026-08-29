import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { History } from 'lucide-react'

type Shift = {
  id: string
  opened_at: string
  closed_at: string | null
  opening_float: number
  expected_cash: number | null
  counted_cash: number | null
  variance: number | null
  status: string
  profiles: { full_name: string | null } | null
}

export default async function ShiftHistoryPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shifts')
    .select('id, opened_at, closed_at, opening_float, expected_cash, counted_cash, variance, status, profiles ( full_name )')
    .order('opened_at', { ascending: false })
    .limit(100)

  const shifts = (data as unknown as Shift[]) || []

  return (
    <div>
      <Link href="/dashboard/shift" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
        ← My Shift
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Shift History</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Could not load shift history: {error.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
              <th className="px-4 py-3">Cashier</th>
              <th className="px-4 py-3">Opened</th>
              <th className="px-4 py-3">Closed</th>
              <th className="px-4 py-3 text-right">Expected</th>
              <th className="px-4 py-3 text-right">Counted</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">{s.profiles?.full_name || '—'}</td>
                <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                  {new Date(s.opened_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                  {s.closed_at ? new Date(s.closed_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                  {s.expected_cash != null ? `₦${Number(s.expected_cash).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                  {s.counted_cash != null ? `₦${Number(s.counted_cash).toLocaleString()}` : '—'}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${
                  s.variance == null ? 'text-neutral-300 dark:text-neutral-600' : Math.abs(s.variance) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-300'
                }`}>
                  {s.variance != null ? `${s.variance > 0 ? '+' : ''}₦${Number(s.variance).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === 'open' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 dark:text-neutral-500">
                  <History size={28} className="mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                  No shifts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}