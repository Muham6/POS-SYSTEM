import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { fetchAllRows } from '@/lib/fetch-all'

type ProductRow = {
  id: string
  name: string
  sku: string | null
  cost_price: number | null
  stock_quantity: number
  low_stock_threshold: number
  category_id: string | null
  supplier_id: string | null
}

type UnitRow = {
  product_id: string
  unit_name: string
  price: number
  is_base_unit: boolean
}

export async function GET() {
  const profile = await getProfile()

  // Cost price is on this export, and with it every margin in the shop — so it
  // stays with the owner. Cashiers can already see what things sell for.
  if (!profile) return new Response('Not authenticated', { status: 401 })
  if (profile.role !== 'admin') return new Response('Admins only', { status: 403 })

  const supabase = await createClient()

  // Paged rather than a plain select: product_units runs at two rows per
  // product, so a single read would start losing prices at 500 products and
  // the export would look complete while quietly missing columns.
  const productResult = await fetchAllRows<ProductRow>((fromRow, toRow) =>
    supabase
      .from('products')
      .select('id, name, sku, cost_price, stock_quantity, low_stock_threshold, category_id, supplier_id')
      .eq('is_active', true)
      .order('name')
      .range(fromRow, toRow)
  )

  const unitResult = await fetchAllRows<UnitRow>((fromRow, toRow) =>
    supabase.from('product_units').select('product_id, unit_name, price, is_base_unit').order('product_id').range(fromRow, toRow)
  )

  if (productResult.error || unitResult.error) {
    return new Response(`Could not build the export: ${productResult.error || unitResult.error}`, { status: 500 })
  }

  const [{ data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from('categories').select('id, name'),
    supabase.from('suppliers').select('id, name'),
  ])

  const categoryName = new Map((categories || []).map((c) => [c.id, c.name]))
  const supplierName = new Map((suppliers || []).map((s) => [s.id, s.name]))

  const unitsByProduct = new Map<string, UnitRow[]>()
  for (const u of unitResult.rows) {
    const list = unitsByProduct.get(u.product_id)
    if (list) list.push(u)
    else unitsByProduct.set(u.product_id, [u])
  }

  const header = [
    'SKU',
    'Name',
    'Category',
    'Manufacturer',
    'Cost Price',
    'Retail Price',
    'Wholesale Price',
    'Quantity',
    'Stock Value At Cost',
    'Low Stock Alert',
  ]

  const csvRows = productResult.rows.map((p) => {
    const units = unitsByProduct.get(p.id) || []
    // Named units where they exist, otherwise fall back to whichever unit is
    // the base one — products added before retail/wholesale existed, or since,
    // may be set up with any unit name at all.
    const retail = units.find((u) => u.unit_name.toLowerCase() === 'retail') || units.find((u) => u.is_base_unit)
    const wholesale = units.find((u) => u.unit_name.toLowerCase() === 'wholesale')
    const cost = p.cost_price ?? 0

    return [
      p.sku || '',
      p.name,
      p.category_id ? categoryName.get(p.category_id) || '' : '',
      p.supplier_id ? supplierName.get(p.supplier_id) || '' : '',
      p.cost_price ?? '',
      retail?.price ?? '',
      wholesale?.price ?? '',
      p.stock_quantity,
      cost * p.stock_quantity,
      p.low_stock_threshold,
    ]
  })

  const totalValue = productResult.rows.reduce((sum, p) => sum + (p.cost_price ?? 0) * p.stock_quantity, 0)
  const totalUnits = productResult.rows.reduce((sum, p) => sum + p.stock_quantity, 0)
  const footer = ['', `TOTAL — ${productResult.rows.length} products`, '', '', '', '', '', totalUnits, totalValue, '']

  const csv = [header, ...csvRows, footer]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  // Excel assumes the system codepage unless a UTF-8 BOM says otherwise, which
  // is what turns a product name into mojibake the moment it leaves the app.
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
