'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'

export type ReturnLine = {
  id: string
  product_name: string
  unit_name: string | null
  unit_price: number
  quantity: number
  alreadyReturned: number
}

export default function ReturnForm({
  saleId,
  lines,
  refundRatio,
}: {
  saleId: string
  lines: ReturnLine[]
  refundRatio: number
}) {
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true)
  const [cashAmount, setCashAmount] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function remainingFor(line: ReturnLine) {
    return line.quantity - line.alreadyReturned
  }

  function setQty(line: ReturnLine, raw: string) {
    const parsed = parseInt(raw, 10)
    const next = isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), remainingFor(line))
    setQuantities((prev) => ({ ...prev, [line.id]: next }))
  }

  const selected = lines
    .map((line) => ({ line, qty: quantities[line.id] || 0 }))
    .filter((entry) => entry.qty > 0)

  const gross = selected.reduce((sum, e) => sum + e.line.unit_price * e.qty, 0)
  const refundDue = Math.round(gross * refundRatio * 100) / 100
  const discountApplied = Math.round((gross - refundDue) * 100) / 100

  const cash = parseFloat(cashAmount) || 0
  const card = parseFloat(cardAmount) || 0
  const transfer = parseFloat(transferAmount) || 0
  const allocated = cash + card + transfer
  const outstanding = Math.round((refundDue - allocated) * 100) / 100

  function fillRemainingAsCash() {
    setCashAmount(String(Math.max(Math.round((refundDue - card - transfer) * 100) / 100, 0)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (selected.length === 0) {
      setError('Choose at least one item to return.')
      return
    }
    if (Math.abs(outstanding) > 0.01) {
      setError(
        outstanding > 0
          ? `₦${outstanding.toLocaleString()} of the refund is unallocated — say how it's being paid back.`
          : `Refund is over-allocated by ₦${Math.abs(outstanding).toLocaleString()}.`
      )
      return
    }

    setSaving(true)
    const { error: rpcError } = await supabase.rpc('process_return', {
      p_sale_id: saleId,
      p_items: selected.map((e) => ({ sale_item_id: e.line.id, quantity: e.qty })),
      p_reason: reason.trim() || null,
      p_refund_cash: cash,
      p_refund_card: card,
      p_refund_transfer: transfer,
      p_restock: restock,
    })
    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    showToast(`Refunded ₦${refundDue.toLocaleString()}`)
    router.push(`/dashboard/sales/${saleId}`)
    router.refresh()
  }

  const nothingLeft = lines.every((line) => remainingFor(line) === 0)

  if (nothingLeft) {
    return (
      <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        Every item on this sale has already been returned.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          What&apos;s coming back
        </h2>

        <div className="mt-3 space-y-3">
          {lines.map((line) => {
            const remaining = remainingFor(line)
            const qty = quantities[line.id] || 0
            return (
              <div
                key={line.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  remaining === 0
                    ? 'border-neutral-200 bg-neutral-50 opacity-60 dark:border-neutral-800 dark:bg-neutral-800/40'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{line.product_name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    ₦{line.unit_price.toLocaleString()} × {line.quantity} {line.unit_name || ''}
                    {line.alreadyReturned > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {' '}
                        · {line.alreadyReturned} already returned
                      </span>
                    )}
                  </p>
                </div>

                {remaining === 0 ? (
                  <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">Fully returned</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={remaining}
                      value={qty || ''}
                      placeholder="0"
                      onChange={(e) => setQty(line, e.target.value)}
                      aria-label={`Quantity of ${line.product_name} to return`}
                      className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-center text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => setQty(line, String(remaining))}
                      className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      all {remaining}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <label className="mt-4 flex items-start gap-2 border-t border-neutral-200 pt-4 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={restock}
            onChange={(e) => setRestock(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-500"
          />
          <span>
            Put these back on the shelf
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">
              Untick if the goods came back damaged or unsaleable — the refund still happens, the stock just
              doesn&apos;t.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
            <span>Goods at list price</span>
            <span>₦{gross.toLocaleString()}</span>
          </div>
          {discountApplied > 0 && (
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Less the discount on the original sale</span>
              <span>−₦{discountApplied.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">
            <span>Refund due</span>
            <span>₦{refundDue.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              How it&apos;s being refunded
            </label>
            <button
              type="button"
              onClick={fillRemainingAsCash}
              className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              fill rest as cash
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { label: 'Cash', value: cashAmount, set: setCashAmount },
              { label: 'Card', value: cardAmount, set: setCardAmount },
              { label: 'Transfer', value: transferAmount, set: setTransferAmount },
            ].map((field) => (
              <div key={field.label}>
                <span className="block text-[10px] uppercase text-neutral-400 dark:text-neutral-500">
                  {field.label}
                </span>
                <input
                  type="number"
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  placeholder="0"
                  aria-label={`${field.label} refund amount`}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                />
              </div>
            ))}
          </div>

          {selected.length > 0 && (
            <div
              className={`mt-2 flex justify-between text-sm font-medium ${
                Math.abs(outstanding) <= 0.01
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              <span>{Math.abs(outstanding) <= 0.01 ? 'Fully allocated' : 'Still to allocate'}</span>
              <span>₦{Math.abs(outstanding).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Reason (optional)
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. wrong size, customer changed their mind"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
          />
        </div>

        <button
          type="submit"
          disabled={saving || selected.length === 0}
          className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          {saving ? 'Processing…' : `Refund ₦${refundDue.toLocaleString()}`}
        </button>
      </div>
    </form>
  )
}
