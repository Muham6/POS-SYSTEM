'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'
import { Download, Upload, FileSpreadsheet } from 'lucide-react'

// ---- CSV parsing (hand-written — no new dependency) -----------------------
//
// Handles: UTF-8 BOM stripping, RFC4180 double-quoted fields (commas/newlines
// inside quotes, "" as an escaped quote), and both CRLF and LF line endings.

function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const len = text.length

  while (i < len) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i += 1
        }
      } else {
        field += char
        i += 1
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
    } else if (char === ',') {
      row.push(field)
      field = ''
      i += 1
    } else if (char === '\r') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += text[i + 1] === '\n' ? 2 : 1
    } else if (char === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += 1
    } else {
      field += char
      i += 1
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop fully-blank trailing/interstitial lines.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

function toNumberOrNull(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function toIntOrDefault(raw: string, fallback: number): number {
  const t = raw.trim()
  if (t === '') return fallback
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

const REQUIRED_HEADERS = ['name', 'unit_name', 'unit_price']

type ParsedRow = {
  lineNumber: number
  name: string
  sku: string | null
  category: string | null
  costPrice: number | null
  stockQuantity: number
  lowStockThreshold: number
  unitName: string
  unitPrice: number | null
  errors: string[]
}

function parseProductsCSV(text: string): { rows: ParsedRow[]; error: string } {
  const table = parseCSV(text)
  if (table.length === 0) return { rows: [], error: 'The file is empty.' }

  const header = table[0].map((h) => h.trim().toLowerCase())
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h))
  if (missing.length > 0) {
    return {
      rows: [],
      error: `CSV is missing required column(s): ${missing.join(', ')}. Download the template below to see the expected format.`,
    }
  }

  const idx = (key: string) => header.indexOf(key)
  const iName = idx('name')
  const iSku = idx('sku')
  const iCategory = idx('category')
  const iCost = idx('cost_price')
  const iStock = idx('stock_quantity')
  const iLow = idx('low_stock_threshold')
  const iUnitName = idx('unit_name')
  const iUnitPrice = idx('unit_price')

  const dataRows = table.slice(1).filter((r) => r.some((c) => c.trim() !== ''))
  if (dataRows.length === 0) return { rows: [], error: 'No data rows found below the header row.' }

  const rows: ParsedRow[] = dataRows.map((r, i) => {
    const get = (index: number) => (index >= 0 && index < r.length ? r[index] : '')

    const name = get(iName).trim()
    const sku = get(iSku).trim() || null
    const category = get(iCategory).trim() || null
    const costPrice = toNumberOrNull(get(iCost))
    const stockQuantity = toIntOrDefault(get(iStock), 0)
    const lowStockThreshold = toIntOrDefault(get(iLow), 5)
    const unitName = get(iUnitName).trim()
    const unitPrice = toNumberOrNull(get(iUnitPrice))

    const errors: string[] = []
    if (!name) errors.push('Missing name')
    if (!unitName) errors.push('Missing unit_name')
    if (unitPrice === null) errors.push('Missing or non-numeric unit_price')

    return {
      lineNumber: i + 2, // +1 for header row, +1 for 1-based line numbers
      name,
      sku,
      category,
      costPrice,
      stockQuantity,
      lowStockThreshold,
      unitName,
      unitPrice,
      errors,
    }
  })

  return { rows, error: '' }
}

function downloadTemplate() {
  const header = 'name,sku,category,cost_price,stock_quantity,low_stock_threshold,unit_name,unit_price'
  const sampleRows = [
    'Coca-Cola 50cl,CC-50,Beverages,120,100,10,piece,150',
    'Rice (50kg bag),RICE-50,Grains,,20,5,bag,45000',
  ]
  const csv = [header, ...sampleRows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'product-import-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ImportProductsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState('')
  const [importError, setImportError] = useState('')
  const [importWarning, setImportWarning] = useState('')
  const [importing, setImporting] = useState(false)

  const validRows = rows.filter((r) => r.errors.length === 0)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setImportError('')
    setImportWarning('')
    setRows([])
    setParseError('')

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const { rows: parsed, error } = parseProductsCSV(text)
        setRows(parsed)
        setParseError(error)
      } catch {
        setParseError('Could not parse this file as CSV. Make sure it was saved as a plain .csv file.')
      }
    }
    reader.onerror = () => setParseError('Could not read this file.')
    reader.readAsText(file)

    // Allow re-selecting the same file after fixing it.
    e.target.value = ''
  }

  async function handleImport() {
    if (validRows.length === 0) return

    setImporting(true)
    setImportError('')
    setImportWarning('')

    // Step a — resolve categories: fetch existing, bulk-create any missing ones.
    const { data: existingCategories, error: fetchCategoriesError } = await supabase
      .from('categories')
      .select('id, name')

    if (fetchCategoriesError) {
      setImporting(false)
      setImportError(`Could not load categories: ${fetchCategoriesError.message}`)
      return
    }

    const categoryMap = new Map<string, string>(
      (existingCategories || []).map((c) => [c.name.toLowerCase(), c.id])
    )

    const neededCategoryNames = new Map<string, string>() // lowercase -> original casing
    for (const row of validRows) {
      if (row.category && !categoryMap.has(row.category.toLowerCase())) {
        const key = row.category.toLowerCase()
        if (!neededCategoryNames.has(key)) neededCategoryNames.set(key, row.category)
      }
    }

    if (neededCategoryNames.size > 0) {
      const { data: newCategories, error: createCategoriesError } = await supabase
        .from('categories')
        .insert(Array.from(neededCategoryNames.values()).map((name) => ({ name })))
        .select()

      if (createCategoriesError) {
        setImporting(false)
        setImportError(`Could not create new categories: ${createCategoriesError.message}`)
        return
      }

      for (const c of newCategories || []) categoryMap.set(c.name.toLowerCase(), c.id)
    }

    // Step b — bulk-insert products.
    const productRows = validRows.map((row) => ({
      name: row.name,
      sku: row.sku,
      price: row.unitPrice,
      cost_price: row.costPrice,
      stock_quantity: row.stockQuantity,
      low_stock_threshold: row.lowStockThreshold,
      category_id: row.category ? categoryMap.get(row.category.toLowerCase()) ?? null : null,
      image_url: null,
    }))

    const { data: insertedProducts, error: productError } = await supabase
      .from('products')
      .insert(productRows)
      .select()

    if (productError) {
      setImporting(false)
      setImportError(`Import failed — nothing was created: ${productError.message}`)
      return
    }

    const returned = insertedProducts || []

    // Correlate returned rows with input rows. Supabase/PostgREST returns rows
    // for a single bulk insert in input order, but we verify that rather than
    // assume it — falling back to a name+sku match if it doesn't hold.
    const orderMatches =
      returned.length === validRows.length &&
      returned.every((p, i) => p.name === validRows[i].name && (p.sku ?? null) === validRows[i].sku)

    let productIdByRow: (string | null)[]
    if (orderMatches) {
      productIdByRow = returned.map((p) => p.id)
    } else {
      const pool = [...returned]
      productIdByRow = validRows.map((row) => {
        const idx = pool.findIndex((p) => p.name === row.name && (p.sku ?? null) === row.sku)
        if (idx === -1) return null
        const [matched] = pool.splice(idx, 1)
        return matched.id
      })
    }

    // Step c — bulk-insert the base-unit rows for whichever products we could match.
    const unitRows = validRows
      .map((row, i) => {
        const productId = productIdByRow[i]
        if (!productId) return null
        return {
          product_id: productId,
          unit_name: row.unitName,
          conversion_to_base: 1,
          price: row.unitPrice,
          is_base_unit: true,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    const unmatchedCount = productIdByRow.filter((id) => id === null).length

    let unitsError: { message: string } | null = null
    if (unitRows.length > 0) {
      const { error } = await supabase.from('product_units').insert(unitRows)
      unitsError = error
    }

    setImporting(false)

    // Step d — no rollback available via the client SDK, so disclose clearly.
    if (unitsError) {
      setImportWarning(
        `${returned.length} product${returned.length === 1 ? ' was' : 's were'} created, but their units failed to save (${unitsError.message}) — open each one from the Products page and add its unit manually.`
      )
      return
    }

    if (unmatchedCount > 0) {
      setImportWarning(
        `${returned.length} product(s) were created. ${unitRows.length} got their unit saved automatically, but ${unmatchedCount} could not be matched reliably — open those from the Products page and add their unit manually.`
      )
      return
    }

    // Step e — full success.
    showToast(`${returned.length} product${returned.length === 1 ? '' : 's'} imported`)
    router.push('/dashboard/products')
    router.refresh()
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/products" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Products
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Import Products</h1>

      <div className="space-y-6">
        {/* Instructions */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            CSV format
          </p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Upload a CSV with one row per product. Columns can be in any order — they&apos;re matched by name.
            This imports each product with a single (base) unit; add extra units like &quot;carton&quot; or
            &quot;pack&quot; later from the product&apos;s edit page.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-left uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                  <th className="py-2 pr-4">Column</th>
                  <th className="py-2 pr-4">Required</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="text-neutral-600 dark:text-neutral-400">
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-4 font-mono text-neutral-900 dark:text-neutral-100">name</td>
                  <td className="py-2 pr-4">Yes</td>
                  <td className="py-2">Product name.</td>
                </tr>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-4 font-mono text-neutral-900 dark:text-neutral-100">sku</td>
                  <td className="py-2 pr-4">No</td>
                  <td className="py-2">SKU / barcode.</td>
                </tr>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-4 font-mono text-neutral-900 dark:text-neutral-100">category</td>
                  <td className="py-2 pr-4">No</td>
                  <td className="py-2">Matched by name (case-insensitive); created automatically if new.</td>
                </tr>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-4 font-mono text-neutral-900 dark:text-neutral-100">cost_price</td>
                  <td className="py-2 pr-4">No</td>
                  <td className="py-2">What you paid per base unit.</td>
                </tr>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-4 font-mono text-neutral-900 dark:text-neutral-100">stock_quantity</td>
                  <td className="py-2 pr-4">No</td>
                  <td className="py-2">Defaults to 0. In base units.</td>
                </tr>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-4 font-mono text-neutral-900 dark:text-neutral-100">low_stock_threshold</td>
                  <td className="py-2 pr-4">No</td>
                  <td className="py-2">Defaults to 5.</td>
                </tr>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-4 font-mono text-neutral-900 dark:text-neutral-100">unit_name</td>
                  <td className="py-2 pr-4">Yes</td>
                  <td className="py-2">The smallest sellable unit, e.g. &quot;piece&quot;.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-neutral-900 dark:text-neutral-100">unit_price</td>
                  <td className="py-2 pr-4">Yes</td>
                  <td className="py-2">Selling price per base unit.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={downloadTemplate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Download size={16} />
            Download CSV template
          </button>
        </div>

        {/* Upload */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Upload
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Upload size={16} />
              Choose CSV file
            </button>
            {fileName && (
              <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                <FileSpreadsheet size={16} />
                {fileName}
              </span>
            )}
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          </div>

          {parseError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {parseError}
            </p>
          )}
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Preview
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{validRows.length}</span> of{' '}
                {rows.length} rows are valid and will be imported.
              </p>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                    <th className="px-3 py-2 text-right">Low stock</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2 text-right">Unit price</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const invalid = r.errors.length > 0
                    return (
                      <tr
                        key={r.lineNumber}
                        className={`border-b border-neutral-100 last:border-0 dark:border-neutral-800 ${
                          invalid ? 'bg-red-50 dark:bg-red-950/40' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{r.lineNumber}</td>
                        <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{r.name || '—'}</td>
                        <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{r.sku || '—'}</td>
                        <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{r.category || '—'}</td>
                        <td className="px-3 py-2 text-right text-neutral-500 dark:text-neutral-400">
                          {r.costPrice !== null ? r.costPrice.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-neutral-500 dark:text-neutral-400">{r.stockQuantity}</td>
                        <td className="px-3 py-2 text-right text-neutral-500 dark:text-neutral-400">{r.lowStockThreshold}</td>
                        <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{r.unitName || '—'}</td>
                        <td className="px-3 py-2 text-right text-neutral-500 dark:text-neutral-400">
                          {r.unitPrice !== null ? r.unitPrice.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {invalid ? (
                            <span className="font-medium text-red-600 dark:text-red-300">{r.errors.join('; ')}</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">Valid</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {importError}
          </p>
        )}

        {importWarning && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            {importWarning}
          </p>
        )}

        {rows.length > 0 && (
          <button
            type="button"
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60 sm:w-auto"
          >
            {importing ? 'Importing…' : `Import ${validRows.length} product${validRows.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>
    </div>
  )
}
