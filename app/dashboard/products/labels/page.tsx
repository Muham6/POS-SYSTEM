'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import JsBarcode from 'jsbarcode'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'
import { AlertTriangle, Barcode, Package, Printer, Search, Wand2, X } from 'lucide-react'

type Product = {
  id: string
  name: string
  sku: string | null
  price: number
  stock_quantity: number
}

// ---- Sheet presets --------------------------------------------------------
//
// Sized for the A4 adhesive label sheets sold locally (the Avery-compatible
// layouts). @page below uses a 5mm margin, so the usable area is 200 x 287mm —
// every preset's cols x width and rows x height fits inside that.

type SheetPreset = {
  id: string
  label: string
  cols: number
  rows: number
  widthMm: number
  heightMm: number
  /** Bar height handed to JsBarcode, in its own user units (the SVG is scaled
   *  by its viewBox afterwards, so this only sets the bars-to-text ratio). */
  barHeight: number
  nameClass: string
  priceClass: string
}

const SHEET_PRESETS: SheetPreset[] = [
  {
    id: 'a4-24',
    label: 'A4 — 24 per sheet (63.5 × 33.9 mm)',
    cols: 3,
    rows: 8,
    widthMm: 63.5,
    heightMm: 33.9,
    barHeight: 44,
    nameClass: 'labels-name labels-name--md',
    priceClass: 'labels-price labels-price--md',
  },
  {
    id: 'a4-14',
    label: 'A4 — 14 per sheet (99.1 × 38.1 mm)',
    cols: 2,
    rows: 7,
    widthMm: 99.1,
    heightMm: 38.1,
    barHeight: 46,
    nameClass: 'labels-name labels-name--lg',
    priceClass: 'labels-price labels-price--lg',
  },
  {
    id: 'a4-40',
    label: 'A4 — 40 per sheet (45.7 × 25.4 mm)',
    cols: 4,
    rows: 10,
    widthMm: 45.7,
    heightMm: 25.4,
    barHeight: 40,
    nameClass: 'labels-name labels-name--sm',
    priceClass: 'labels-price labels-price--sm',
  },
]

const MAX_PER_PRODUCT = 200

// ---- SKU generation -------------------------------------------------------
//
// Generated codes are 8 digits beginning with "2". Two reasons:
//   * GS1 reserves prefixes 20-29 for in-store / restricted-circulation items,
//     so a code we mint here can never be confused with a real manufacturer
//     barcode printed on packaged goods.
//   * All-digit data keeps CODE128 in subset C, which packs two digits into
//     each symbol — a shorter, denser bar pattern that reads more reliably off
//     a small label than the same length of mixed letters and symbols would.

const SKU_DIGITS = 7

function generateSkuCandidate(): string {
  const bytes = new Uint32Array(SKU_DIGITS)
  crypto.getRandomValues(bytes)
  let digits = ''
  for (let i = 0; i < SKU_DIGITS; i++) digits += String(bytes[i] % 10)
  return `2${digits}`
}

/** CODE128 encodes ASCII 0-127; anything outside that (a stray ₦, an accented
 *  letter pasted in from a spreadsheet) can't be turned into bars at all. The
 *  range below is narrowed further to printable ASCII — control characters
 *  encode in theory but no scanner or human can do anything with them. */
function isCode128Safe(value: string): boolean {
  return value.length > 0 && /^[\x20-\x7E]+$/.test(value)
}

// ---- Barcode -------------------------------------------------------------

/** Quiet zone, in modules. The CODE128 spec asks for at least 10 blank modules
 *  either side of the symbol; JsBarcode's default margin of 10px at width 2 is
 *  only 5, which is a common reason home-printed labels won't scan. */
const QUIET_ZONE_MODULES = 12
const MODULE_WIDTH = 2

function BarcodeSvg({ value, barHeight }: { value: string; barHeight: number }) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const errorRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const svg = svgRef.current
    const errorEl = errorRef.current
    if (!svg || !errorEl) return

    // Drawing into the SVG (and swapping in the fallback) is a direct DOM
    // update rather than React state on purpose: JsBarcode owns the contents of
    // this element, and routing failure through setState would re-render every
    // label on the sheet for something the page already guards against by
    // filtering unencodable SKUs out of `printable`.
    try {
      JsBarcode(svg, value, {
        format: 'CODE128',
        displayValue: true,
        width: MODULE_WIDTH,
        height: barHeight,
        margin: 0,
        marginLeft: QUIET_ZONE_MODULES * MODULE_WIDTH,
        marginRight: QUIET_ZONE_MODULES * MODULE_WIDTH,
        textMargin: 2,
        fontSize: 16,
        font: 'monospace',
        lineColor: '#000000',
        background: '#ffffff',
      })
      // setAttribute rather than `.hidden`: SVGSVGElement has no `hidden` IDL
      // property, only the content attribute.
      svg.removeAttribute('hidden')
      errorEl.setAttribute('hidden', '')
    } catch {
      svg.setAttribute('hidden', '')
      errorEl.textContent = `Can't encode ${value}`
      errorEl.removeAttribute('hidden')
    }
  }, [value, barHeight])

  return (
    <>
      <svg ref={svgRef} className="labels-barcode" />
      <span ref={errorRef} className="labels-barcode-error" hidden />
    </>
  )
}

// ---- Page -----------------------------------------------------------------

export default function ProductLabelsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [search, setSearch] = useState('')
  /** product id -> number of labels to print */
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  /** product id -> SKU minted on this page, so the UI can call it out */
  const [mintedSkus, setMintedSkus] = useState<Record<string, string>>({})

  const [presetId, setPresetId] = useState(SHEET_PRESETS[0].id)
  const [skipLabels, setSkipLabels] = useState(0)
  const [showName, setShowName] = useState(true)
  const [showPrice, setShowPrice] = useState(true)
  const [cutGuides, setCutGuides] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const preset = SHEET_PRESETS.find((p) => p.id === presetId) || SHEET_PRESETS[0]

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, price, stock_quantity')
        .eq('is_active', true)
        .order('name')

      if (cancelled) return

      if (error) {
        setLoadError(`Couldn't load products: ${error.message}`)
        setProducts([])
      } else {
        setProducts((data as Product[]) || [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // One label per unit on the shelf is what a shop actually wants, so default
  // to the stock count instead of making them type a number for every product.
  const defaultQuantityFor = useCallback((p: Product) => {
    const qty = Math.trunc(p.stock_quantity)
    if (!Number.isFinite(qty) || qty < 1) return 1
    return Math.min(qty, MAX_PER_PRODUCT)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
    )
  }, [products, search])

  const selectedProducts = useMemo(
    () => products.filter((p) => quantities[p.id] !== undefined),
    [products, quantities]
  )

  const missingSku = useMemo(
    () => selectedProducts.filter((p) => !p.sku || !p.sku.trim()),
    [selectedProducts]
  )

  const unencodable = useMemo(
    () => selectedProducts.filter((p) => p.sku && p.sku.trim() && !isCode128Safe(p.sku.trim())),
    [selectedProducts]
  )

  const printable = useMemo(
    () => selectedProducts.filter((p) => p.sku && p.sku.trim() && isCode128Safe(p.sku.trim())),
    [selectedProducts]
  )

  const totalLabels = printable.reduce((sum, p) => sum + (quantities[p.id] || 0), 0)

  function toggleProduct(p: Product) {
    setQuantities((prev) => {
      const next = { ...prev }
      if (next[p.id] !== undefined) delete next[p.id]
      else next[p.id] = defaultQuantityFor(p)
      return next
    })
  }

  function setQuantity(id: string, raw: string) {
    const n = Math.trunc(Number(raw))
    setQuantities((prev) => ({
      ...prev,
      [id]: !Number.isFinite(n) || n < 1 ? 1 : Math.min(n, MAX_PER_PRODUCT),
    }))
  }

  function selectAllFiltered() {
    setQuantities((prev) => {
      const next = { ...prev }
      for (const p of filtered) {
        if (next[p.id] === undefined) next[p.id] = defaultQuantityFor(p)
      }
      return next
    })
  }

  function clearSelection() {
    setQuantities({})
  }

  function setAllQuantities(mode: 'one' | 'stock') {
    setQuantities((prev) => {
      const next = { ...prev }
      for (const p of selectedProducts) {
        next[p.id] = mode === 'one' ? 1 : defaultQuantityFor(p)
      }
      return next
    })
  }

  /** Every SKU already in the table — inactive products included, because an
   *  inactive product can be switched back on and would then collide. Paged,
   *  since PostgREST caps a single response at 1000 rows. */
  async function fetchTakenSkus(): Promise<Set<string>> {
    const taken = new Set<string>()
    const pageSize = 1000

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('products')
        .select('sku')
        .not('sku', 'is', null)
        .range(from, from + pageSize - 1)

      if (error) throw new Error(error.message)

      const rows = (data as { sku: string | null }[]) || []
      for (const row of rows) {
        if (row.sku) taken.add(row.sku.trim().toLowerCase())
      }
      if (rows.length < pageSize) break
    }

    return taken
  }

  async function generateMissingSkus() {
    if (missingSku.length === 0 || generating) return

    setGenerating(true)
    setGenerateError('')

    try {
      const taken = await fetchTakenSkus()

      // Draw codes that clash with neither the table nor each other, then
      // re-check that exact set against the database immediately before writing
      // — that narrows the window where another device could mint the same code
      // between our read and our write. Any code that comes back taken is
      // redrawn; the rest are kept.
      const assigned = new Map<string, string>()
      let pending = [...missingSku]

      for (let round = 0; round < 4 && pending.length > 0; round++) {
        const drawn = new Map<string, string>()

        for (const product of pending) {
          let candidate = generateSkuCandidate()
          let attempts = 0
          while (taken.has(candidate.toLowerCase()) && attempts < 100) {
            candidate = generateSkuCandidate()
            attempts++
          }
          if (taken.has(candidate.toLowerCase())) {
            throw new Error(
              'Could not find a free code after 100 tries — the 8-digit range looks close to full.'
            )
          }
          taken.add(candidate.toLowerCase())
          drawn.set(product.id, candidate)
        }

        const { data: clashes, error: clashError } = await supabase
          .from('products')
          .select('sku')
          .in('sku', Array.from(drawn.values()))

        if (clashError) throw new Error(clashError.message)

        const clashed = new Set(
          ((clashes as { sku: string | null }[]) || []).map((c) => (c.sku || '').toLowerCase())
        )

        const stillPending: Product[] = []
        for (const product of pending) {
          const code = drawn.get(product.id) as string
          if (clashed.has(code.toLowerCase())) stillPending.push(product)
          else assigned.set(product.id, code)
        }
        pending = stillPending
      }

      if (pending.length > 0) {
        throw new Error(
          `Kept hitting SKU collisions for ${pending
            .map((p) => p.name)
            .join(', ')} — nothing was changed.`
        )
      }

      const assignments = missingSku.map((product) => ({
        product,
        sku: assigned.get(product.id) as string,
      }))

      // `.is('sku', null)` makes each write conditional: if another device set a
      // SKU on this product in the meantime, the update matches no row and we
      // keep their value rather than overwriting it.
      const results = await Promise.all(
        assignments.map(async ({ product, sku }) => {
          const { data, error } = await supabase
            .from('products')
            .update({ sku })
            .eq('id', product.id)
            .is('sku', null)
            .select('id, sku')

          if (error) return { product, sku: null, error: error.message }

          const updated = (data as { id: string; sku: string | null }[]) || []
          if (updated.length > 0) return { product, sku: updated[0].sku, error: null }

          // No row matched — read back whatever is there now.
          const { data: current } = await supabase
            .from('products')
            .select('sku')
            .eq('id', product.id)
            .single()

          const existing = (current as { sku: string | null } | null)?.sku || null
          return { product, sku: existing, error: existing ? null : 'Product no longer exists.' }
        })
      )

      const applied = results.filter((r) => r.sku)
      const failures = results.filter((r) => !r.sku)

      if (applied.length > 0) {
        const skuById = new Map(applied.map((r) => [r.product.id, r.sku as string]))
        setProducts((prev) =>
          prev.map((p) => (skuById.has(p.id) ? { ...p, sku: skuById.get(p.id) as string } : p))
        )
        setMintedSkus((prev) => {
          const next = { ...prev }
          for (const [id, sku] of skuById) next[id] = sku
          return next
        })
        showToast(
          `${applied.length} SKU${applied.length === 1 ? '' : 's'} generated and saved`
        )
      }

      if (failures.length > 0) {
        setGenerateError(
          `${failures.length} product(s) couldn't be given a SKU: ${failures
            .map((f) => `${f.product.name} (${f.error})`)
            .join('; ')}`
        )
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Could not generate SKUs.')
      showToast('Could not generate SKUs', 'error')
    } finally {
      setGenerating(false)
    }
  }

  // Flatten the selection into one cell per label, then chunk into sheets so
  // each sheet can force its own page break instead of trusting the browser to
  // paginate a tall grid.
  const cells = useMemo(() => {
    const out: { key: string; product: Product | null }[] = []
    for (let i = 0; i < skipLabels; i++) out.push({ key: `blank-${i}`, product: null })
    for (const p of printable) {
      const n = quantities[p.id] || 0
      for (let i = 0; i < n; i++) out.push({ key: `${p.id}-${i}`, product: p })
    }
    return out
  }, [printable, quantities, skipLabels])

  const perSheet = preset.cols * preset.rows
  const sheets = useMemo(() => {
    const out: (typeof cells)[] = []
    for (let i = 0; i < cells.length; i += perSheet) out.push(cells.slice(i, i + perSheet))
    return out
  }, [cells, perSheet])

  const sheetStyle = {
    '--labels-cols': String(preset.cols),
    '--labels-w': `${preset.widthMm}mm`,
    '--labels-h': `${preset.heightMm}mm`,
  } as React.CSSProperties

  return (
    <div>
      <style>{LABEL_STYLES}</style>

      <div className="print:hidden">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/dashboard/products"
            className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
          >
            ← Products
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Barcode Labels
          </h1>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={totalLabels === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            <Printer size={16} />
            Print {totalLabels > 0 ? `${totalLabels} label${totalLabels === 1 ? '' : 's'}` : 'labels'}
          </button>
        </div>

        {loadError && (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {loadError}
          </p>
        )}

        <div className="space-y-6">
          {/* Pick products */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Products
            </p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Pick the products to print labels for. The label count starts at the quantity in stock
              — one label per item on the shelf — so you only change it when you want something else.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or SKU"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>

              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filtered.length === 0}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Select all{search.trim() ? ' matching' : ''}
              </button>

              <button
                type="button"
                onClick={clearSelection}
                disabled={selectedProducts.length === 0}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Clear
              </button>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading products…</p>
            ) : filtered.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
                <Package size={28} className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {products.length === 0
                    ? 'No active products yet.'
                    : 'No products match that search.'}
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
                      <th className="w-10 px-4 py-3"></th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Labels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const checked = quantities[p.id] !== undefined
                      const minted = mintedSkus[p.id]
                      const noSku = !p.sku || !p.sku.trim()

                      return (
                        <tr
                          key={p.id}
                          className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProduct(p)}
                              aria-label={`Print labels for ${p.name}`}
                              className="h-4 w-4 accent-emerald-500"
                            />
                          </td>

                          <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                            {p.name}
                          </td>

                          <td className="px-4 py-3">
                            {noSku ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                <AlertTriangle size={12} />
                                No SKU
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                                {p.sku}
                                {minted && (
                                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    New
                                  </span>
                                )}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-100">
                            ₦{Number(p.price).toLocaleString()}
                          </td>

                          <td className="px-4 py-3 text-right text-neutral-500 dark:text-neutral-400">
                            {p.stock_quantity}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {checked ? (
                              <input
                                type="number"
                                min={1}
                                max={MAX_PER_PRODUCT}
                                value={quantities[p.id]}
                                onChange={(e) => setQuantity(p.id, e.target.value)}
                                aria-label={`Number of labels for ${p.name}`}
                                className="w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-right text-sm text-neutral-900 focus:border-emerald-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                              />
                            ) : (
                              <span className="text-neutral-300 dark:text-neutral-600">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {selectedProducts.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {selectedProducts.length}
                  </span>{' '}
                  selected
                </span>
                <button
                  type="button"
                  onClick={() => setAllQuantities('one')}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Set all to 1
                </button>
                <button
                  type="button"
                  onClick={() => setAllQuantities('stock')}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Match stock quantity
                </button>
              </div>
            )}
          </div>

          {/* Missing SKUs */}
          {(missingSku.length > 0 || Object.keys(mintedSkus).length > 0 || generateError) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                SKUs
              </p>

              {missingSku.length > 0 && (
                <>
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    <p className="flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium">
                          {missingSku.length} selected product
                          {missingSku.length === 1 ? ' has' : 's have'} no SKU
                        </span>{' '}
                        — there&apos;s nothing to encode into a barcode, so they&apos;re left off the
                        sheet. Generate a code for them and it&apos;s saved to the product, ready for
                        the Sell screen&apos;s scanner.
                      </span>
                    </p>
                    <ul className="mt-2 ml-6 list-disc space-y-0.5">
                      {missingSku.map((p) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={generateMissingSkus}
                    disabled={generating}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <Wand2 size={16} />
                    {generating
                      ? 'Generating…'
                      : `Generate ${missingSku.length} SKU${missingSku.length === 1 ? '' : 's'}`}
                  </button>
                </>
              )}

              {Object.keys(mintedSkus).length > 0 && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <p className="font-medium">
                    Generated and saved to {Object.keys(mintedSkus).length} product
                    {Object.keys(mintedSkus).length === 1 ? '' : 's'}:
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {products
                      .filter((p) => mintedSkus[p.id])
                      .map((p) => (
                        <li key={p.id}>
                          {p.name} → <span className="font-mono">{mintedSkus[p.id]}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {generateError && (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {generateError}
                </p>
              )}
            </div>
          )}

          {unencodable.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                <X size={16} className="mt-0.5 shrink-0" />
                <span>
                  {unencodable.length} selected product(s) have a SKU containing characters CODE128
                  can&apos;t encode ({unencodable.map((p) => p.name).join(', ')}). Edit the SKU to
                  plain letters and digits, then come back.
                </span>
              </p>
            </div>
          )}

          {/* Sheet settings */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Label sheet
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Sheet size</span>
                <select
                  value={presetId}
                  onChange={(e) => {
                    setPresetId(e.target.value)
                    // A skip count valid for 24-up can overrun a 14-up sheet.
                    const next = SHEET_PRESETS.find((s) => s.id === e.target.value)
                    if (next) {
                      setSkipLabels((prev) => Math.min(prev, next.cols * next.rows - 1))
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-emerald-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  {SHEET_PRESETS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Skip labels (for a part-used sheet)
                </span>
                <input
                  type="number"
                  min={0}
                  max={perSheet - 1}
                  value={skipLabels}
                  onChange={(e) => {
                    const n = Math.trunc(Number(e.target.value))
                    setSkipLabels(!Number.isFinite(n) || n < 0 ? 0 : Math.min(n, perSheet - 1))
                  }}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-emerald-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={showName}
                  onChange={(e) => setShowName(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Show product name
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Show price
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={cutGuides}
                  onChange={(e) => setCutGuides(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Print cut guides (for plain paper)
              </label>
            </div>

            <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
              Barcodes are CODE128 — the symbology the Sell screen&apos;s camera scanner reads, and
              the one that encodes any SKU regardless of length. Print at 100% scale (no &quot;fit to
              page&quot;), or the bars come out too narrow to scan.
            </p>
          </div>
        </div>
      </div>

      {/* Printable sheet — the only thing that survives @media print */}
      <div className="labels-print-root mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 print:hidden">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{totalLabels}</span>{' '}
            label{totalLabels === 1 ? '' : 's'} on{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {sheets.length}
            </span>{' '}
            sheet{sheets.length === 1 ? '' : 's'}
          </p>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={totalLabels === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Printer size={16} />
            Print
          </button>
        </div>

        {sheets.length === 0 ? (
          <div className="p-8 text-center print:hidden">
            <Barcode size={28} className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Select a product above to build the label sheet.
            </p>
          </div>
        ) : (
          <div className="labels-scroll overflow-x-auto p-4 print:p-0">
            {sheets.map((sheet, sheetIndex) => (
              <div key={sheetIndex} className="labels-sheet-block">
                <p className="mb-2 text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500 print:hidden">
                  Sheet {sheetIndex + 1} of {sheets.length}
                </p>

                <div
                  className={`labels-sheet${cutGuides ? ' labels-sheet--guides' : ''}`}
                  style={sheetStyle}
                >
                  {sheet.map((cell) =>
                    cell.product ? (
                      <div key={cell.key} className="labels-cell">
                        {showName && (
                          <span className={preset.nameClass}>{cell.product.name}</span>
                        )}

                        <span className="labels-bars">
                          <BarcodeSvg
                            value={(cell.product.sku || '').trim()}
                            barHeight={preset.barHeight}
                          />
                        </span>

                        {showPrice && (
                          <span className={preset.priceClass}>
                            ₦{Number(cell.product.price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div key={cell.key} className="labels-cell labels-cell--blank" />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Styles ---------------------------------------------------------------
//
// Kept as a plain <style> element rendered inside the page body rather than in
// globals.css, for one specific reason: app/globals.css declares a document-wide
//
//     @media print { @page { size: 80mm auto; margin: 0 } }
//
// for thermal receipt rolls. `@page` is a document-level at-rule — it takes no
// selector, so it cannot be scoped to a container the way normal rules can. The
// only way to keep an 80mm roll page from squashing an A4 label sheet is to
// re-declare `@page` and win the cascade, which this does two ways at once:
//   1. Document order — this element renders in <body>, after the stylesheet
//      that Next injects into <head>, so its declarations come later.
//   2. Lifetime — it exists only while this route is mounted. Navigate to a
//      receipt and it unmounts, leaving the 80mm roll size untouched everywhere
//      else in the app. Nothing in globals.css had to change.
//
// Label cells are deliberately black-on-white with no dark: variants, for the
// same reason components/receipt.tsx is: they end up on paper.

const LABEL_STYLES = `
/* Wrapping flex rather than a grid with repeat(var(--labels-cols), …): the
   sheet is exactly cols x label-width wide and every cell is exactly one label
   wide with no gap, so the row breaks land on the die-cuts by construction —
   no dependence on a custom property surviving substitution inside repeat(). */
.labels-sheet {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: flex-start;
  gap: 0;
  background: #ffffff;
  width: calc(var(--labels-cols) * var(--labels-w));
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.labels-sheet-block + .labels-sheet-block {
  margin-top: 1.5rem;
}

.labels-cell {
  box-sizing: border-box;
  flex: 0 0 auto;
  width: var(--labels-w);
  height: var(--labels-h);
  padding: 1.6mm 2mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 0.6mm;
  overflow: hidden;
  background: #ffffff;
  color: #000000;
  text-align: center;
  break-inside: avoid;
  page-break-inside: avoid;
}

.labels-sheet--guides .labels-cell {
  outline: 1px solid #cccccc;
  outline-offset: -1px;
}

/* On screen only: show where the die-cuts fall so the grid is readable. */
@media screen {
  .labels-sheet .labels-cell {
    outline: 1px dashed #d4d4d4;
    outline-offset: -1px;
  }
}

.labels-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;
  font-family: system-ui, -apple-system, sans-serif;
  font-weight: 600;
  line-height: 1.15;
  color: #000000;
}

.labels-name--sm { font-size: 6.5pt; -webkit-line-clamp: 1; }
.labels-name--md { font-size: 8pt; }
.labels-name--lg { font-size: 9.5pt; }

.labels-bars {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
}

.labels-barcode {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  shape-rendering: crispEdges;
}

/* The UA stylesheet's [hidden] rule loses to the author display: block above,
   so restate it for the two elements BarcodeSvg toggles. */
.labels-barcode[hidden],
.labels-barcode-error[hidden] {
  display: none;
}

.labels-barcode-error {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 6pt;
  color: #000000;
}

.labels-price {
  font-family: system-ui, -apple-system, sans-serif;
  font-weight: 700;
  line-height: 1;
  color: #000000;
}

.labels-price--sm { font-size: 8pt; }
.labels-price--md { font-size: 10pt; }
.labels-price--lg { font-size: 12pt; }

@media print {
  /* Overrides the 80mm thermal-roll @page from app/globals.css — see the note
     above. Only in effect while this route is on screen. */
  @page {
    size: A4 portrait;
    margin: 5mm;
  }

  html,
  body {
    background: #ffffff !important;
  }

  /* The toast overlay is fixed-position and lives outside this page's tree
     (components/toast-provider.tsx), so it can't be reached with print:hidden. */
  .fixed.pointer-events-none {
    display: none !important;
  }

  /* Strip the preview card's screen chrome so only bare labels reach paper. */
  .labels-print-root {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
    overflow: visible !important;
  }

  .labels-scroll {
    overflow: visible !important;
    padding: 0 !important;
  }

  .labels-sheet-block + .labels-sheet-block {
    margin-top: 0;
    break-before: page;
    page-break-before: always;
  }
}
`
