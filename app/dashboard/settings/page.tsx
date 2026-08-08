'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Receipt from '@/components/receipt'
import { Upload } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    store_name: '',
    address: '',
    phone: '',
    footer_message: '',
    return_policy: '',
    logo_url: '',
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
            logo_url: data.logo_url || '',
          })
        }
        setLoading(false)
      })
  }, [supabase])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, etc).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.')
      return
    }

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `logo-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('store-assets').upload(path, file, {
      upsert: true,
    })

    if (uploadError) {
      setUploading(false)
      setError(uploadError.message)
      return
    }

    const { data: publicUrl } = supabase.storage.from('store-assets').getPublicUrl(path)
    setForm((f) => ({ ...f, logo_url: publicUrl.publicUrl }))
    setUploading(false)
  }

  function handleRemoveLogo() {
    setForm((f) => ({ ...f, logo_url: '' }))
  }

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
    setSuccess('Saved. Changes apply everywhere immediately.')
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading settings…</p>
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Store Settings</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Logo</label>
            <div className="mt-2 flex items-center gap-4">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-lg border border-neutral-200 object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-neutral-300">
                  <Upload size={20} />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : form.logo_url ? 'Replace logo' : 'Upload logo'}
              </button>
              {form.logo_url && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="text-sm text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </div>

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
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500">Phone number</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
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

        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Live receipt preview
          </p>
          <Receipt
            saleNumber="INV-PREVIEW-000000"
            dateLabel={new Date().toLocaleString('en-NG')}
            items={[
              { product_name: 'Sample item', quantity: 2, unit_name: 'piece', price: 500 },
              { product_name: 'Another item', quantity: 1, unit_name: 'piece', price: 1200 },
            ]}
            subtotal={2200}
            discount={0}
            total={2200}
            cash={2200}
            card={0}
            transfer={0}
            storeSettings={{
              store_name: form.store_name || 'Store',
              address: form.address,
              phone: form.phone,
              footer_message: form.footer_message,
              return_policy: form.return_policy,
            }}
          />
        </div>
      </div>
    </div>
  )
}