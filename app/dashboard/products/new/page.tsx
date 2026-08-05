'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type ExtraUnit = {
  unit_name: string
  conversion_to_base: string
  price: string
}

export default function NewProductPage() {
  const router = useRouter()
  const supabase = createClient()
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [form, setForm] = useState({
    name: '',
    sku: '',
    cost_price: '',
    stock_quantity: '',
    low_stock_threshold: '5',
    category_id: '',
  })

  // Base unit — required for every product
  const [baseUnitName, setBaseUnitName] = useState('piece')
  const [baseUnitPrice, setBaseUnitPrice] = useState('')

  // Additional units — optional (pack, carton, bag, etc.)
  const [extraUnits, setExtraUnits] = useState<ExtraUnit[]>([])

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }) => setCategories(data || []))
  }, [supabase])

  function addExtraUnit() {
    setExtraUnits((prev) => [...prev, { unit_name: '', conversion_to_base: '', price: '' }])
  }

  function updateExtraUnit(index: number, patch: Partial<ExtraUnit>) {
    setExtraUnits((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)))
  }

  function removeExtraUnit(index: number) {
    setExtraUnits((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: newCategoryName.trim() })
      .select()
      .single()

    if (error) {
      setError(error.message)
      return
    }
    setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm((f) => ({ ...f, category_id: data.id }))
    setShowNewCategory(false)
    setNewCategoryName('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!baseUnitName.trim() || !baseUnitPrice) {
      setError('Every product needs a base unit name and price (e.g. "piece" — the smallest sellable unit).')
      return
    }

    for (const u of extraUnits) {
      if (!u.unit_name.trim() || !u.conversion_to_base || !u.price) {
        setError('Fill in name, conversion, and price for every extra unit — or remove the incomplete row.')
        return
      }
    }

    setLoading(true)

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name: form.name,
        sku: form.sku || null,
        price: parseFloat(baseUnitPrice),
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        stock_quantity: parseInt(form.stock_quantity || '0'),
        low_stock_threshold: parseInt(form.low_stock_threshold || '5'),
        category_id: form.category_id || null,
      })
      .select()
      .single()

    if (productError) {
      setLoading(false)
      setError(productError.message)
      return
    }

    const unitRows = [
      {
        product_id: product.id,
        unit_name: baseUnitName.trim(),
        conversion_to_base: 1,
        price: parseFloat(baseUnitPrice),
        is_base_unit: true,
      },
      ...extraUnits.map((u) => ({
        product_id: product.id,
        unit_name: u.unit_name.trim(),
        conversion_to_base: parseInt(u.conversion_to_base),
        price: parseFloat(u.price),
        is_base_unit: false,
      })),
    ]

    const { error: unitsError } = await supabase.from('product_units').insert(unitRows)

    setLoading(false)

    if (unitsError) {
      setError(`Product saved, but units failed: ${unitsError.message}`)
      return
    }

    router.push('/dashboard/products')
    router.refresh()
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/products" className="text-sm text-neutral-500 hover:underline">
          ← Products
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Add Product</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            Product name
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            SKU / barcode (optional)
          </label>
          <input
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Stock quantity (in base units)
            </label>
            <input
              type="number"
              value={form.stock_quantity}
              onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Low stock alert
            </label>
            <input
              type="number"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            Cost price (optional)
          </label>
          <input
            type="number"
            step="0.01"
            value={form.cost_price}
            onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        {/* Base unit — required */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Base unit — required
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            The smallest sellable unit (e.g. &quot;piece&quot;). Stock is always tracked in this unit.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              value={baseUnitName}
              onChange={(e) => setBaseUnitName(e.target.value)}
              placeholder="Unit name (e.g. piece)"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              step="0.01"
              value={baseUnitPrice}
              onChange={(e) => setBaseUnitPrice(e.target.value)}
              placeholder="Price per piece"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Extra units — optional */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Other units sold (optional)
            </p>
            <button type="button" onClick={addExtraUnit} className="text-xs text-emerald-600 hover:underline">
              + Add unit (pack, carton, bag…)
            </button>
          </div>

          {extraUnits.map((unit, index) => (
            <div key={index} className="mt-2 grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              <input
                value={unit.unit_name}
                onChange={(e) => updateExtraUnit(index, { unit_name: e.target.value })}
                placeholder="Name (carton)"
                className="rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <input
                type="number"
                value={unit.conversion_to_base}
                onChange={(e) => updateExtraUnit(index, { conversion_to_base: e.target.value })}
                placeholder={`= how many ${baseUnitName || 'base units'}`}
                className="rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <input
                type="number"
                step="0.01"
                value={unit.price}
                onChange={(e) => updateExtraUnit(index, { price: e.target.value })}
                placeholder="Price"
                className="rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => removeExtraUnit(index)}
                className="text-xs text-red-500 hover:underline"
              >
                remove
              </button>
            </div>
          ))}
          {extraUnits.length === 0 && (
            <p className="mt-2 text-xs text-neutral-400">
              e.g. &quot;carton&quot; = 144 pieces at ₦18,000 — add as many as this product is sold in.
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Category</label>
          {showNewCategory ? (
            <div className="mt-1 flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowNewCategory(false)}
                className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-1 flex gap-2">
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="whitespace-nowrap rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                + New
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save Product'}
        </button>
      </form>
    </div>
  )
}