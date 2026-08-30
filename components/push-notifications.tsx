'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

type Status = 'unsupported' | 'checking' | 'off' | 'on' | 'denied'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export default function PushNotifications() {
  const [status, setStatus] = useState<Status>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkStatus() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }
      const registration = await navigator.serviceWorker.getRegistration()
      const existing = await registration?.pushManager.getSubscription()
      setStatus(existing ? 'on' : 'off')
    }
    checkStatus()
  }, [])

  async function handleEnable() {
    setError('')
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        setBusy(false)
        return
      }

      await navigator.serviceWorker.register('/sw.js')
      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setError('Push notifications are not configured for this app yet.')
        setBusy(false)
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      // Don't trust res.ok alone — a redirected request (e.g. an expired
      // session bounced to /login) still resolves with a 200 "ok" response.
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not save subscription. Try signing in again.')
        setBusy(false)
        return
      }

      setStatus('on')
    } catch {
      setError('Could not enable notifications on this device.')
    }
    setBusy(false)
  }

  async function handleDisable() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setStatus('off')
    } catch {
      setError('Could not disable notifications.')
    }
    setBusy(false)
  }

  if (status === 'unsupported') {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        This browser doesn&apos;t support push notifications.
      </p>
    )
  }

  if (status === 'denied') {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Notifications are blocked for this site in your browser settings. Allow them there to enable low-stock alerts.
      </p>
    )
  }

  return (
    <div>
      {error && (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {status === 'on' ? (
        <button
          type="button"
          onClick={handleDisable}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Bell size={16} className="text-emerald-600 dark:text-emerald-400" />
          Alerts enabled on this device — turn off
        </button>
      ) : (
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy || status === 'checking'}
          className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <BellOff size={16} />
          {busy ? 'Enabling…' : 'Enable low-stock alerts on this device'}
        </button>
      )}
    </div>
  )
}
