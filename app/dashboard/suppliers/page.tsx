'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'
import { Truck, Pencil, Trash2 } from 'lucide-react'

type Supplier = {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  is_active: boolean
}

export default function SuppliersPage() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const { data, error } = await supabase.from('suppliers').select('*').order('name')
    if (error) setError(error.message)
    setSuppliers(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', contact_person: '', phone: '', email: '', address: '' })
    setShowForm(true)
    setError('')
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({
      name: s.name,
      contact_person: s.contact_person || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
    })
    setShowForm(true)
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Supplier name is required.')
      return
    }

    if (editing) {
      const { error } = await supabase.from('suppliers').update(form).eq('id', editing.id)
      if (error) {
        setError(error.message)
        return
      }
    } else {
      const { error } = await supabase.from('suppliers').insert(form)
      if (error) {
        setError(error.message)
        return
      }
    }

    setShowForm(false)
    showToast(editing ? 'Supplier updated' : 'Supplier added')
    load()
  }

  async function toggleActive(s: Supplier) {
    setError('')
    const { error } = await supabase.from('suppliers').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) {
      setError(error.message)
      return
    }
    showToast(s.is_active ? `${s.name} deactivated` : `${s.name} reactivated`)
    load()
  }

  if (loading) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading suppliers…</p>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Suppliers</h1>
        <button
          onClick={openNew}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          + Add Supplier
        </button>
      </div>

      {!showForm && error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">{s.name}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{s.contact_person || '—'}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{s.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                      title="Edit"
                      aria-label={`Edit ${s.name}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => toggleActive(s)}
                      className={s.is_active ? 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300' : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'}
                      title={s.is_active ? 'Deactivate' : 'Reactivate'}
                      aria-label={`${s.is_active ? 'Deactivate' : 'Reactivate'} ${s.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-neutral-400 dark:text-neutral-500">
                  <Truck size={28} className="mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handleSave} className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 dark:bg-neutral-900">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
            {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Supplier / company name"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
            />
            <input
              value={form.contact_person}
              onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              placeholder="Contact person (optional)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
            />
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone (optional)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email (optional)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
            />
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Address (optional)"
              rows={2}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}