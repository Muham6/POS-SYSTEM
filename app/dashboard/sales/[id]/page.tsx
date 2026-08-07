import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import Receipt from '@/components/receipt'
import VoidSaleButton from '@/components/void-sale-button'

type SaleDetail = {
  id: string
  sale_number: string
  created_at: string
  subtotal: number
  discount: number
  total: number
  cash_amount: number
  card_amount: number
  transfer_amount: number
  status: string
  void_reason: string | null
  profiles: { full_name: string | null } | null
  customers: { name: string | null; company_or_store: string | null; phone: string | null } | null
}

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getProfile()

  const { data: sale } = await supabase
    .from('sales')
    .select(
      `
      id, sale_number, created_at, subtotal, discount, total,
      cash_amount, card_amount, transfer_amount, status, void_reason,
      profiles ( full_name ),
      customers ( name, company_or_store, phone )
    `
    )
    .eq('id', id)
    .single()

  const { data: items } = await supabase
    .from('sale_items')
    .select('id, product_name, unit_price, quantity, line_total, unit_name')
    .eq('sale_id', id)

  const { data: storeSettings } = await supabase.from('store_settings').select('*').eq('id', 1).single()

  if (!sale) {
    return <p className="text-sm text-neutral-500">Sale not found.</p>
  }

  const s = sale as unknown as SaleDetail
  const isVoided = s.status === 'voided'

  return (
    <div className="max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/dashboard/sales" className="text-sm text-neutral-500 hover:underline">
          ← Sales History
        </Link>
        {profile?.role === 'admin' && !isVoided && <VoidSaleButton saleId={s.id} />}
      </div>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <p>Cashier: {s.profiles?.full_name || '—'}</p>
        {s.customers && (
          <p className="mt-1">
            Customer: {s.customers.name || s.customers.company_or_store}
            {s.customers.phone && ` · ${s.customers.phone}`}
          </p>
        )}
        {isVoided && s.void_reason && <p className="mt-2 text-red-600">Void reason: {s.void_reason}</p>}
      </div>

      <Receipt
        saleNumber={s.sale_number}
        dateLabel={new Date(s.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
        items={(items || []).map((it) => ({
          product_name: it.product_name,
          quantity: it.quantity,
          unit_name: it.unit_name,
          price: Number(it.unit_price),
        }))}
        subtotal={Number(s.subtotal)}
        discount={Number(s.discount)}
        total={Number(s.total)}
        cash={Number(s.cash_amount)}
        card={Number(s.card_amount)}
        transfer={Number(s.transfer_amount)}
        customerLabel={s.customers ? s.customers.name || s.customers.company_or_store : null}
        storeSettings={storeSettings}
        voided={isVoided}
      />
    </div>
  )
}