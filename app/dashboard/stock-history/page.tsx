import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type Movement = {
  id: string
  created_at: string
  product_name: string
  sku: string | null
  movement_type:
    | 'restock'
    | 'sale'
    | 'return'
    | 'adjustment'
    | 'stock_take'
    | 'damaged'
  quantity_change: number
  previous_stock: number
  new_stock: number
  note: string | null
  batch_reference: string | null
  performed_by_name: string | null
  performed_by_role: string | null
}

type RawStockMovement = {
  id: string
  created_at: string
  movement_type:
    | 'restock'
    | 'sale'
    | 'return'
    | 'adjustment'
    | 'stock_take'
    | 'damaged'
  quantity_change: number
  previous_stock: number
  new_stock: number
  note: string | null
  batch_reference: string | null
  products: {
    name: string
    sku: string | null
  } | null
  profiles: {
    full_name: string | null
    role: string | null
  } | null
}

const typeStyles: Record<string, string> = {
  restock: 'bg-emerald-50 text-emerald-700',
  sale: 'bg-blue-50 text-blue-700',
  return: 'bg-amber-50 text-amber-700',
  adjustment: 'bg-amber-50 text-amber-700',
  stock_take: 'bg-purple-50 text-purple-700',
  damaged: 'bg-red-50 text-red-700',
}

export default async function StockHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string
    type?: string
    from?: string
    to?: string
    batch?: string
  }>
}) {
  const {
    product: productId,
    type,
    from,
    to,
    batch,
  } = await searchParams

  const supabase = await createClient()

  let rows: Movement[] = []
  let queryError: string | null = null
  let productName: string | undefined

  if (productId) {
    let q = supabase
      .from('stock_movements')
      .select(
        `
        id,
        created_at,
        movement_type,
        quantity_change,
        previous_stock,
        new_stock,
        note,
        batch_reference,
        products (
          name,
          sku
        ),
        profiles (
          full_name,
          role
        )
      `
      )
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (type && type !== 'all') {
      q = q.eq('movement_type', type)
    }

    if (from) {
      q = q.gte('created_at', `${from}T00:00:00`)
    }

    if (to) {
      q = q.lte('created_at', `${to}T23:59:59`)
    }

    if (batch) {
      q = q.eq('batch_reference', batch)
    }

    const [{ data, error }, { data: productData }] = await Promise.all([
      q,
      supabase
        .from('products')
        .select('name')
        .eq('id', productId)
        .maybeSingle(),
    ])

    if (error) queryError = error.message
    productName = productData?.name

    rows = ((data as unknown as RawStockMovement[]) || []).map((m) => ({
      id: m.id,
      created_at: m.created_at,
      product_name: m.products?.name || '',
      sku: m.products?.sku || null,
      movement_type: m.movement_type,
      quantity_change: m.quantity_change,
      previous_stock: m.previous_stock,
      new_stock: m.new_stock,
      note: m.note,
      batch_reference: m.batch_reference,
      performed_by_name: m.profiles?.full_name || null,
      performed_by_role: m.profiles?.role || null,
    }))
  } else {
    let q = supabase
      .from('stock_movement_log')
      .select('*')
      .limit(200)

    if (type && type !== 'all') {
      q = q.eq('movement_type', type)
    }

    if (from) {
      q = q.gte('created_at', `${from}T00:00:00`)
    }

    if (to) {
      q = q.lte('created_at', `${to}T23:59:59`)
    }

    if (batch) {
      q = q.eq('batch_reference', batch)
    }

    const { data, error } = await q

    if (error) queryError = error.message

    rows = (data as Movement[]) || []
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-neutral-500 hover:underline"
          >
            ← Overview
          </Link>

          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
            Stock History{' '}
            {productId && productName && (
              <span className="text-neutral-400">
                · {productName}
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`/api/stock-history-csv?${new URLSearchParams({
              ...(productId && { product: productId }),
              ...(type && type !== 'all' && { type }),
              ...(from && { from }),
              ...(to && { to }),
              ...(batch && { batch }),
            }).toString()}`}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Download CSV
          </a>

          <Link
            href="/dashboard/stock-history/stock-take"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Stock Take
          </Link>

          <Link
            href="/dashboard/stock-history/receive"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            + Receive Stock
          </Link>
        </div>
      </div>

      {queryError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          Couldn&apos;t load stock history: {queryError}
        </p>
      )}

      {/* Movement type filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            'all',
            'restock',
            'sale',
            'return',
            'adjustment',
            'stock_take',
            'damaged',
          ] as const
        ).map((t) => {
          const params = new URLSearchParams()
          if (productId) params.set('product', productId)
          if (from) params.set('from', from)
          if (to) params.set('to', to)
          if (batch) params.set('batch', batch)
          if (t !== 'all') params.set('type', t)
          const qs = params.toString()

          return (
            <Link
              key={t}
              href={`/dashboard/stock-history${qs ? `?${qs}` : ''}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                (type || 'all') === t
                  ? 'bg-emerald-500 text-white'
                  : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {t}
            </Link>
          )
        })}
      </div>

      {/* Date + batch filters */}
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        {productId && (
          <input
            type="hidden"
            name="product"
            value={productId}
          />
        )}

        {type && (
          <input
            type="hidden"
            name="type"
            value={type}
          />
        )}

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            From
          </label>

          <input
            type="date"
            name="from"
            defaultValue={from}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            To
          </label>

          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            Delivery reference
          </label>

          <input
            type="text"
            name="batch"
            defaultValue={batch}
            placeholder="e.g. RCV-20260810-a1b2c3"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Filter
        </button>
      </form>

      {/* Stock history table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Date</th>

              {!productId && (
                <th className="px-4 py-3">Product</th>
              )}

              <th className="px-4 py-3">Type</th>

              <th className="px-4 py-3 text-right">
                Change
              </th>

              <th className="px-4 py-3 text-right">
                Stock after
              </th>

              <th className="px-4 py-3">
                By
              </th>

              <th className="px-4 py-3">
                Batch
              </th>

              <th className="px-4 py-3">
                Note
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((m) => (
              <tr
                key={m.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                  {new Date(m.created_at).toLocaleString(
                    'en-NG',
                    {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }
                  )}
                </td>

                {!productId && (
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {m.product_name}

                    {m.sku && (
                      <span className="ml-1 text-xs text-neutral-400">
                        ({m.sku})
                      </span>
                    )}
                  </td>
                )}

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      typeStyles[m.movement_type]
                    }`}
                  >
                    {m.movement_type}
                  </span>
                </td>

                <td
                  className={`px-4 py-3 text-right font-medium ${
                    m.quantity_change > 0
                      ? 'text-emerald-600'
                      : m.quantity_change < 0
                        ? 'text-red-600'
                        : 'text-neutral-400'
                  }`}
                >
                  {m.quantity_change > 0
                    ? `+${m.quantity_change}`
                    : m.quantity_change}
                </td>

                <td className="px-4 py-3 text-right text-neutral-900">
                  {m.new_stock}
                </td>

                <td className="px-4 py-3 text-neutral-500">
                  {m.performed_by_name || '—'}

                  {m.performed_by_role && (
                    <span className="ml-1 text-xs text-neutral-400">
                      ({m.performed_by_role})
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                  {m.batch_reference || '—'}
                </td>

                <td className="px-4 py-3 text-neutral-400">
                  {m.note || '—'}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={productId ? 7 : 8}
                  className="px-4 py-12 text-center text-neutral-400"
                >
                  No stock movements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}