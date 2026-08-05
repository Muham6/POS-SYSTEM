'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    store_name: '',
    address: '',
    phone: '',
    footer_message: '',
    return_policy: '',
  })

  useEffect(() => {
    supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            store_name: data.store_name || '',
            address: data.address || '',
            phone: data.phone || '',
            footer_message: data.footer_message || '',
            return_policy: data.return_policy || '',
          })
        }
        setLoading(false)
      })
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const { error } = await supabase
      .from('store_settings')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', 1)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }
    setSuccess('Saved. New receipts will use these details.')
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading settings…</p>
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Store Settings</h1>
      <p className="mb-6 text-sm text-neutral-500">
        This information appears on every receipt printed from the Sell page.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {success && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        )}

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Store name</label>
          <input
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Shop address"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Phone number</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="e.g. 080X XXX XXXX"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            Thank-you message
          </label>
          <input
            value={form.footer_message}
            onChange={(e) => setForm({ ...form, footer_message: e.target.value })}
            placeholder="Thank you for your patronage!"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">
            Return policy
          </label>
          <textarea
            value={form.return_policy}
            onChange={(e) => setForm({ ...form, return_policy: e.target.value })}
            rows={2}
            placeholder="Goods sold in good condition are not returnable."
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}