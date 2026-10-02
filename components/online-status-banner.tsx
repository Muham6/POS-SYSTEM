'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getQueuedSales, removeQueuedSale, markQueuedSaleFailed, type QueuedSale } from '@/lib/offline-queue'
import { recordSale } from '@/lib/record-sale'
import { money } from '@/lib/money'
import { SHOP_TIME_ZONE } from '@/lib/time'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function OnlineStatusBanner() {
  const supabase = createClient()
  const [online, setOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)
  const [failed, setFailed] = useState<QueuedSale[]>([])
  const [showFailed, setShowFailed] = useState(false)

  const syncLockRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine)
    setQueuedCount(getQueuedSales().length)
    setFailed(getQueuedSales().filter((s) => s.lastError))

    function handleOnline() {
      setOnline(true)
      flushQueue()
    }

    function handleOffline() {
      setOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (navigator.onLine) flushQueue()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Two tabs can both come back online at the same moment and both see the
  // same queued sale before either has removed it — without a cross-tab
  // lock they'd both submit it, double-decrementing stock. navigator.locks
  // is a real mutex across every tab on this origin, not just this component
  // instance, so only one tab ever runs the flush at a time.
  async function flushQueue() {
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      await navigator.locks.request('pos-offline-sync', { ifAvailable: true }, async (lock) => {
        if (!lock) return // another tab is already flushing — its run will cover this queue
        await runFlush()
      })
      return
    }

    // Fallback for browsers without the Locks API: at least stays correct within this tab.
    if (syncLockRef.current) return
    syncLockRef.current = true
    await runFlush()
    syncLockRef.current = false
  }

  async function runFlush() {
    const queue = getQueuedSales()
    if (queue.length === 0) return

    setSyncing(true)
    let succeeded = 0

    for (const sale of queue) {
      const stillQueued = getQueuedSales().some(
        (s) => s.localId === sale.localId
      )

      if (!stillQueued) continue

      // Sent with the time it was actually rung up, and a reference that stops
      // it being recorded twice if it already reached the server.
      const result = await recordSale(supabase, {
        clientRef: sale.clientRef || sale.localId,
        items: sale.payload.p_items,
        cash: sale.payload.p_cash_amount,
        card: sale.payload.p_card_amount,
        transfer: sale.payload.p_transfer_amount,
        customerId: sale.payload.p_customer_id,
        soldAt: sale.createdAt,
      })

      if (!result.error) {
        removeQueuedSale(sale.localId)
        succeeded++
        continue
      }

      // Still no connection: stop and try the lot again later.
      if (result.networkFailure) break

      // Refused (e.g. stock ran out while offline). Keep it — the customer has
      // paid — and show why, so someone can sort it out.
      markQueuedSaleFailed(sale.localId, result.error)
    }

    setQueuedCount(getQueuedSales().length)
    setFailed(getQueuedSales().filter((s) => s.lastError))
    setSyncing(false)

    if (succeeded > 0) {
      setJustSynced(true)
      setTimeout(() => setJustSynced(false), 4000)
    }
  }

  function discardFailed(sale: QueuedSale) {
    const ok = window.confirm(
      'Only remove this if the sale has already been rung up again or refunded. It cannot be brought back.'
    )
    if (!ok) return
    removeQueuedSale(sale.localId)
    setQueuedCount(getQueuedSales().length)
    setFailed(getQueuedSales().filter((s) => s.lastError))
  }

  if (online && queuedCount === 0 && !justSynced) return null

  return (
    <>
      <div
        className={`flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium ${
          !online
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
            : justSynced
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
        }`}
      >
        {!online ? (
          <>
            <WifiOff size={14} />
            You&apos;re offline — sales are being saved on this device and will submit automatically once reconnected.
          </>
        ) : syncing ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            Syncing {queuedCount} saved sale{queuedCount === 1 ? '' : 's'}…
          </>
        ) : queuedCount > 0 ? (
          <>
            <RefreshCw size={14} />
            {queuedCount} sale{queuedCount === 1 ? '' : 's'} waiting to sync.
            <button onClick={flushQueue} className="ml-1 underline">
              Retry now
            </button>
          </>
        ) : (
          <>Back online — everything synced.</>
        )}
        {failed.length > 0 && !syncing && (
          <button onClick={() => setShowFailed((v) => !v)} className="ml-2 font-semibold text-red-600 underline dark:text-red-300">
            {failed.length} couldn&apos;t be sent — {showFailed ? 'hide' : 'see why'}
          </button>
        )}
      </div>
      {showFailed && failed.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="mb-2 font-medium">
            These sales were paid for but the system refused them. They are saved on this device only. Ring them up
            again (or refund the customer), then remove them here.
          </p>
          <ul className="space-y-2">
            {failed.map((sale) => (
              <li key={sale.localId} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {new Date(sale.createdAt).toLocaleString('en-NG', {
                    timeZone: SHOP_TIME_ZONE,
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  ·{' '}
                  {money(sale.payload.p_cash_amount + sale.payload.p_card_amount + sale.payload.p_transfer_amount)} ·{' '}
                  {sale.lastError}
                </span>
                <button onClick={() => discardFailed(sale)} className="underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}