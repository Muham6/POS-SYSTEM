'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getQueuedSales, removeQueuedSale } from '@/lib/offline-queue'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function OnlineStatusBanner() {
  const supabase = createClient()
  const [online, setOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  const syncLockRef = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine)
    setQueuedCount(getQueuedSales().length)

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

      const { error } = await supabase.rpc(
        'process_sale',
        sale.payload
      )

      if (!error) {
        removeQueuedSale(sale.localId)
        succeeded++
      }

      // If it fails (e.g. stock ran out while offline), leave it queued —
      // an admin can review it rather than silently losing the record.
    }

    setQueuedCount(getQueuedSales().length)
    setSyncing(false)

    if (succeeded > 0) {
      setJustSynced(true)
      setTimeout(() => setJustSynced(false), 4000)
    }
  }

  if (online && queuedCount === 0 && !justSynced) return null

  return (
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
    </div>
  )
}