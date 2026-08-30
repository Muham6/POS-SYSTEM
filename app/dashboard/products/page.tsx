import Link from 'next/link'
import { Pencil, History, Package } from 'lucide-react'
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
  image_url: string | null
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
    .select(
      `id, name, sku, price, stock_quantity, low_stock_threshold, image_url, is_active, category_id, categories ( name )`
    )
    .eq('is_active', true)
    .order('name')

  if (category) {
    query = query.eq('category_id', category)
  }

  const { data: productsData, error: productsError } = await query
  const products = (productsData as unknown as Product[]) || []

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Products
        </h1>

        <div className="flex items-center gap-3">
          <CategoryFilter
            categories={categories || []}
            current={category}
          />

          <Link
            href="/dashboard/products/new"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            + Add Product
          </Link>
        </div>
      </div>

      {productsError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Couldn&apos;t load products: {productsError.message}
        </p>
      )}

      {products.length === 0 && !productsError ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <Package size={28} className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {category
              ? 'No products in this category yet.'
              : 'No products yet — add your first one to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
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
                    className={`border-b border-neutral-100 last:border-0 dark:border-neutral-800 ${
                      lowStock ? 'bg-red-50 dark:bg-red-950/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-lg border border-neutral-200 object-cover dark:border-neutral-800"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-200 text-neutral-300 dark:border-neutral-700 dark:text-neutral-600">
                            <Package size={16} />
                          </div>
                        )}
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">{p.name}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {p.sku || '—'}
                    </td>

                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {p.categories?.name || '—'}
                    </td>

                    <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-100">
                      ₦{Number(p.price).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          lowStock
                            ? 'font-medium text-red-600 dark:text-red-300'
                            : 'text-neutral-900 dark:text-neutral-100'
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
                          href={`/dashboard/stock-history?product=${p.id}`}
                          className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                          title="History"
                          aria-label={`View stock history for ${p.name}`}
                        >
                          <History size={16} />
                        </Link>

                        <Link
                          href={`/dashboard/products/${p.id}/edit`}
                          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          title="Edit"
                          aria-label={`Edit ${p.name}`}
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
      )}
    </div>
  )
}
