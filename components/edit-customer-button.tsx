'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Customer = {
  id: string
  name: string | null
  company_or_store: string | null
  phone: string | null
}

export default function EditCustomerButton({ customer }: { customer: Customer }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(customer.name || '')
  const [company, setCompany] = useState(customer.company_or_store || '')
  const [phone, setPhone] = useState(customer.phone || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function openForm() {
    // Start from what's saved now, not whatever was typed and cancelled last time.
    setName(customer.name || '')
    setCompany(customer.company_or_store || '')
    setPhone(customer.phone || '')
    setError('')
    setOpen(true)
  }

  async function handleSave() {
    setError('')
    if (!name.trim() && !company.trim()) {
      setError('Enter a name or a company/store name.')
      return
    }

    setSaving(true)
    const { data, error: updateError } = await supabase
      .from('customers')
      .update({
        name: name.trim() || null,
        company_or_store: company.trim() || null,
        phone: phone.trim() || null,
      })
      .eq('id', customer.id)
      .select('id')
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    // When the database's access rules refuse an update, Supabase reports
    // success with nothing changed — so check that the row really was saved.
    if (!data || data.length === 0) {
      setError("The change wasn't saved — your account isn't allowed to edit customers.")
      return
    }

    setOpen(false)
    router.refresh()
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400'
  const labelClass = 'block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400'

  return (
    <>
      <button
        onClick={openForm}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <Pencil size={14} />
        Edit details
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-neutral-900">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Edit customer</h3>
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
            <div className="mt-3 space-y-3">
              <div>
                <label className={labelClass}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Company / store</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
