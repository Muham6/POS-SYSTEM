export type QueuedSale = {
  localId: string
  createdAt: string
  payload: {
    p_items: { unit_id: string; quantity: number }[]
    p_cash_amount: number
    p_card_amount: number
    p_transfer_amount: number
    p_discount: number
    p_customer_id: string | null
  }
}

const KEY = 'pos_offline_sales'

export function getQueuedSales(): QueuedSale[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function queueSale(payload: QueuedSale['payload']): QueuedSale {
  const sale: QueuedSale = {
    localId: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    payload,
  }
  const current = getQueuedSales()
  window.localStorage.setItem(KEY, JSON.stringify([...current, sale]))
  return sale
}

export function removeQueuedSale(localId: string) {
  const current = getQueuedSales()
  window.localStorage.setItem(KEY, JSON.stringify(current.filter((s) => s.localId !== localId)))
}