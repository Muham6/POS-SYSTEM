'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ClipboardCheck } from 'lucide-react'

type Product = {
  id: string
  name: string
  sku: string | null
  stock_quantity: number
  category_id: string | null
  categories: { name: string } | null
}

export default function StockTakePage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const [
      { data: productData, error: productError },
      { data: catData, error: catError },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, sku, stock_quantity, category_id, categories ( name )')
        .eq('is_active', true)
        .order('name'),
      supabase.from('categories').select('id, name').order('name'),
    ])
    if (productError || catError) {
      setError(productError?.message || catError?.message || 'Failed to load products.')
    }
    setProducts((productData as unknown as Product[]) || [])
    setCategories(catData || [])
    setLoading(false)
  }

  const filtered = products.filter((p) => {
    const matchesSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !categoryFilter || p.category_id === categoryFilter
    return matchesSearch && matchesCategory
  })

  const visible = search.trim() || categoryFilter ? filtered : filtered.slice(0, 50)
  const enteredCount = Object.values(counted).filter((v) => v.trim() !== '').length

  async function handleSubmit() {
    setError('')
    setSuccess('')

    const items = Object.entries(counted)
      .filter(([, v]) => v.trim() !== '')
      .map(([product_id, v]) => ({ product_id, counted_quantity: parseInt(v) }))

    if (items.length === 0) {
      setError('Enter a counted quantity for at least one product.')
      return
    }

    setSaving(true)
    const { data: batchRef, error } = await supabase.rpc('bulk_stock_take', {
      p_items: items,
      p_note: note || null,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(`Stock take submitted. Reference: ${batchRef} — ${items.length} product${items.length === 1 ? '' : 's'} counted.`)
    setCounted({})
    setNote('')
    load()
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading products…</p>

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/stock-history" className="text-sm text-neutral-500 hover:underline">
          ← Stock History
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Stock Take</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Walk through your shelves and enter what you physically count. Leave a product blank to skip it — only entered rows get updated.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex-1">
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product name or SKU…"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!search.trim() && !categoryFilter && products.length > 50 && (
        <p className="mb-3 text-xs text-neutral-400">
          Showing 50 of {products.length} products — search or filter by category to reach the rest.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">System stock</th>
              <th className="px-4 py-3 text-right">Counted</th>
              <th className="px-4 py-3 text-right">Difference</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const value = counted[p.id] ?? ''
              const diff = value.trim() !== '' ? parseInt(value) - p.stock_quantity : null
              return (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {p.name}
                    {p.sku && <span className="ml-1 text-xs text-neutral-400">({p.sku})</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{p.categories?.name || '—'}</td>
                  <td className="px-4 py-3 text-right text-neutral-500">{p.stock_quantity}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      value={value}
                      onChange={(e) => setCounted((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="—"
                      className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-right text-sm outline-none focus:border-emerald-500"
                    />
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${
                    diff === null ? 'text-neutral-300' : diff === 0 ? 'text-neutral-400' : diff > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {diff === null ? '—' : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                  <ClipboardCheck size={28} className="mx-auto mb-2 text-neutral-300" />
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for this stock take (optional)"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <p className="text-sm text-neutral-500">{enteredCount} counted</p>
        <button
          onClick={handleSubmit}
          disabled={saving || enteredCount === 0}
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Submit Stock Take'}
        </button>
      </div>
    </div>
  )
}