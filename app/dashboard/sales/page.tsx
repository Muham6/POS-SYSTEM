import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Eye, ReceiptText } from 'lucide-react'
import { money } from '@/lib/money'
import { fetchAllRows } from '@/lib/fetch-all'
import { getProfile } from '@/lib/auth'
import { friendlyError } from '@/lib/friendly-error'

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
  searchParams: Promise<{ from?: string; to?: string; staff?: string; show?: string }>
}) {
  const { from, to, staff, show } = await searchParams
  // Voided and fully refunded sales are kept for the audit trail and the till
  // reconciliation, but hidden from the list unless asked for.
  const showAll = show === 'all'
  const supabase = await createClient()
  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin'
  // A cashier sees only what they rang up — not other staff's takings, and not
  // the shop's overall revenue.
  const ownOnly = !isAdmin && profile ? profile.id : null
  // An admin can narrow the list to one member of staff. Ignored for a
  // cashier, who is already limited to their own sales above. A mangled id in
  // the URL would fail the whole query, so only a real UUID counts.
  const staffFilter = isAdmin && staff && /^[0-9a-f-]{36}$/i.test(staff) ? staff : null
  const cashierFilter = ownOnly || staffFilter

  const { data: staffList } = isAdmin
    ? await supabase.from('profiles').select('id, full_name, role').order('full_name')
    : { data: null }
  const admins = (staffList || []).filter((p) => p.role === 'admin')
  const cashiers = (staffList || []).filter((p) => p.role !== 'admin')

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

  if (!showAll) query = query.eq('status', 'completed')
  if (cashierFilter) query = query.eq('cashier_id', cashierFilter)
  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const { data, error } = await query

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-300">Error loading sales: {friendlyError(error.message)}</p>
  }

  const sales = (data as unknown as Sale[]) || []

  // The table shows the 200 most recent, but the headline figure has to cover
  // the whole date range — summing only the rows on screen would quietly
  // report a fraction of the takings as if it were the total.
  const totalsResult = await fetchAllRows<{ total: number | string | null; status: string }>(
    (fromRow, toRow) => {
      let q = supabase
        .from('sales')
        .select('total, status')
        .order('created_at', { ascending: false })
        .range(fromRow, toRow)
      if (cashierFilter) q = q.eq('cashier_id', cashierFilter)
      if (from) q = q.gte('created_at', `${from}T00:00:00`)
      if (to) q = q.lte('created_at', `${to}T23:59:59`)
      return q
    }
  )

  // Money already handed back on sales that are still open (part-returned).
  // A fully returned sale is 'refunded' and a voided one is 'cancelled'; both
  // are left out of the total entirely, so only refunds against 'completed'
  // sales need taking off.
  const refundsResult = await fetchAllRows<{ total_refund: number | string | null }>((fromRow, toRow) => {
    let q = supabase
      .from('returns')
      .select('total_refund, sales!inner ( created_at, cashier_id, status )')
      .eq('sales.status', 'completed')
      .order('created_at', { ascending: false })
      .range(fromRow, toRow)
    if (cashierFilter) q = q.eq('sales.cashier_id', cashierFilter)
    if (from) q = q.gte('sales.created_at', `${from}T00:00:00`)
    if (to) q = q.lte('sales.created_at', `${to}T23:59:59`)
    return q
  })

  // Per-row refunds for the sales on screen, so a part-returned sale shows
  // what it is actually worth now.
  const { data: rowReturns } = sales.length
    ? await supabase.from('returns').select('sale_id, total_refund').in('sale_id', sales.map((s) => s.id))
    : { data: [] as { sale_id: string; total_refund: number }[] }
  const refundedBySale = new Map<string, number>()
  for (const r of rowReturns || []) {
    refundedBySale.set(r.sale_id, (refundedBySale.get(r.sale_id) || 0) + (Number(r.total_refund) || 0))
  }

  const totalsError = totalsResult.error || refundsResult.error
  const countedSales = totalsResult.rows.filter((s) => s.status === 'completed')
  const partRefunds = refundsResult.rows.reduce((sum, r) => sum + (Number(r.total_refund) || 0), 0)
  const totalRevenue =
    countedSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0) - partRefunds
  const listIsPartial = (showAll ? totalsResult.rows.length : countedSales.length) > sales.length
  const hiddenCount = totalsResult.rows.length - countedSales.length

  // Same filters, with the voided/refunded toggle flipped.
  const toggleParams = new URLSearchParams()
  if (from) toggleParams.set('from', from)
  if (to) toggleParams.set('to', to)
  if (staffFilter) toggleParams.set('staff', staffFilter)
  if (!showAll) toggleParams.set('show', 'all')
  const toggleHref = `/dashboard/sales${toggleParams.size ? `?${toggleParams}` : ''}`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            ← Overview
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {isAdmin ? 'Sales History' : 'My Sales'}
          </h1>
        </div>

        <a
          href={`/api/sales-csv${from || to || staffFilter ? `?from=${from || ''}&to=${to || ''}${staffFilter ? `&staff=${staffFilter}` : ''}` : ''}`}
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
        {isAdmin && (
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Staff</label>
            <select
              name="staff"
              defaultValue={staffFilter || ''}
              className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
            >
              <option value="">Everyone</option>
              {admins.length > 0 && (
                <optgroup label="Admins">
                  {admins.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || 'Unnamed'}
                    </option>
                  ))}
                </optgroup>
              )}
              {cashiers.length > 0 && (
                <optgroup label="Cashiers">
                  {cashiers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || 'Unnamed'}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}
        {showAll && <input type="hidden" name="show" value="all" />}
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Filter
        </button>
        {(from || to || staffFilter) && (
          <Link href="/dashboard/sales" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            Clear filter
          </Link>
        )}
        <p className="ml-auto text-sm text-neutral-500 dark:text-neutral-400">
          {countedSales.length} sale{countedSales.length === 1 ? '' : 's'} · {money(totalRevenue)}
          {totalsError && (
            <span className="block text-xs text-red-600 dark:text-red-300">
              Total may be incomplete: {friendlyError(totalsError)}
            </span>
          )}
          {listIsPartial && (
            <span className="block text-xs text-neutral-400 dark:text-neutral-500">
              Showing the {sales.length} most recent below — the total above covers the whole range.
            </span>
          )}
        </p>
      </form>

      {(showAll || hiddenCount > 0) && (
        <div className="mb-4 text-right">
          <Link href={toggleHref} className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            {showAll
              ? 'Hide voided & refunded'
              : `Show ${hiddenCount} voided & refunded`}
          </Link>
        </div>
      )}

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
            {sales.map((s) => {
              const refunded = refundedBySale.get(s.id) || 0
              const notCounted = s.status === 'cancelled' || s.status === 'refunded'
              return (
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
                  {notCounted ? (
                    <span className="text-neutral-400 line-through dark:text-neutral-500">{money(Number(s.total))}</span>
                  ) : refunded > 0 ? (
                    <>
                      {money(Number(s.total) - refunded)}
                      <span className="block text-xs font-normal text-neutral-400 dark:text-neutral-500">
                        of {money(Number(s.total))}
                      </span>
                    </>
                  ) : (
                    money(Number(s.total))
                  )}
                </td>
                <td className="px-4 py-3">
                  {s.status === 'cancelled' && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">Voided</span>
                  )}
                  {s.status === 'refunded' && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Refunded</span>
                  )}
                  {s.status === 'completed' && refunded > 0 && (
                    <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Part refunded</span>
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
              )
            })}
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