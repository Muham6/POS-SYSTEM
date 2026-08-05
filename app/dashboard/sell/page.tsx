'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  sku: string | null
  stock_quantity: number
  is_active: boolean
}

type Unit = {
  id: string
  product_id: string
  unit_name: string
  conversion_to_base: number
  price: number
  is_base_unit: boolean
}

type CartItem = {
  product_id: string
  product_name: string
  unit_id: string
  unit_name: string
  price: number
  quantity: number
  conversion_to_base: number
  stock_quantity: number // base units available for this product
}

type Customer = {
  id: string
  name: string | null
  company_or_store: string | null
  phone: string | null
}

type StoreSettings = {
  store_name: string
  address: string | null
  phone: string | null
  footer_message: string | null
  return_policy: string | null
}

export default function SellPage() {
  const supabase = createClient()
  const searchRef = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [unitsByProduct, setUnitsByProduct] = useState<Record<string, Unit[]>>({})
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cashAmount, setCashAmount] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerCompany, setNewCustomerCompany] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [customerError, setCustomerError] = useState('')

  const [receipt, setReceipt] = useState<{
    saleNumber: string
    items: CartItem[]
    total: number
    cash: number
    card: number
    transfer: number
    customer: Customer | null
  } | null>(null)

  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    loadProducts()
    loadCustomers()
    supabase.from('store_settings').select('*').eq('id', 1).single().then(({ data }) => setStoreSettings(data))
    searchRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProducts() {
    const { data: productData } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, is_active')
      .eq('is_active', true)
      .order('name')
    setProducts(productData || [])

    const { data: unitData } = await supabase.from('product_units').select('*')
    const grouped: Record<string, Unit[]> = {}
    ;(unitData || []).forEach((u: Unit) => {
      if (!grouped[u.product_id]) grouped[u.product_id] = []
      grouped[u.product_id].push(u)
    })
    setUnitsByProduct(grouped)
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('id, name, company_or_store, phone')
      .order('created_at', { ascending: false })
    setCustomers(data || [])
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 30)
    const q = search.toLowerCase()
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    )
  }, [search, products])

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 8)
    const q = customerSearch.toLowerCase()
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.company_or_store?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    )
  }, [customerSearch, customers])

  function addToCart(product: Product) {
    const units = unitsByProduct[product.id] || []
    const baseUnit = units.find((u) => u.is_base_unit)
    if (!baseUnit) return // product has no unit configured yet — shouldn't happen post-migration

    if (product.stock_quantity < baseUnit.conversion_to_base) return

    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id && i.unit_id === baseUnit.id)
      if (existing) {
        const maxQty = Math.floor(product.stock_quantity / baseUnit.conversion_to_base)
        if (existing.quantity >= maxQty) return prev
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          unit_id: baseUnit.id,
          unit_name: baseUnit.unit_name,
          price: baseUnit.price,
          quantity: 1,
          conversion_to_base: baseUnit.conversion_to_base,
          stock_quantity: product.stock_quantity,
        },
      ]
    })
  }

  function maxQtyFor(item: CartItem) {
    return Math.floor(item.stock_quantity / item.conversion_to_base)
  }

  function changeUnit(index: number, newUnitId: string) {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const units = unitsByProduct[item.product_id] || []
        const newUnit = units.find((u) => u.id === newUnitId)
        if (!newUnit) return item
        const newMax = Math.floor(item.stock_quantity / newUnit.conversion_to_base)
        return {
          ...item,
          unit_id: newUnit.id,
          unit_name: newUnit.unit_name,
          price: newUnit.price,
          conversion_to_base: newUnit.conversion_to_base,
          quantity: Math.min(item.quantity, Math.max(newMax, 1)),
        }
      })
    )
  }

  function changeQty(index: number, delta: number) {
    setCart((prev) =>
      prev
        .map((item, i) => {
          if (i !== index) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > maxQtyFor(item)) return item
          return { ...item, quantity: newQty }
        })
        .filter((i): i is CartItem => i !== null)
    )
  }

  function setQtyDirect(index: number, rawValue: string) {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (rawValue === '') return { ...item, quantity: 0 as unknown as number }
        const parsed = parseInt(rawValue, 10)
        if (isNaN(parsed)) return item
        const clamped = Math.min(Math.max(parsed, 0), maxQtyFor(item))
        return { ...item, quantity: clamped }
      })
    )
  }

  function removeItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const discountValue = parseFloat(discount) || 0
  const total = Math.max(subtotal - discountValue, 0)

  const cash = parseFloat(cashAmount) || 0
  const card = parseFloat(cardAmount) || 0
  const transfer = parseFloat(transferAmount) || 0
  const paidSoFar = cash + card + transfer
  const remaining = Math.round((total - paidSoFar) * 100) / 100

  function fillRemainingAsCash() {
    setCashAmount(String(Math.max(total - card - transfer, 0)))
  }

  async function handleAddCustomer() {
    setCustomerError('')
    if (!newCustomerName.trim() && !newCustomerCompany.trim()) {
      setCustomerError('Enter a name or a company/store name.')
      return
    }
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: newCustomerName.trim() || null,
        company_or_store: newCustomerCompany.trim() || null,
        phone: newCustomerPhone.trim() || null,
      })
      .select()
      .single()

    if (error) {
      setCustomerError(error.message)
      return
    }
    setCustomers((prev) => [data, ...prev])
    setSelectedCustomer(data)
    setShowAddCustomer(false)
    setNewCustomerName('')
    setNewCustomerCompany('')
    setNewCustomerPhone('')
  }

  async function handleCheckout() {
    if (cart.length === 0) return
    setError('')

    if (remaining !== 0) {
      setError(
        remaining > 0
          ? `₦${remaining.toLocaleString()} still unpaid — payment amounts must add up to the total.`
          : `Payment exceeds total by ₦${Math.abs(remaining).toLocaleString()}.`
      )
      return
    }

    setLoading(true)

    const { data: saleId, error } = await supabase.rpc('process_sale', {
      p_items: cart.map((i) => ({ unit_id: i.unit_id, quantity: i.quantity })),
      p_cash_amount: cash,
      p_card_amount: card,
      p_transfer_amount: transfer,
      p_discount: discountValue,
      p_customer_id: selectedCustomer?.id || null,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    const { data: sale } = await supabase
      .from('sales')
      .select('sale_number')
      .eq('id', saleId)
      .single()

    setReceipt({
      saleNumber: sale?.sale_number || String(saleId),
      items: cart,
      total,
      cash,
      card,
      transfer,
      customer: selectedCustomer,
    })

    setCart([])
    setMobileCartOpen(false)
    setDiscount('')
    setCashAmount('')
    setCardAmount('')
    setTransferAmount('')
    setSelectedCustomer(null)
    setCustomerSearch('')
    loadProducts()
  }

  function startNewSale() {
    setReceipt(null)
    setSearch('')
    searchRef.current?.focus()
  }

  // ---- Receipt view ----
  if (receipt) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 font-mono">
          <div className="text-center">
            <p className="text-lg font-bold text-neutral-900">{storeSettings?.store_name || 'Store'}</p>
            {storeSettings?.address && <p className="text-xs text-neutral-500">{storeSettings.address}</p>}
            {storeSettings?.phone && <p className="text-xs text-neutral-500">{storeSettings.phone}</p>}
          </div>

          <div className="mt-4 border-t border-dashed border-neutral-300 pt-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-600">✓</div>
            <p className="mt-2 text-sm font-semibold text-neutral-900">{receipt.saleNumber}</p>
            <p className="text-xs text-neutral-400">{new Date().toLocaleString('en-NG')}</p>
            {receipt.customer && (
              <p className="mt-1 text-xs text-neutral-500">
                {receipt.customer.name || receipt.customer.company_or_store}
              </p>
            )}
          </div>

          <div className="mt-4 space-y-2 border-t border-dashed border-neutral-300 pt-4">
            {receipt.items.map((i, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-neutral-700">
                  {i.product_name} × {i.quantity} {i.unit_name}
                </span>
                <span className="text-neutral-900">₦{(i.price * i.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between border-t border-dashed border-neutral-300 pt-4 text-base font-bold text-neutral-900">
            <span>TOTAL</span>
            <span>₦{receipt.total.toLocaleString()}</span>
          </div>

          <div className="mt-2 space-y-1 text-right text-xs text-neutral-400">
            {receipt.cash > 0 && <p>Cash: ₦{receipt.cash.toLocaleString()}</p>}
            {receipt.card > 0 && <p>Card: ₦{receipt.card.toLocaleString()}</p>}
            {receipt.transfer > 0 && <p>Transfer: ₦{receipt.transfer.toLocaleString()}</p>}
          </div>

          {(storeSettings?.footer_message || storeSettings?.return_policy) && (
            <div className="mt-4 border-t border-dashed border-neutral-300 pt-4 text-center">
              {storeSettings?.footer_message && (
                <p className="text-sm font-medium text-neutral-700">{storeSettings.footer_message}</p>
              )}
              {storeSettings?.return_policy && (
                <p className="mt-1 text-xs text-neutral-400">{storeSettings.return_policy}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-lg border border-neutral-300 px-4 py-3 font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Print
            </button>
            <button
              onClick={startNewSale}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white transition hover:bg-emerald-600"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- Main sell screen ----
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Product picker */}
      <div className="flex-1">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search or scan product…"
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none focus:border-emerald-500"
        />

        {!search.trim() && products.length > 30 && (
          <p className="mt-2 text-xs text-neutral-400">
            Showing 30 of {products.length} products — search or scan to find a specific item.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => {
            const units = unitsByProduct[p.id] || []
            const baseUnit = units.find((u) => u.is_base_unit)
            const outOfStock = !baseUnit || p.stock_quantity < baseUnit.conversion_to_base
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={outOfStock}
                className={`rounded-xl border p-3 text-left transition ${
                  outOfStock
                    ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 opacity-50'
                    : 'border-neutral-200 bg-white hover:border-emerald-400 hover:shadow-sm active:scale-[0.98]'
                }`}
              >
                <p className="text-sm font-medium text-neutral-900">{p.name}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {baseUnit ? `₦${Number(baseUnit.price).toLocaleString()} / ${baseUnit.unit_name}` : 'No price set'}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  {outOfStock ? 'Out of stock' : `${p.stock_quantity} ${baseUnit?.unit_name}(s) left`}
                </p>
                {units.length > 1 && (
                  <p className="mt-1 text-xs text-emerald-600">{units.length} units available</p>
                )}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-neutral-400">
              No products match &quot;{search}&quot;
            </p>
          )}
        </div>
      </div>

      {/* Cart + checkout */}
      <div className={`
        fixed inset-0 z-50 overflow-y-auto bg-white p-4 
        lg:static lg:z-auto lg:block lg:w-96 lg:shrink-0 lg:overflow-visible lg:bg-transparent lg:p-0
        ${mobileCartOpen ? 'block' : 'hidden'}
      `}>
        <button 
          onClick={() => setMobileCartOpen(false)} 
          className="mb-4 flex items-center gap-1 text-sm text-neutral-500 lg:hidden"
        >
          ← Back to products
        </button>
        
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Cart ({cart.length})
          </h2>

          {cart.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">Tap a product to add it.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {cart.map((item, index) => {
                const units = unitsByProduct[item.product_id] || []
                return (
                  <div key={index} className="rounded-lg border border-neutral-100 p-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">{item.product_name}</p>
                        <p className="text-xs text-neutral-500">
                          ₦{item.price.toLocaleString()} × {item.quantity}
                        </p>
                      </div>
                      <button
                        onClick={() => changeQty(index, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={maxQtyFor(item)}
                        value={item.quantity}
                        onChange={(e) => setQtyDirect(index, e.target.value)}
                        onBlur={(e) => {
                          if (e.target.value === '' || Number(e.target.value) < 1) setQtyDirect(index, '1')
                        }}
                        className="w-14 rounded-lg border border-neutral-300 px-1 py-1 text-center text-sm outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={() => changeQty(index, 1)}
                        disabled={item.quantity >= maxQtyFor(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                      >
                        +
                      </button>
                      <button onClick={() => removeItem(index)} className="ml-1 text-xs text-red-500 hover:underline">
                        remove
                      </button>
                    </div>

                    {units.length > 1 && (
                      <div className="mt-2 flex gap-1">
                        {units.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => changeUnit(index, u.id)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                              u.id === item.unit_id
                                ? 'bg-emerald-500 text-white'
                                : 'border border-neutral-300 text-neutral-500 hover:bg-neutral-50'
                            }`}
                          >
                            {u.unit_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Customer picker */}
          <div className="mt-4 border-t border-neutral-200 pt-4">
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Customer (optional)
            </label>

            {selectedCustomer ? (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="text-sm text-emerald-800">
                  {selectedCustomer.name || selectedCustomer.company_or_store}
                  {selectedCustomer.name && selectedCustomer.company_or_store && (
                    <span className="text-emerald-600"> · {selectedCustomer.company_or_store}</span>
                  )}
                </span>
                <button onClick={() => setSelectedCustomer(null)} className="text-xs text-emerald-700 hover:underline">
                  change
                </button>
              </div>
            ) : (
              <>
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search name, store, or phone…"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                {customerSearch && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-neutral-200">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c)
                          setCustomerSearch('')
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                      >
                        {c.name || c.company_or_store}
                        {c.name && c.company_or_store && (
                          <span className="text-neutral-400"> · {c.company_or_store}</span>
                        )}
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="px-3 py-2 text-sm text-neutral-400">No match.</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setShowAddCustomer(true)}
                  className="mt-2 text-xs text-emerald-600 hover:underline"
                >
                  + Add new customer
                </button>
              </>
            )}

            {showAddCustomer && (
              <div className="mt-3 space-y-2 rounded-lg border border-neutral-200 p-3">
                {customerError && <p className="text-xs text-red-600">{customerError}</p>}
                <input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <input
                  value={newCustomerCompany}
                  onChange={(e) => setNewCustomerCompany(e.target.value)}
                  placeholder="Company / store (optional)"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddCustomer}
                    className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                  >
                    Save customer
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCustomer(false)
                      setCustomerError('')
                    }}
                    className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-neutral-200 pt-4">
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Discount (₦, optional)
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="0"
            />
          </div>

          {/* Split payment */}
          <div className="mt-4 border-t border-neutral-200 pt-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Payment</label>
              <button onClick={fillRemainingAsCash} className="text-xs text-emerald-600 hover:underline">
                fill rest as cash
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <span className="block text-[10px] uppercase text-neutral-400">Cash</span>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="block text-[10px] uppercase text-neutral-400">Card</span>
                <input
                  type="number"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="block text-[10px] uppercase text-neutral-400">Transfer</span>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1 border-t border-neutral-200 pt-4 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span>₦{subtotal.toLocaleString()}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between text-neutral-600">
                <span>Discount</span>
                <span>−₦{discountValue.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold text-neutral-900">
              <span>Total</span>
              <span>₦{total.toLocaleString()}</span>
            </div>
            <div
              className={`flex justify-between text-sm font-medium ${
                remaining === 0 ? 'text-emerald-600' : remaining > 0 ? 'text-amber-600' : 'text-red-600'
              }`}
            >
              <span>{remaining === 0 ? 'Fully paid' : remaining > 0 ? 'Remaining' : 'Overpaid'}</span>
              <span>₦{Math.abs(remaining).toLocaleString()}</span>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading || remaining !== 0}
            className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {loading ? 'Processing…' : `Complete Sale · ₦${total.toLocaleString()}`}
          </button>
        </div>
      </div>

      {/* Sticky mobile cart bar */}
      {cart.length > 0 && !mobileCartOpen && (
        <button 
          onClick={() => setMobileCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-xl bg-emerald-500 px-5 py-4 font-medium text-white shadow-lg lg:hidden"
        >
          <span>{cart.length} item{cart.length === 1 ? '' : 's'} in cart</span>
          <span>₦{total.toLocaleString()} · View Cart</span>
        </button>
      )}
    </div>
  )
}