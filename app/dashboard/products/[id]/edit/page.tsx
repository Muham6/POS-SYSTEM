'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Unit = {
  id: string
  unit_name: string
  conversion_to_base: number
  price: number
  is_base_unit: boolean
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const supabase = createClient()

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [originalStock, setOriginalStock] = useState(0)
  const [adjustNote, setAdjustNote] = useState('')

  const [form, setForm] = useState({
    name: '',
    sku: '',
    cost_price: '',
    stock_quantity: '',
    low_stock_threshold: '',
    category_id: '',
  })

  const [units, setUnits] = useState<Unit[]>([])
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitConversion, setNewUnitConversion] = useState('')
  const [newUnitPrice, setNewUnitPrice] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: product }, { data: cats }, { data: unitRows }] = await Promise.all([
        supabase.from('products').select('*').eq('id', productId).single(),
        supabase.from('categories').select('id, name').order('name'),
        supabase
          .from('product_units')
          .select('*')
          .eq('product_id', productId)
          .order('is_base_unit', { ascending: false }),
      ])

      if (product) {
        setForm({
          name: product.name || '',
          sku: product.sku || '',
          cost_price: product.cost_price != null ? String(product.cost_price) : '',
          stock_quantity: String(product.stock_quantity ?? ''),
          low_stock_threshold: String(product.low_stock_threshold ?? ''),
          category_id: product.category_id || '',
        })
        setOriginalStock(product.stock_quantity ?? 0)
      }
      setCategories(cats || [])
      setUnits(unitRows || [])
      setFetching(false)
    }
    load()
  }, [productId, supabase])

  const baseUnit = units.find((u) => u.is_base_unit)

  async function handleUpdateBasePrice(newPrice: string) {
    if (!baseUnit) return
    const price = parseFloat(newPrice)
    if (isNaN(price)) return

    await supabase.from('product_units').update({ price }).eq('id', baseUnit.id)
    await supabase.from('products').update({ price }).eq('id', productId)
    setUnits((prev) => prev.map((u) => (u.id === baseUnit.id ? { ...u, price } : u)))
  }

  async function handleAddUnit() {
    setError('')
    if (!newUnitName.trim() || !newUnitConversion || !newUnitPrice) {
      setError('Fill in name, conversion, and price for the new unit.')
      return
    }
    const { data, error } = await supabase
      .from('product_units')
      .insert({
        product_id: productId,
        unit_name: newUnitName.trim(),
        conversion_to_base: parseInt(newUnitConversion),
        price: parseFloat(newUnitPrice),
        is_base_unit: false,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      return
    }
    setUnits((prev) => [...prev, data])
    setNewUnitName('')
    setNewUnitConversion('')
    setNewUnitPrice('')
  }

  async function handleUpdateUnit(unitId: string, patch: Partial<Unit>) {
    await supabase.from('product_units').update(patch).eq('id', unitId)
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, ...patch } : u)))
  }

  async function handleRemoveUnit(unitId: string) {
    if (!confirm('Remove this unit? Past sales already recorded with it are unaffected.')) return
    await supabase.from('product_units').delete().eq('id', unitId)
    setUnits((prev) => prev.filter((u) => u.id !== unitId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const newStock = parseInt(form.stock_quantity || '0')
    const stockDelta = newStock - originalStock

    const { error: updateError } = await supabase
      .from('products')
      .update({
        name: form.name,
        sku: form.sku || null,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        low_stock_threshold: parseInt(form.low_stock_threshold || '5'),
        category_id: form.category_id || null,
      })
      .eq('id', productId)

    if (updateError) {
      setLoading(false)
      setError(updateError.message)
      return
    }

    if (stockDelta !== 0) {
      const { error: stockError } = await supabase.rpc('adjust_stock', {
        p_product_id: productId,
        p_quantity_change: stockDelta,
        p_movement_type: 'adjustment',
        p_note: adjustNote || null,
      })
      if (stockError) {
        setLoading(false)
        setError(stockError.message)
        return
      }
    }

    setLoading(false)
    router.push('/dashboard/products')
    router.refresh()
  }

  if (fetching) {
    return <p className="text-sm text-neutral-500">Loading product…</p>
  }

  const stockDelta = parseInt(form.stock_quantity || '0') - originalStock

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/products" className="text-sm text-neutral-500 hover:underline">
          ← Products
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Edit Product</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Product name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">SKU / barcode</label>
          <input
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Stock quantity (base units)
            </label>
            <input
              type="number"
              value={form.stock_quantity}
              onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            {stockDelta !== 0 && (
              <p className={`mt-1 text-xs ${stockDelta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {stockDelta > 0 ? `+${stockDelta}` : stockDelta} — will be logged as an adjustment
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Low stock alert</label>
            <input
              type="number"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {stockDelta !== 0 && (
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Reason for stock change
            </label>
            <input
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="e.g. stock count correction, damaged goods"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Cost price</label>
          <input
            type="number"
            step="0.01"
            value={form.cost_price}
            onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Category</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      {/* Unit management — separate from the main form, saves instantly per change */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Selling Units</h2>
        <p className="mt-1 text-sm text-neutral-500">Changes here save immediately.</p>

        {baseUnit && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Base unit — {baseUnit.unit_name}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-emerald-700">Price</span>
              <input
                type="number"
                step="0.01"
                defaultValue={baseUnit.price}
                onBlur={(e) => handleUpdateBasePrice(e.target.value)}
                className="w-28 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {units
            .filter((u) => !u.is_base_unit)
            .map((unit) => (
              <div key={unit.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3">
                <input
                  defaultValue={unit.unit_name}
                  onBlur={(e) => handleUpdateUnit(unit.id, { unit_name: e.target.value })}
                  className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                />
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <span>=</span>
                  <input
                    type="number"
                    defaultValue={unit.conversion_to_base}
                    onBlur={(e) =>
                      handleUpdateUnit(unit.id, { conversion_to_base: parseInt(e.target.value) || 1 })
                    }
                    className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
                  <span>{baseUnit?.unit_name}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={unit.price}
                  onBlur={(e) => handleUpdateUnit(unit.id, { price: parseFloat(e.target.value) || 0 })}
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveUnit(unit.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  remove
                </button>
              </div>
            ))}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 border-t border-neutral-100 pt-4">
          <input
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            placeholder="Name (carton)"
            className="rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            value={newUnitConversion}
            onChange={(e) => setNewUnitConversion(e.target.value)}
            placeholder={`= how many ${baseUnit?.unit_name || 'base'}`}
            className="rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            step="0.01"
            value={newUnitPrice}
            onChange={(e) => setNewUnitPrice(e.target.value)}
            placeholder="Price"
            className="rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleAddUnit}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}