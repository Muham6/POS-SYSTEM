'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string
  productName: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirmDelete() {
    setError('')
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      setError('Could not verify your session. Please refresh and try again.')
      setLoading(false)
      return
    }

    // Re-check the admin's password before allowing the delete
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })

    if (authError) {
      setError('Incorrect password.')
      setLoading(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId)

    setLoading(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setOpen(false)
    setPassword('')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-red-600 hover:underline"
      >
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-neutral-900">Delete product</h3>
            <p className="mt-1 text-sm text-neutral-500">
              This will remove <span className="font-medium text-neutral-800">{productName}</span> from
              the active product list. Confirm your admin password to continue.
            </p>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setOpen(false)
                  setPassword('')
                  setError('')
                }}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading || !password}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}