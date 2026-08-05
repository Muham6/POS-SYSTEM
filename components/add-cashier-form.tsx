'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddCashierForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'cashier' | 'admin'>('cashier')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, email, password, role }),
    })
    const data = await res.json()

    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    setSuccess(`${fullName} added as ${role}.`)
    setFullName('')
    setEmail('')
    setPassword('')
    setRole('cashier')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Add Account</h2>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </p>
      )}

      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name"
        required
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <input
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Temporary password"
        required
        minLength={6}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as 'cashier' | 'admin')}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      >
        <option value="cashier">Cashier</option>
        <option value="admin">Admin</option>
      </select>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
      >
        {loading ? 'Creating…' : 'Create Account'}
      </button>

      <p className="text-xs text-neutral-400">
        Share the email and temporary password with them directly — they can sign in immediately.
      </p>
    </form>
  )
}