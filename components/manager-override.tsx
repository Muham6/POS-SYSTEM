'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

// Asks a manager to authorise ONE over-limit discount on the sale in progress.
//
// The credentials are posted to /api/verify-manager and checked there on a
// throwaway, cookie-free Supabase client. We never call signInWithPassword() in
// the browser: that would swap the cashier's session for the manager's, so the
// manager would end up recorded as the cashier who made the sale.
export default function ManagerOverride({
  subtotal,
  discountAmount,
  limitPercent,
  onApproved,
  onClose,
}: {
  subtotal: number
  discountAmount: number
  limitPercent: number
  onApproved: (managerName: string) => void
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const discountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/verify-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        setError(data?.message || 'Could not verify those details. Try again.')
        setLoading(false)
        return
      }

      // Clear the typed password before handing control back.
      setPassword('')
      setLoading(false)
      onApproved(String(data.manager_name || 'Manager'))
    } catch {
      setLoading(false)
      setError('Could not reach the server — check your connection and try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-neutral-900 dark:shadow-none">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          <ShieldCheck size={18} className="text-emerald-500" />
          Manager approval
        </h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          This sale has a{' '}
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            ₦{discountAmount.toLocaleString()}
          </span>{' '}
          discount — {discountPercent.toFixed(1)}% of the ₦{subtotal.toLocaleString()} subtotal, above the{' '}
          {limitPercent}% a cashier can give alone. A manager can sign off on this one sale.
        </p>

        <form onSubmit={handleApprove}>
          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Manager email"
            className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
          />
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Manager password"
            className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
          />

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
            The cashier stays signed in — these details only approve this one discount and are never saved.
          </p>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Approve discount'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
