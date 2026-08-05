import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
  payment_method: string
  profiles: {
    full_name: string | null
  } | null
  customers: {
    name: string | null
    company_or_store: string | null
    phone: string | null
  } | null
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: sale } = await supabase
    .from('sales')
    .select(
      `
      id,
      sale_number,
      created_at,
      subtotal,
      discount,
      total,
      cash_amount,
      card_amount,
      transfer_amount,
      payment_method,
      profiles (
        full_name
      ),
      customers (
        name,
        company_or_store,
        phone
      )
    `
    )
    .eq('id', id)
    .single()

  const { data: items } = await supabase
    .from('sale_items')
    .select(
      `
      id,
      product_name,
      unit_price,
      quantity,
      line_total
    `
    )
    .eq('sale_id', id)

  if (!sale) {
    return (
      <p className="text-sm text-neutral-500">
        Sale not found.
      </p>
    )
  }

  const s = sale as unknown as SaleDetail

  return (
    <div className="max-w-lg">
      <Link
        href="/dashboard/sales"
        className="text-sm text-neutral-500 hover:underline"
      >
        ← Sales History
      </Link>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              {s.sale_number}
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              {new Date(s.created_at).toLocaleString('en-NG', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium capitalize text-neutral-600">
            {s.payment_method}
          </span>
        </div>

        <div className="mt-4 space-y-1 border-t border-neutral-100 pt-4 text-sm text-neutral-600">
          <p>
            Cashier: {s.profiles?.full_name || '—'}
          </p>

          {s.customers && (
            <p>
              Customer:{' '}
              {s.customers.name || s.customers.company_or_store}
              {s.customers.phone &&
                ` · ${s.customers.phone}`}
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
          {(items || []).map((item) => (
            <div
              key={item.id}
              className="flex justify-between text-sm"
            >
              <span className="text-neutral-700">
                {item.product_name}{' '}
                <span className="text-neutral-400">
                  ×{item.quantity}
                </span>
              </span>

              <span className="text-neutral-900">
                ₦{Number(item.line_total).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-neutral-200 pt-4 text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span>
              ₦{Number(s.subtotal).toLocaleString()}
            </span>
          </div>

          {Number(s.discount) > 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>Discount</span>
              <span>
                −₦{Number(s.discount).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex justify-between text-lg font-semibold text-neutral-900">
            <span>Total</span>
            <span>
              ₦{Number(s.total).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-2 space-y-1 text-right text-xs text-neutral-400">
          {Number(s.cash_amount) > 0 && (
            <p>
              Cash: ₦{Number(s.cash_amount).toLocaleString()}
            </p>
          )}

          {Number(s.card_amount) > 0 && (
            <p>
              Card: ₦{Number(s.card_amount).toLocaleString()}
            </p>
          )}

          {Number(s.transfer_amount) > 0 && (
            <p>
              Transfer: ₦{Number(s.transfer_amount).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}