'use client'

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Share2 } from 'lucide-react'

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
  vat_rate?: number | null
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
  // VAT-inclusive pricing: prices already include VAT, so this is just an
  // informational breakdown backed out of the total — it never changes what's
  // charged, so it needs no changes to how a sale's total is computed or validated.
  const vatRate = storeSettings?.vat_rate || 0
  const vatAmount = vatRate > 0 ? total - total / (1 + vatRate / 100) : 0

  const receiptRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState('')

  // Renders the receipt itself to a PNG. WhatsApp's wa.me link can only carry
  // text, so sending a real receipt means handing a file to the OS share sheet
  // (where WhatsApp appears) rather than building a URL.
  async function buildReceiptImage() {
    if (!receiptRef.current) return null
    const dataUrl = await toPng(receiptRef.current, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      filter: (node) => !(node instanceof HTMLElement && node.dataset.receiptActions !== undefined),
    })
    const blob = await (await fetch(dataUrl)).blob()
    return { dataUrl, blob }
  }

  function downloadImage(dataUrl: string) {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `receipt-${saleNumber}.png`
    link.click()
  }

  async function shareReceipt() {
    if (sharing) return
    setSharing(true)
    setShareNote('')

    try {
      const built = await buildReceiptImage()
      if (!built) return

      const file = new File([built.blob], `receipt-${saleNumber}.png`, { type: 'image/png' })

      // On a phone this opens the OS share sheet with WhatsApp in it — the path
      // that actually matters for sending a customer their receipt.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${storeSettings?.store_name || 'Receipt'} · ${saleNumber}`,
          })
          return
        } catch (err) {
          // The viewer dismissed the share sheet — that's a choice, not a failure.
          if (err instanceof Error && err.name === 'AbortError') return
          // Anything else (e.g. Safari refusing a share outside a fresh gesture)
          // falls through to the desktop paths below.
        }
      }

      // Desktop browsers can't attach a file to WhatsApp, but WhatsApp Web
      // accepts a pasted image — so put the receipt on the clipboard.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': built.blob })])
          setShareNote('Receipt image copied — paste it into WhatsApp with Ctrl+V.')
          return
        } catch {
          // Clipboard blocked (unfocused document, Firefox, etc) — save it instead.
        }
      }

      downloadImage(built.dataUrl)
      setShareNote('Receipt saved as an image — attach it in WhatsApp.')
    } catch {
      setShareNote("Couldn't create the receipt image. Try Print instead.")
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="mx-auto max-w-md print:max-w-none">
      <div
        ref={receiptRef}
        className="rounded-xl border border-neutral-200 bg-white p-6 font-mono print:rounded-none print:border-0 print:p-2 print:shadow-none"
      >
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
          {vatAmount > 0 && (
            <div className="flex justify-between text-xs text-neutral-400">
              <span>Includes VAT ({vatRate}%)</span>
              <span>₦{vatAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
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

        <div data-receipt-actions className="mt-6 print:hidden">
          {shareNote && <p className="mb-2 text-center text-xs text-neutral-500">{shareNote}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-lg border border-neutral-300 px-4 py-3 font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Print
            </button>
            <button
              onClick={shareReceipt}
              disabled={sharing}
              aria-label="Share receipt as an image"
              className="flex items-center justify-center rounded-lg border border-neutral-300 px-4 py-3 font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
            >
              <Share2 size={18} />
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
    </div>
  )
}
