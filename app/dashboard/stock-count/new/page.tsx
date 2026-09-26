'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'
import { ClipboardList } from 'lucide-react'
import { friendlyError } from '@/lib/friendly-error'

type Product = {
  id: string
  name: string
  sku: string | null
  category_id: string | null
  categories: { name: string } | null
}

export default function NewStockCountPage() {
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    // Deliberately does NOT select stock_quantity. If the person counting can
    // see what the system expects, they tend to write that number down instead
    // of what is actually on the shelf, and the count stops being evidence.
    async function loadProducts() {
      const [{ data, error: loadError }, { data: cats }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, category_id, categories ( name )')
          .eq('is_active', true)
          .order('name'),
        supabase.from('categories').select('id, name').order('name'),
      ])

      if (cancelled) return
      if (loadError) setError(friendlyError(loadError.message))
      setProducts((data as unknown as Product[]) || [])
      setCategories(cats || [])
      setLoading(false)
    }

    loadProducts()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Counting a whole shop in one go is unrealistic — a category filter lets
  // someone count just the drinks fridge, or one shelf, and submit that.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      const matchesCategory = !categoryFilter || p.category_id === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [search, categoryFilter, products])

  const enteredCount = Object.values(counted).filter((v) => v.trim() !== '').length

  async function handleSubmit() {
    setError('')

    const items = Object.entries(counted)
      .filter(([, v]) => v.trim() !== '')
      .map(([product_id, v]) => ({ product_id, counted_quantity: parseInt(v, 10) }))

    if (items.length === 0) {
      setError('Enter what you counted for at least one product.')
      return
    }

    if (items.some((i) => isNaN(i.counted_quantity) || i.counted_quantity < 0)) {
      setError('Counts must be whole numbers, and cannot be negative.')
      return
    }

    setSaving(true)
    const { data: ref, error: submitError } = await supabase.rpc('submit_stock_count', {
      p_items: items,
      p_note: note || null,
    })
    setSaving(false)

    if (submitError) {
      setError(submitError.message)
      return
    }

    showToast(`Count ${ref} submitted`)
    router.push('/dashboard/stock-count')
    router.refresh()
  }

  if (loading) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading products…</p>

  return (
    <div>
      <Link href="/dashboard/stock-count" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
        ← Stock counts
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Count stock</h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
        Write down what is actually on the shelf. This does not change anything in the system — it goes to the
        owner so they can see where the shelf and the records disagree.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row dark:border-neutral-800 dark:bg-neutral-900">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product or SKU…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-56 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {(categoryFilter || search.trim()) && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Showing {filtered.length} of {products.length} products. Anything not shown is simply left out of this
          count — you can count one section at a time.
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Counted on shelf</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-3">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{p.name}</span>
                  {p.sku && (
                    <span className="block font-mono text-xs text-neutral-400 dark:text-neutral-500">{p.sku}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{p.categories?.name || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={counted[p.id] ?? ''}
                    onChange={(e) => setCounted((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="—"
                    aria-label={`Counted quantity for ${p.name}`}
                    className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-center text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                  />
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center">
                  <ClipboardList size={28} className="mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">No product matches &quot;{search}&quot;.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Note (optional)
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. counted the drinks fridge only"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
        />

        <button
          onClick={handleSubmit}
          disabled={saving || enteredCount === 0}
          className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {saving
            ? 'Submitting…'
            : `Submit count${enteredCount > 0 ? ` · ${enteredCount} product${enteredCount === 1 ? '' : 's'}` : ''}`}
        </button>

        <p className="mt-2 text-center text-xs text-neutral-400 dark:text-neutral-500">
          Products you leave blank are simply not part of this count.
        </p>
      </div>
    </div>
  )
}
