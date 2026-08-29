import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Eye, ReceiptText } from 'lucide-react'

type Sale = {
  id: string
  sale_number: string
  created_at: string
  subtotal: number
  discount: number
  total: number
  cash_amount: number
  card_amount: number
  transfer_amount: number
  payment_method: string
  status: string
  profiles: { full_name: string | null } | null
  customers: { name: string | null; company_or_store: string | null } | null
}

export default async function SalesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('sales')
    .select(
      `
      id, sale_number, created_at, subtotal, discount, total,
      cash_amount, card_amount, transfer_amount, payment_method, status,
      profiles!sales_cashier_id_fkey ( full_name ),
      customers ( name, company_or_store )
    `
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const { data, error } = await query

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-300">Error loading sales: {error.message}</p>
  }

  const sales = (data as unknown as Sale[]) || []

  // Exclude voided sales from total revenue
  const totalRevenue = sales.filter((s) => s.status !== 'voided').reduce((sum, s) => sum + Number(s.total), 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            ← Overview
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Sales History</h1>
        </div>

        <a
          href={`/api/sales-csv${from || to ? `?from=${from || ''}&to=${to || ''}` : ''}`}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Download CSV
        </a>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Filter
        </button>
        {(from || to) && (
          <Link href="/dashboard/sales" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            Clear filter
          </Link>
        )}
        <p className="ml-auto text-sm text-neutral-500 dark:text-neutral-400">
          {sales.length} sale{sales.length === 1 ? '' : 's'} · ₦{totalRevenue.toLocaleString()}
        </p>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Cashier</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-3 whitespace-nowrap text-neutral-500 dark:text-neutral-400">
                  {new Date(s.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">{s.sale_number}</td>
                <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{s.profiles?.full_name || '—'}</td>
                <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {s.customers?.name || s.customers?.company_or_store || '—'}
                </td>
                <td className="px-4 py-3 capitalize text-neutral-500 dark:text-neutral-400">{s.payment_method}</td>
                <td className="px-4 py-3 text-right font-medium text-neutral-900 dark:text-neutral-100">
                  ₦{Number(s.total).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {s.status === 'voided' && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">Voided</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/sales/${s.id}`}
                    className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                    title="View"
                    aria-label={`View sale ${s.sale_number}`}
                  >
                    <Eye size={16} />
                  </Link>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-neutral-400 dark:text-neutral-500">
                  <ReceiptText size={28} className="mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                  No sales in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}