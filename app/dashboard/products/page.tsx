import Link from 'next/link'
import { Pencil, History } from 'lucide-react'
import DeleteProductButton from '@/components/delete-product-button'
import CategoryFilter from '@/components/category-filter'
import { createClient } from '@/lib/supabase/server'

type Product = {
  id: string
  name: string
  sku: string | null
  price: number
  stock_quantity: number
  low_stock_threshold: number
  categories: { name: string } | null
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select(`id, name, sku, price, stock_quantity, low_stock_threshold, is_active, category_id, categories ( name )`)
    .eq('is_active', true)
    .order('name')

  if (category) query = query.eq('category_id', category)

  const { data: productsData } = await query
  const products = (productsData as unknown as Product[]) || []

  const { data: categories } = await supabase.from('categories').select('id, name').order('name')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Products
        </h1>

        <div className="flex items-center gap-3">
          <CategoryFilter categories={categories || []} current={category} />

          <Link
            href="/dashboard/products/stock-history"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Stock History
          </Link>

          <Link
            href="/dashboard/products/receive-stock"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            + Receive Stock
          </Link>

          <Link
            href="/dashboard/products/new"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            + Add Product
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {products.map((p) => {
              const lowStock =
                p.stock_quantity <= p.low_stock_threshold

              return (
                <tr
                  key={p.id}
                  className={`border-b border-neutral-100 last:border-0 ${
                    lowStock ? 'bg-red-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {p.name}
                  </td>

                  <td className="px-4 py-3 text-neutral-500">
                    {p.sku || '—'}
                  </td>

                  <td className="px-4 py-3 text-neutral-500">
                    {p.categories?.name || '—'}
                  </td>

                  <td className="px-4 py-3 text-right text-neutral-900">
                    ₦{Number(p.price).toLocaleString()}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        lowStock
                          ? 'font-medium text-red-600'
                          : 'text-neutral-900'
                      }
                    >
                      {p.stock_quantity}
                    </span>

                    {lowStock && (
                      <span className="ml-1">⚠️</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/dashboard/products/stock-history?product=${p.id}`}
                        className="text-neutral-500 hover:text-neutral-700"
                        title="History"
                      >
                        <History size={16} />
                      </Link>

                      <Link
                        href={`/dashboard/products/${p.id}/edit`}
                        className="text-emerald-600 hover:text-emerald-700"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </Link>

                      <DeleteProductButton
                        productId={p.id}
                        productName={p.name}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}