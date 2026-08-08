import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type Movement = {
  id: string
  created_at: string
  product_name: string
  sku: string | null
  movement_type: 'restock' | 'sale' | 'adjustment' | 'damaged'
  quantity_change: number
  previous_stock: number
  new_stock: number
  note: string | null
  performed_by_name: string | null
  performed_by_role: string | null
}

type RawStockMovement = {
  id: string
  created_at: string
  movement_type: 'restock' | 'sale' | 'adjustment' | 'damaged'
  quantity_change: number
  previous_stock: number
  new_stock: number
  note: string | null
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
  damaged: 'bg-red-50 text-red-700',
}

export default async function StockHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string
    type?: string
  }>
}) {
  const {
    product: productId,
    type: searchParamsType,
  } = await searchParams

  const supabase = await createClient()

  let rows: Movement[] = []

  if (productId) {
    const { data: movements } = await supabase
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

    rows = ((movements as unknown as RawStockMovement[]) || []).map((m) => ({
      id: m.id,
      created_at: m.created_at,
      product_name: m.products?.name || '',
      sku: m.products?.sku || null,
      movement_type: m.movement_type,
      quantity_change: m.quantity_change,
      previous_stock: m.previous_stock,
      new_stock: m.new_stock,
      note: m.note,
      performed_by_name: m.profiles?.full_name || null,
      performed_by_role: m.profiles?.role || null,
    }))
  } else {
    const { data: movements } = await supabase
      .from('stock_movement_log')
      .select('*')
      .limit(200)

    rows = (movements as Movement[]) || []
  }

  const filteredRows =
    searchParamsType && searchParamsType !== 'all'
      ? rows.filter((r) => r.movement_type === searchParamsType)
      : rows

  const productName = rows[0]?.product_name

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/products"
            className="text-sm text-neutral-500 hover:underline"
          >
            ← Products
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
            href={`/api/stock-history-csv${
              productId ? `?product=${productId}` : ''
            }${
              searchParamsType && searchParamsType !== 'all'
                ? `${productId ? '&' : '?'}type=${searchParamsType}`
                : ''
            }`}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Download CSV
          </a>

          <Link
            href="/dashboard/products/receive-stock"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            + Receive Stock
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          ['all', 'restock', 'sale', 'return', 'adjustment', 'damaged'] as const
        ).map((type) => (
          <Link
            key={type}
            href={`/dashboard/products/stock-history${
              productId ? `?product=${productId}&` : '?'
            }type=${type}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
              (searchParamsType || 'all') === type
                ? 'bg-emerald-500 text-white'
                : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {type}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Date</th>
              {!productId && <th className="px-4 py-3">Product</th>}
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">Stock After</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((m) => (
              <tr
                key={m.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                  {new Date(m.created_at).toLocaleString('en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
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
                      : 'text-red-600'
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

                <td className="px-4 py-3 text-neutral-400">
                  {m.note || '—'}
                </td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={productId ? 6 : 7}
                  className="px-4 py-8 text-center text-neutral-400"
                >
                  No stock movements found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}