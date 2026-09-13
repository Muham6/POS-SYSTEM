import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import Receipt from '@/components/receipt'
import VoidSaleButton from '@/components/void-sale-button'
import { Undo2 } from 'lucide-react'

type SaleDetail = {
  id: string
  sale_number: string
  created_at: string
  subtotal: number
  discount: number
  total: number
  cash_amount: number
  card_amount: number
  transfer_amount: number
  status: string
  void_reason: string | null
  profiles: { full_name: string | null } | null
  customers: { name: string | null; company_or_store: string | null; phone: string | null } | null
}

type ReturnRecord = {
  id: string
  return_number: string
  created_at: string
  total_refund: number
  reason: string | null
  restocked: boolean
  return_items: { sale_item_id: string; product_name: string; quantity: number }[] | null
}

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getProfile()

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select(
      `
      id, sale_number, created_at, subtotal, discount, total,
      cash_amount, card_amount, transfer_amount, payment_method,
      status, void_reason,
      profiles!sales_cashier_id_fkey ( full_name ),
      customers ( name, company_or_store, phone )
      `
    )
    .eq('id', id)
    .single()

  const { data: items } = await supabase
    .from('sale_items')
    .select('id, product_name, unit_price, quantity, line_total, unit_name')
    .eq('sale_id', id)

  const { data: returns } = await supabase
    .from('returns')
    .select('id, return_number, created_at, total_refund, reason, restocked, return_items ( sale_item_id, product_name, quantity )')
    .eq('sale_id', id)
    .order('created_at', { ascending: false })

  const { data: storeSettings } = await supabase.from('store_settings').select('*').eq('id', 1).single()

  if (saleError) {
    return <p className="text-sm text-red-600 dark:text-red-300">Error loading sale: {saleError.message}</p>
  }

  if (!sale) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sale not found.</p>
  }

  const s = sale as unknown as SaleDetail
  const returnRecords = (returns || []) as unknown as ReturnRecord[]

  // sale_status is completed | refunded | cancelled.
  const isCancelled = s.status === 'cancelled'
  const isRefunded = s.status === 'refunded'
  const isOpen = s.status === 'completed'

  const totalSold = (items || []).reduce((sum, it) => sum + it.quantity, 0)
  const totalReturned = returnRecords.reduce(
    (sum, r) => sum + (r.return_items || []).reduce((n, ri) => n + ri.quantity, 0),
    0
  )
  const partiallyReturned = isOpen && totalReturned > 0
  const refundedSoFar = returnRecords.reduce((sum, r) => sum + Number(r.total_refund), 0)

  return (
    <div className="max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/dashboard/sales" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Sales History
        </Link>

        <div className="flex items-center gap-4">
          {isOpen && totalReturned < totalSold && (
            <Link
              href={`/dashboard/sales/${s.id}/return`}
              className="flex items-center gap-1 text-sm text-amber-600 hover:underline dark:text-amber-400"
            >
              <Undo2 size={15} />
              Return items
            </Link>
          )}
          {profile?.role === 'admin' && isOpen && <VoidSaleButton saleId={s.id} />}
        </div>
      </div>

      {(isCancelled || isRefunded || partiallyReturned) && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            isCancelled
              ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
          }`}
        >
          {isCancelled && <span className="font-medium">This sale was voided.</span>}
          {isRefunded && <span className="font-medium">Fully refunded — every item has been returned.</span>}
          {partiallyReturned && (
            <span className="font-medium">
              Partially returned — {totalReturned} of {totalSold} item{totalSold === 1 ? '' : 's'} came back.
            </span>
          )}
          {isCancelled && s.void_reason && <span className="block">Reason: {s.void_reason}</span>}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <p>Cashier: {s.profiles?.full_name || '—'}</p>
        {s.customers && (
          <p className="mt-1">
            Customer: {s.customers.name || s.customers.company_or_store}
            {s.customers.phone && ` · ${s.customers.phone}`}
          </p>
        )}
      </div>

      {returnRecords.length > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Returns
            </h2>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              ₦{refundedSoFar.toLocaleString()} refunded
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {returnRecords.map((r) => (
              <div key={r.id} className="border-t border-neutral-100 pt-3 text-sm first:border-0 first:pt-0 dark:border-neutral-800">
                <div className="flex justify-between">
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{r.return_number}</span>
                  <span className="text-neutral-900 dark:text-neutral-100">₦{Number(r.total_refund).toLocaleString()}</span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {new Date(r.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                  {!r.restocked && ' · not restocked'}
                </p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  {(r.return_items || []).map((ri) => `${ri.product_name} × ${ri.quantity}`).join(', ')}
                </p>
                {r.reason && <p className="mt-1 text-xs italic text-neutral-500 dark:text-neutral-400">{r.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Receipt
        saleNumber={s.sale_number}
        dateLabel={new Date(s.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
        items={(items || []).map((it) => ({
          product_name: it.product_name,
          quantity: it.quantity,
          unit_name: it.unit_name,
          price: Number(it.unit_price),
        }))}
        subtotal={Number(s.subtotal)}
        discount={Number(s.discount)}
        total={Number(s.total)}
        cash={Number(s.cash_amount)}
        card={Number(s.card_amount)}
        transfer={Number(s.transfer_amount)}
        customerLabel={s.customers ? s.customers.name || s.customers.company_or_store : null}
        storeSettings={storeSettings}
        voided={isCancelled}
      />
    </div>
  )
}
