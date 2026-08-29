'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Wallet, CheckCircle2 } from 'lucide-react'

type OpenShift = {
  id: string
  opened_at: string
  opening_float: number
}

export default function ShiftPage() {
  const supabase = createClient()
  const [shift, setShift] = useState<OpenShift | null>(null)
  const [cashSoFar, setCashSoFar] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openingFloat, setOpeningFloat] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ expected: number; counted: number; variance: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: openShift } = await supabase
      .from('shifts')
      .select('id, opened_at, opening_float')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .maybeSingle()

    setShift(openShift)

    if (openShift) {
      const { data: sales } = await supabase
        .from('sales')
        .select('cash_amount')
        .eq('shift_id', openShift.id)
        .eq('status', 'completed')
      const total = (sales || []).reduce((sum, s) => sum + Number(s.cash_amount), 0)
      setCashSoFar(total)
    }

    setLoading(false)
  }

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.rpc('open_shift', { p_opening_float: parseFloat(openingFloat) || 0 })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setOpeningFloat('')
    load()
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!shift) return
    const counted = parseFloat(countedCash)
    if (isNaN(counted)) {
      setError('Enter the counted cash amount.')
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc('close_shift', {
      p_shift_id: shift.id,
      p_counted_cash: counted,
      p_note: note || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    const expected = shift.opening_float + cashSoFar
    setResult({ expected, counted, variance: counted - expected })
    setShift(null)
    setCountedCash('')
    setNote('')
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading shift…</p>

  if (result) {
    const balanced = Math.abs(result.variance) < 0.01
    return (
      <div className="mx-auto max-w-sm text-center">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${balanced ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
          <CheckCircle2 size={28} />
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">Shift closed</h1>
        <div className="mt-6 space-y-2 rounded-xl border border-neutral-200 bg-white p-5 text-left text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Expected cash</span>
            <span>₦{result.expected.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Counted cash</span>
            <span>₦{result.counted.toLocaleString()}</span>
          </div>
          <div className={`flex justify-between border-t border-neutral-100 pt-2 font-semibold ${balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
            <span>{balanced ? 'Balanced' : result.variance > 0 ? 'Over' : 'Short'}</span>
            <span>₦{Math.abs(result.variance).toLocaleString()}</span>
          </div>
        </div>
        <button
          onClick={() => setResult(null)}
          className="mt-6 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Done
        </button>
      </div>
    )
  }

  if (!shift) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
          <Clock size={28} className="mx-auto mb-3 text-neutral-300" />
          <h1 className="text-lg font-semibold text-neutral-900">Start your shift</h1>
          <p className="mt-1 text-sm text-neutral-500">Enter how much cash is in the drawer right now.</p>
          <form onSubmit={handleOpen} className="mt-4 space-y-3">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-600">
                {error}
              </p>
            )}
            <input
              type="number"
              step="0.01"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="Opening cash (e.g. 5000)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-sm outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {saving ? 'Starting…' : 'Clock In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-emerald-700">
          <Wallet size={16} />
          <span className="text-xs font-medium uppercase tracking-wider">Shift open</span>
        </div>
        <p className="mt-1 text-xs text-emerald-600">
          Started {new Date(shift.opened_at).toLocaleString('en-NG', { timeStyle: 'short', dateStyle: 'medium' })}
        </p>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-5 text-sm">
        <div className="flex justify-between text-neutral-600">
          <span>Opening float</span>
          <span>₦{shift.opening_float.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-neutral-600">
          <span>Cash sales so far</span>
          <span>₦{cashSoFar.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-100 pt-2 font-semibold text-neutral-900">
          <span>Expected in drawer</span>
          <span>₦{(shift.opening_float + cashSoFar).toLocaleString()}</span>
        </div>
      </div>

      <form onSubmit={handleClose} className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Close shift</h2>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <input
          type="number"
          step="0.01"
          value={countedCash}
          onChange={(e) => setCountedCash(e.target.value)}
          placeholder="Cash counted in drawer"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-60"
        >
          {saving ? 'Closing…' : 'Clock Out'}
        </button>
      </form>
    </div>
  )
}