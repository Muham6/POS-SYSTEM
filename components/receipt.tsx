'use client'

type ReceiptItem = {
  product_name: string
  quantity: number
  unit_name?: string | null
  price: number
}

type StoreSettings = {
  store_name: string
  address: string | null
  phone: string | null
  footer_message: string | null
  return_policy: string | null
} | null

export default function Receipt({
  saleNumber,
  dateLabel,
  items,
  subtotal,
  discount,
  total,
  cash,
  card,
  transfer,
  customerLabel,
  storeSettings,
  voided,
  onNewSale,
}: {
  saleNumber: string
  dateLabel: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  total: number
  cash: number
  card: number
  transfer: number
  customerLabel?: string | null
  storeSettings: StoreSettings
  voided?: boolean
  onNewSale?: () => void
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 font-mono">
        {voided && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">
            VOIDED
          </div>
        )}
        <div className="text-center">
          <p className="text-lg font-bold text-neutral-900">{storeSettings?.store_name || 'Store'}</p>
          {storeSettings?.address && <p className="text-xs text-neutral-500">{storeSettings.address}</p>}
          {storeSettings?.phone && <p className="text-xs text-neutral-500">{storeSettings.phone}</p>}
        </div>

        <div className="mt-4 border-t border-dashed border-neutral-300 pt-4 text-center">
          <p className="text-sm font-semibold text-neutral-900">{saleNumber}</p>
          <p className="text-xs text-neutral-400">{dateLabel}</p>
          {customerLabel && <p className="mt-1 text-xs text-neutral-500">{customerLabel}</p>}
        </div>

        <div className="mt-4 space-y-2 border-t border-dashed border-neutral-300 pt-4">
          {items.map((i, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-neutral-700">
                {i.product_name} × {i.quantity} {i.unit_name || ''}
              </span>
              <span className="text-neutral-900">₦{(i.price * i.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-dashed border-neutral-300 pt-4 text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>Discount</span>
              <span>−₦{discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-neutral-900">
            <span>TOTAL</span>
            <span>₦{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-2 space-y-1 text-right text-xs text-neutral-400">
          {cash > 0 && <p>Cash: ₦{cash.toLocaleString()}</p>}
          {card > 0 && <p>Card: ₦{card.toLocaleString()}</p>}
          {transfer > 0 && <p>Transfer: ₦{transfer.toLocaleString()}</p>}
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
          {onNewSale && (
            <button
              onClick={onNewSale}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white transition hover:bg-emerald-600"
            >
              New Sale
            </button>
          )}
        </div>
      </div>
    </div>
  )
}