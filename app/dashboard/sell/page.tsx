'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Receipt from '@/components/receipt'
import { queueSale } from '@/lib/offline-queue'
import {
  loadActiveDraft,
  saveActiveDraft,
  clearActiveDraft,
  getHeldSales,
  holdSale,
  removeHeldSale,
  type HeldSale,
} from '@/lib/held-sales'
import { PauseCircle, X, Package, Camera } from 'lucide-react'
import BarcodeScanner from '@/components/barcode-scanner'
import { useToast } from '@/components/toast-provider'

type Product = {
  id: string
  name: string
  sku: string | null
  stock_quantity: number
  is_active: boolean
  image_url: string | null
  low_stock_threshold: number
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
  low_stock_threshold: number
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
  vat_rate: number | null
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
    subtotal: number
    discount: number
    total: number
    cash: number
    card: number
    transfer: number
    customer: Customer | null
  } | null>(null)

  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)

  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [hydrated, setHydrated] = useState(false)

  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanNotFoundCode, setScanNotFoundCode] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    loadProducts()
    loadCustomers()
    hydrateFromStorage()
    supabase.from('store_settings').select('*').eq('id', 1).single().then(({ data }) => setStoreSettings(data))
    searchRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore whatever was mid-sale before a refresh or navigating away — a
  // cashier interrupted mid-checkout shouldn't lose the cart they built.
  function hydrateFromStorage() {
    const draft = loadActiveDraft()
    if (draft) {
      setCart(draft.cart)
      setDiscount(draft.discount)
      setCashAmount(draft.cashAmount)
      setCardAmount(draft.cardAmount)
      setTransferAmount(draft.transferAmount)
      setSelectedCustomer(draft.selectedCustomer)
    }
    setHeldSales(getHeldSales())
    setHydrated(true)
  }

  // Keep the active draft in sync so a refresh or accidental navigation never loses it.
  useEffect(() => {
    if (!hydrated) return
    const isEmpty =
      cart.length === 0 && !selectedCustomer && !discount && !cashAmount && !cardAmount && !transferAmount
    if (isEmpty) {
      clearActiveDraft()
      return
    }
    saveActiveDraft({ cart, discount, cashAmount, cardAmount, transferAmount, selectedCustomer })
  }, [hydrated, cart, discount, cashAmount, cardAmount, transferAmount, selectedCustomer])

  async function loadProducts() {
    const { data: productData } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, is_active, image_url, low_stock_threshold')
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
          low_stock_threshold: product.low_stock_threshold,
        },
      ]
    })
  }

  // Handles a code decoded by the camera scanner. Matches against the already-loaded
  // products list by exact, case-insensitive SKU — same list the product grid searches.
  function handleBarcodeDetected(code: string) {
    const match = products.find((p) => p.sku && p.sku.toLowerCase() === code.toLowerCase())
    if (!match) {
      setScanNotFoundCode(code)
      return
    }
    addToCart(match)
    showToast(`Added ${match.name} to cart`)
    setScanNotFoundCode(null)
    setScannerOpen(false)
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

  function finishSaleLocally() {
    setReceipt({
      saleNumber: 'Pending sync',
      items: cart,
      subtotal,
      discount: discountValue,
      total,
      cash,
      card,
      transfer,
      customer: selectedCustomer,
    })
    setError('')
    resetCartState()
    // Reuse the receipt screen, but the "Pending sync" sale number makes it clear
    // this hasn't been confirmed by the server yet.
  }

  function resetCartState() {
    setCart([])
    setMobileCartOpen(false)
    setDiscount('')
    setCashAmount('')
    setCardAmount('')
    setTransferAmount('')
    setSelectedCustomer(null)
    setCustomerSearch('')
    clearActiveDraft()
  }

  function currentDraft() {
    return { cart, discount, cashAmount, cardAmount, transferAmount, selectedCustomer }
  }

  function labelForHeldSale() {
    return selectedCustomer?.name || selectedCustomer?.company_or_store || `Sale ${heldSales.length + 1}`
  }

  // Park the current cart so this cashier can attend to a different customer
  // without losing what's already in progress.
  function handleHoldSale() {
    if (cart.length === 0) return
    holdSale(currentDraft(), labelForHeldSale())
    resetCartState()
    setHeldSales(getHeldSales())
  }

  // Bring a parked cart back to the front. If something else is already being
  // worked on, that gets parked too rather than silently overwritten.
  function handleResumeSale(id: string) {
    const target = getHeldSales().find((s) => s.id === id)
    if (!target) return

    if (cart.length > 0) {
      holdSale(currentDraft(), labelForHeldSale())
    }

    removeHeldSale(id)
    setCart(target.cart)
    setDiscount(target.discount)
    setCashAmount(target.cashAmount)
    setCardAmount(target.cardAmount)
    setTransferAmount(target.transferAmount)
    setSelectedCustomer(target.selectedCustomer)
    setMobileCartOpen(true)
    setHeldSales(getHeldSales())
  }

  function handleDiscardHeldSale(id: string) {
    removeHeldSale(id)
    setHeldSales(getHeldSales())
  }

  // Fires a push notification for any item this sale just dropped to/below its
  // reorder threshold — only fires on the actual crossing, not every sale after.
  function notifyIfLowStock(items: CartItem[]) {
    const crossed = items
      .filter((i) => {
        const postStock = i.stock_quantity - i.quantity * i.conversion_to_base
        return i.stock_quantity > i.low_stock_threshold && postStock <= i.low_stock_threshold
      })
      .map((i) => ({
        name: i.product_name,
        stock_quantity: Math.max(i.stock_quantity - i.quantity * i.conversion_to_base, 0),
      }))

    if (crossed.length === 0) return

    fetch('/api/notify-low-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: crossed }),
    }).catch(() => {
      // Best-effort — a notification failure should never affect the sale itself.
    })
  }

  async function handleCheckout() {
    if (loading) return
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

    const payload = {
      p_items: cart.map((i) => ({ unit_id: i.unit_id, quantity: i.quantity })),
      p_cash_amount: cash,
      p_card_amount: card,
      p_transfer_amount: transfer,
      p_discount: discountValue,
      p_customer_id: selectedCustomer?.id || null,
    }

    // If we're already offline, don't even attempt the network call.
    if (!navigator.onLine) {
      queueSale(payload)
      finishSaleLocally()
      setLoading(false)
      return
    }

    try {
      const { data: saleId, error } = await supabase.rpc('process_sale', payload)

      if (error) {
        setLoading(false)
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
        subtotal,
        discount: discountValue,
        total,
        cash,
        card,
        transfer,
        customer: selectedCustomer,
      })
      notifyIfLowStock(cart)
      resetCartState()
      loadProducts()
    } catch {
      // The request itself failed to reach the server — treat as offline.
      queueSale(payload)
      finishSaleLocally()
    }

    setLoading(false)
  }

  function startNewSale() {
    setReceipt(null)
    setSearch('')
    searchRef.current?.focus()
  }

  // ---- Receipt view ----
  if (receipt) {
    return (
      <Receipt
        saleNumber={receipt.saleNumber}
        dateLabel={new Date().toLocaleString('en-NG')}
        items={receipt.items.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit_name: i.unit_name,
          price: i.price,
        }))}
        subtotal={receipt.subtotal}
        discount={receipt.discount}
        total={receipt.total}
        cash={receipt.cash}
        card={receipt.card}
        transfer={receipt.transfer}
        customerLabel={receipt.customer ? receipt.customer.name || receipt.customer.company_or_store : null}
        storeSettings={storeSettings}
        onNewSale={startNewSale}
      />
    )
  }

  // ---- Main sell screen ----
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Product picker */}
      <div className="flex-1">
        <div className="relative">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or scan product…"
            className="w-full rounded-lg border border-neutral-300 px-4 py-3 pr-12 text-base outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
          />
          <button
            type="button"
            onClick={() => {
              setScanNotFoundCode(null)
              setScannerOpen(true)
            }}
            aria-label="Scan barcode with camera"
            title="Scan barcode with camera"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-emerald-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-emerald-400"
          >
            <Camera size={20} />
          </button>
        </div>

        {!search.trim() && products.length > 30 && (
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
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
                className={`overflow-hidden rounded-xl border text-left transition ${
                  outOfStock
                    ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 opacity-50 dark:border-neutral-800 dark:bg-neutral-800'
                    : 'border-neutral-200 bg-white hover:border-emerald-400 hover:shadow-sm active:scale-[0.98] dark:border-neutral-800 dark:bg-neutral-900'
                }`}
              >
                <div className="flex aspect-square items-center justify-center bg-neutral-50 dark:bg-neutral-800">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={28} className="text-neutral-300 dark:text-neutral-600" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{p.name}</p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {baseUnit ? `₦${Number(baseUnit.price).toLocaleString()} / ${baseUnit.unit_name}` : 'No price set'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                    {outOfStock ? 'Out of stock' : `${p.stock_quantity} ${baseUnit?.unit_name}(s) left`}
                  </p>
                  {units.length > 1 && (
                    <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{units.length} units available</p>
                  )}
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
              No products match &quot;{search}&quot;
            </p>
          )}
        </div>
      </div>

      {/* Cart + checkout */}
      <div
        className={`fixed inset-0 z-50 overflow-y-auto bg-white p-4 lg:static lg:z-auto lg:block lg:w-96 lg:shrink-0 lg:overflow-visible lg:bg-transparent lg:p-0 dark:bg-neutral-900 ${
          mobileCartOpen ? 'block' : 'hidden'
        }`}
      >
        <button
          onClick={() => setMobileCartOpen(false)}
          className="mb-4 flex items-center gap-1 text-sm text-neutral-500 lg:hidden dark:text-neutral-400"
        >
          ← Back to products
        </button>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Cart ({cart.length})
            </h2>
            {cart.length > 0 && (
              <button
                onClick={handleHoldSale}
                className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
                title="Park this cart to attend to another customer"
              >
                <PauseCircle size={14} />
                Hold
              </button>
            )}
          </div>

          {heldSales.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
              {heldSales.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 pl-3 pr-1 py-1 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <button onClick={() => handleResumeSale(s.id)} className="font-medium hover:underline">
                    {s.label} · {s.cart.length} item{s.cart.length === 1 ? '' : 's'}
                  </button>
                  <button
                    onClick={() => handleDiscardHeldSale(s.id)}
                    aria-label={`Discard held sale ${s.label}`}
                    className="rounded-full p-0.5 text-amber-500 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {cart.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400 dark:text-neutral-500">Tap a product to add it.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {cart.map((item, index) => {
                const units = unitsByProduct[item.product_id] || []
                return (
                  <div key={index} className="rounded-lg border border-neutral-100 p-2 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.product_name}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          ₦{item.price.toLocaleString()} × {item.quantity}
                        </p>
                      </div>
                      <button
                        onClick={() => changeQty(index, -1)}
                        aria-label={`Decrease quantity of ${item.product_name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
                        aria-label={`Quantity of ${item.product_name}`}
                        className="w-14 rounded-lg border border-neutral-300 px-1 py-1 text-center text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                      />
                      <button
                        onClick={() => changeQty(index, 1)}
                        disabled={item.quantity >= maxQtyFor(item)}
                        aria-label={`Increase quantity of ${item.product_name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(index)}
                        aria-label={`Remove ${item.product_name} from cart`}
                        className="ml-1 text-xs text-red-500 hover:underline dark:text-red-400"
                      >
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
                                : 'border border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
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
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Customer (optional)
            </label>

            {selectedCustomer ? (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/40">
                <span className="text-sm text-emerald-800 dark:text-emerald-200">
                  {selectedCustomer.name || selectedCustomer.company_or_store}
                  {selectedCustomer.name && selectedCustomer.company_or_store && (
                    <span className="text-emerald-600 dark:text-emerald-400"> · {selectedCustomer.company_or_store}</span>
                  )}
                </span>
                <button onClick={() => setSelectedCustomer(null)} className="text-xs text-emerald-700 hover:underline dark:text-emerald-300">
                  change
                </button>
              </div>
            ) : (
              <>
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search name, store, or phone…"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                />
                {customerSearch && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c)
                          setCustomerSearch('')
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        {c.name || c.company_or_store}
                        {c.name && c.company_or_store && (
                          <span className="text-neutral-400 dark:text-neutral-500"> · {c.company_or_store}</span>
                        )}
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="px-3 py-2 text-sm text-neutral-400 dark:text-neutral-500">No match.</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setShowAddCustomer(true)}
                  className="mt-2 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  + Add new customer
                </button>
              </>
            )}

            {showAddCustomer && (
              <div className="mt-3 space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                {customerError && <p className="text-xs text-red-600 dark:text-red-300">{customerError}</p>}
                <input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                />
                <input
                  value={newCustomerCompany}
                  onChange={(e) => setNewCustomerCompany(e.target.value)}
                  placeholder="Company / store (optional)"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                />
                <input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
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
                    className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Discount (₦, optional)
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
              placeholder="0"
            />
          </div>

          {/* Split payment */}
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Payment</label>
              <button onClick={fillRemainingAsCash} className="text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                fill rest as cash
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <span className="block text-[10px] uppercase text-neutral-400 dark:text-neutral-500">Cash</span>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                />
              </div>
              <div>
                <span className="block text-[10px] uppercase text-neutral-400 dark:text-neutral-500">Card</span>
                <input
                  type="number"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                />
              </div>
              <div>
                <span className="block text-[10px] uppercase text-neutral-400 dark:text-neutral-500">Transfer</span>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Subtotal</span>
              <span>₦{subtotal.toLocaleString()}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Discount</span>
                <span>−₦{discountValue.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              <span>Total</span>
              <span>₦{total.toLocaleString()}</span>
            </div>
            <div
              className={`flex justify-between text-sm font-medium ${
                remaining === 0 ? 'text-emerald-600 dark:text-emerald-400' : remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-300'
              }`}
            >
              <span>{remaining === 0 ? 'Fully paid' : remaining > 0 ? 'Remaining' : 'Overpaid'}</span>
              <span>₦{Math.abs(remaining).toLocaleString()}</span>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>
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

      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => {
            setScannerOpen(false)
            setScanNotFoundCode(null)
          }}
          notFoundCode={scanNotFoundCode}
        />
      )}
    </div>
  )
}