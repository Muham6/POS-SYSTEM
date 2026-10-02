import type { createClient } from '@/lib/supabase/client'

type BrowserClient = ReturnType<typeof createClient>

export type SaleArgs = {
  /** Made up by the till before sending, so a sale that arrives twice is only recorded once. */
  clientRef: string
  items: { unit_id: string; quantity: number }[]
  cash: number
  card: number
  transfer: number
  customerId: string | null
  /** When the sale was actually rung up — differs from now for a sale made offline. */
  soldAt: string
}

export type SaleResult = {
  saleId: string | null
  error: string | null
  /** The request never got an answer — the sale may or may not have been saved. */
  networkFailure: boolean
  /** Sent through record_sale, so resending the same clientRef can't sell it twice. */
  safeToResend: boolean
}

// Fetch failures come back from supabase-js as an error with no database code.
function isNetworkFailure(error: { message?: string; code?: string } | null) {
  if (!error || error.code) return false
  return /fetch|network|load failed|timed? ?out/i.test(error.message || '')
}

// Rings up a sale through record_sale (migration 0009), which won't record the
// same sale twice and dates an offline sale correctly. Until that migration
// has been run the function doesn't exist, so this falls back to process_sale
// and behaves exactly as the till always has.
export async function recordSale(supabase: BrowserClient, sale: SaleArgs): Promise<SaleResult> {
  const { data, error } = await supabase.rpc('record_sale', {
    p_client_ref: sale.clientRef,
    p_items: sale.items,
    p_cash_amount: sale.cash,
    p_card_amount: sale.card,
    p_transfer_amount: sale.transfer,
    p_customer_id: sale.customerId,
    p_sold_at: sale.soldAt,
  })

  // PGRST202: no such function — the migration hasn't been run yet.
  if (error?.code === 'PGRST202') {
    const fallback = await supabase.rpc('process_sale', {
      p_items: sale.items,
      p_cash_amount: sale.cash,
      p_card_amount: sale.card,
      p_transfer_amount: sale.transfer,
      p_discount: 0,
      p_customer_id: sale.customerId,
    })
    return {
      saleId: fallback.error ? null : (fallback.data as string),
      error: fallback.error?.message || null,
      networkFailure: isNetworkFailure(fallback.error),
      safeToResend: false,
    }
  }

  return {
    saleId: error ? null : (data as string),
    error: error?.message || null,
    networkFailure: isNetworkFailure(error),
    safeToResend: true,
  }
}

export function newSaleRef() {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `sale-${random}`
}
