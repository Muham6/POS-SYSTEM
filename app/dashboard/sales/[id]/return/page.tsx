import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ReturnForm from '@/components/return-form'

type PriorReturnItem = { sale_item_id: string; quantity: number }

export default async function ReturnSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: sale, error: saleError }, { data: items }, { data: priorReturns }] = await Promise.all([
    supabase.from('sales').select('id, sale_number, created_at, subtotal, total, status').eq('id', id).single(),
    supabase
      .from('sale_items')
      .select('id, product_name, unit_name, unit_price, quantity, line_total')
      .eq('sale_id', id)
      .order('product_name'),
    supabase.from('returns').select('id, return_items ( sale_item_id, quantity )').eq('sale_id', id),
  ])

  if (saleError) {
    return <p className="text-sm text-red-600 dark:text-red-300">Error loading sale: {saleError.message}</p>
  }
  if (!sale) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sale not found.</p>
  }

  // How much of each line has already gone back, so a second return can't
  // take more than what's left.
  const returnedByItem: Record<string, number> = {}
  for (const r of priorReturns || []) {
    for (const ri of (r.return_items || []) as PriorReturnItem[]) {
      returnedByItem[ri.sale_item_id] = (returnedByItem[ri.sale_item_id] || 0) + ri.quantity
    }
  }

  if (sale.status !== 'completed') {
    return (
      <div className="max-w-lg">
        <Link href={`/dashboard/sales/${id}`} className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Back to sale
        </Link>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          This sale is marked <span className="font-medium">{sale.status}</span>, so nothing further can be returned
          against it.
        </p>
      </div>
    )
  }

  const lines = (items || []).map((it) => ({
    id: it.id,
    product_name: it.product_name,
    unit_name: it.unit_name,
    unit_price: Number(it.unit_price),
    quantity: it.quantity,
    alreadyReturned: returnedByItem[it.id] || 0,
  }))

  // The sale may have carried a discount, so goods are refunded at the same
  // proportion of list price the customer actually paid.
  const subtotal = Number(sale.subtotal) || 0
  const refundRatio = subtotal > 0 ? Number(sale.total) / subtotal : 1

  return (
    <div className="max-w-2xl">
      <Link href={`/dashboard/sales/${id}`} className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
        ← Back to sale
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Return items</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Sale {sale.sale_number} ·{' '}
        {new Date(sale.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
      </p>

      <ReturnForm saleId={id} lines={lines} refundRatio={refundRatio} />
    </div>
  )
}
