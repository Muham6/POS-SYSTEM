'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function VoidSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVoid() {
    setError('')
    if (!reason.trim()) {
      setError('Enter a reason for voiding this sale.')
      return
    }
    setLoading(true)
    const { error } = await supabase.rpc('void_sale', { p_sale_id: saleId, p_reason: reason.trim() })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm text-red-500 hover:underline">
        Void Sale
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-neutral-900">Void this sale</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Stock will be returned to inventory. This cannot be undone.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (e.g. wrong item rung up)"
              className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setOpen(false)
                  setError('')
                }}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Voiding…' : 'Void Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}