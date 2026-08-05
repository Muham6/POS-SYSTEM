'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Product = { id: string; name: string; sku: string | null; stock_quantity: number }
type Row = { product: Product | null; search: string; quantity: string }

export default function ReceiveStockPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [rows, setRows] = useState<Row[]>([{ product: null, search: '', quantity: '' }])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
  refreshProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

  function refreshProducts() {
    supabase
      .from('products')
      .select('id, name, sku, stock_quantity')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setProducts(data || []))
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, { product: null, search: '', quantity: '' }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const items = rows
      .filter((r) => r.product && parseInt(r.quantity) > 0)
      .map((r) => ({ product_id: r.product!.id, quantity: parseInt(r.quantity), note: note || null }))

    if (items.length === 0) {
      setError('Add at least one product with a quantity.')
      return
    }

    setLoading(true)
    const { data: count, error } = await supabase.rpc('bulk_adjust_stock', { p_items: items })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(`${count} product${count === 1 ? '' : 's'} restocked successfully.`)
    setRows([{ product: null, search: '', quantity: '' }])
    setNote('')
    refreshProducts()
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/products" className="text-sm text-neutral-500 hover:underline">
          ← Products
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Receive Stock</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {success && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        )}

        <div className="space-y-3">
          {rows.map((row, index) => {
            const filtered = row.search
              ? products.filter(
                  (p) =>
                    p.name.toLowerCase().includes(row.search.toLowerCase()) ||
                    p.sku?.toLowerCase().includes(row.search.toLowerCase())
                )
              : []
            return (
              <div key={index} className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3">
                <div className="flex-1">
                  {row.product ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-800">
                        {row.product.name} <span className="text-neutral-400">· {row.product.stock_quantity} in stock</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => updateRow(index, { product: null, search: '' })}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={row.search}
                        onChange={(e) => updateRow(index, { search: e.target.value })}
                        placeholder="Search product…"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                      {row.search && (
                        <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-neutral-200">
                          {filtered.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => updateRow(index, { product: p, search: '' })}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
                            >
                              <span>{p.name}</span>
                              <span className="text-neutral-400">{p.stock_quantity} in stock</span>
                            </button>
                          ))}
                          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-neutral-400">No match.</p>}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => updateRow(index, { quantity: e.target.value })}
                  placeholder="Qty"
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="mt-2 text-xs text-red-500 hover:underline"
                  >
                    remove
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="text-sm text-emerald-600 hover:underline"
        >
          + Add another product
        </button>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            Note for this delivery (optional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. supplier name, invoice number — applies to all items above"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Add All to Stock'}
        </button>
      </form>
    </div>
  )
}