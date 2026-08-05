'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UserActions({
  userId,
  isActive,
  isSelf,
}: {
  userId: string
  isActive: boolean
  isSelf: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  async function toggleActive() {
    if (isSelf) return
    if (!confirm(isActive ? 'Deactivate this account?' : 'Reactivate this account?')) return

    setLoading(true)
    await supabase.from('profiles').update({ is_active: !isActive }).eq('id', userId)
    setLoading(false)
    router.refresh()
  }

  async function handleResetPassword() {
    setError('')
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPassword }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to reset password')
      return
    }
    setResetSuccess(true)
  }

  function closeResetModal() {
    setShowReset(false)
    setNewPassword('')
    setError('')
    setResetSuccess(false)
  }

  if (isSelf) {
    return <span className="text-xs text-neutral-400">—</span>
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button onClick={() => setShowReset(true)} className="text-xs text-neutral-500 hover:underline">
        Reset password
      </button>
      <button
        onClick={toggleActive}
        disabled={loading}
        className={`text-xs hover:underline ${isActive ? 'text-red-500' : 'text-emerald-600'}`}
      >
        {isActive ? 'Deactivate' : 'Reactivate'}
      </button>

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            {resetSuccess ? (
              <>
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-600">
                  ✓
                </div>
                <h3 className="text-center text-lg font-semibold text-neutral-900">Password reset</h3>
                <p className="mt-2 text-center text-sm text-neutral-500">
                  Share the new password with them directly — they can sign in with it right away.
                </p>
                <button
                  onClick={closeResetModal}
                  className="mt-5 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-neutral-900">Reset password</h3>
                {error && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                )}
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button onClick={closeResetModal} className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {loading ? 'Saving…' : 'Reset'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}