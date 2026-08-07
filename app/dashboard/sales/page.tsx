import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
  status: string // Added status field
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
      profiles ( full_name ),
      customers ( name, company_or_store )
    `
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const { data } = await query
  const sales = (data as unknown as Sale[]) || []

  // Exclude voided sales from total revenue
  const totalRevenue = sales.filter((s) => s.status !== 'voided').reduce((sum, s) => sum + Number(s.total), 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
            ← Overview
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Sales History</h1>
        </div>
        
        <a
          href={`/api/sales-csv${from || to ? `?from=${from || ''}&to=${to || ''}` : ''}`}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Download CSV
        </a>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Filter
        </button>
        {(from || to) && (
          <Link href="/dashboard/sales" className="text-sm text-neutral-500 hover:underline">
            Clear filter
          </Link>
        )}
        <p className="ml-auto text-sm text-neutral-500">
          {sales.length} sale{sales.length === 1 ? '' : 's'} · ₦{totalRevenue.toLocaleString()}
        </p>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
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
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-neutral-500">
                  {new Date(s.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-600">{s.sale_number}</td>
                <td className="px-4 py-3 text-neutral-700">{s.profiles?.full_name || '—'}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {s.customers?.name || s.customers?.company_or_store || '—'}
                </td>
                <td className="px-4 py-3 capitalize text-neutral-500">{s.payment_method}</td>
                <td className="px-4 py-3 text-right font-medium text-neutral-900">
                  ₦{Number(s.total).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {s.status === 'voided' && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Voided</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/sales/${s.id}`} className="text-emerald-600 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-400">
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