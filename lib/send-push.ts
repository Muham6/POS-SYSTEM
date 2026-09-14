import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

// SERVER-ONLY. VAPID_PRIVATE_KEY must never reach the browser.
webpush.setVapidDetails(
  'mailto:support@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

type LowStockItem = { name: string; stock_quantity: number }

// Shared by every notify* function: sends one payload to every admin
// device that's opted in, and prunes subscriptions the push service
// reports as dead (unsubscribed, expired, etc).
async function notifyAdmins(payload: string) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

  const admin = createAdminClient()

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, profiles!inner ( role )')
    .eq('profiles.role', 'admin')

  if (!subs || subs.length === 0) return

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      } catch (err: unknown) {
        // 410 Gone / 404 means the browser unsubscribed or the subscription expired.
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    })
  )
}

// Notifies every admin who has enabled alerts on a device. Uses the
// service-role client since this needs to read subscriptions across all
// admins, not just whoever triggered the sale that caused the alert.
export async function notifyLowStock(items: LowStockItem[]) {
  if (items.length === 0) return

  const title = items.length === 1 ? `Low stock: ${items[0].name}` : `Low stock: ${items.length} products`
  const body =
    items.length === 1
      ? `${items[0].stock_quantity} left — time to reorder.`
      : items.map((i) => `${i.name} (${i.stock_quantity} left)`).join(', ')

  await notifyAdmins(JSON.stringify({ title, body, url: '/dashboard/products' }))
}

type ShiftCloseSummary = {
  cashierName: string
  expected: number
  counted: number
  variance: number
}

export async function notifyShiftClosed(summary: ShiftCloseSummary) {
  const balanced = Math.abs(summary.variance) < 0.01
  const title = `${summary.cashierName} closed their shift`
  const body = balanced
    ? `Balanced — ₦${summary.counted.toLocaleString()} counted.`
    : `${summary.variance > 0 ? 'Over' : 'Short'} by ₦${Math.abs(summary.variance).toLocaleString()} — ₦${summary.counted.toLocaleString()} counted, ₦${summary.expected.toLocaleString()} expected.`

  await notifyAdmins(JSON.stringify({ title, body, url: '/dashboard/shift/history' }))
}
