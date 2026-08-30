// Client-side persistence for in-progress sales on the Sell screen:
//  - the "active draft" survives a page refresh or navigating away mid-sale
//  - "held sales" let a cashier park a customer's cart to attend to someone
//    else, then come back and resume it later
// Nothing here touches Supabase — these are drafts, not real transactions.

export type HeldCartItem = {
  product_id: string
  product_name: string
  unit_id: string
  unit_name: string
  price: number
  quantity: number
  conversion_to_base: number
  stock_quantity: number
  low_stock_threshold: number
}

export type HeldCustomer = {
  id: string
  name: string | null
  company_or_store: string | null
  phone: string | null
}

export type SaleDraft = {
  cart: HeldCartItem[]
  discount: string
  cashAmount: string
  cardAmount: string
  transferAmount: string
  selectedCustomer: HeldCustomer | null
}

export type HeldSale = SaleDraft & {
  id: string
  label: string
  heldAt: string
}

const ACTIVE_KEY = 'pos_active_sale_draft'
const HELD_KEY = 'pos_held_sales'

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode, quota, etc.) — state just won't persist
  }
}

export function loadActiveDraft(): SaleDraft | null {
  return readJSON<SaleDraft | null>(ACTIVE_KEY, null)
}

export function saveActiveDraft(draft: SaleDraft) {
  writeJSON(ACTIVE_KEY, draft)
}

export function clearActiveDraft() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACTIVE_KEY)
}

export function getHeldSales(): HeldSale[] {
  return readJSON<HeldSale[]>(HELD_KEY, [])
}

export function holdSale(draft: SaleDraft, label: string): HeldSale {
  const held: HeldSale = {
    ...draft,
    id: `held-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    heldAt: new Date().toISOString(),
  }
  writeJSON(HELD_KEY, [...getHeldSales(), held])
  return held
}

export function removeHeldSale(id: string) {
  writeJSON(HELD_KEY, getHeldSales().filter((s) => s.id !== id))
}
