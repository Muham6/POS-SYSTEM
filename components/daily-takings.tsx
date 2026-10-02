import { money } from '@/lib/money'

export type TakingsDay = {
  day: string
  sales: number
  cash: number
  transfer: number
  card: number
  refunds: number
}

function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// What each payment method should have brought in per day — the figure to
// check the drawer, the POS terminal and the bank against.
export default function DailyTakings({ days, note }: { days: TakingsDay[]; note?: string }) {
  if (days.length === 0) return null

  const totals = days.reduce(
    (acc, d) => ({
      sales: acc.sales + d.sales,
      cash: acc.cash + d.cash,
      transfer: acc.transfer + d.transfer,
      card: acc.card + d.card,
      refunds: acc.refunds + d.refunds,
    }),
    { sales: 0, cash: 0, transfer: 0, card: 0, refunds: 0 }
  )

  const cell = 'px-4 py-3 text-right'

  return (
    <div className="mb-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        Expected takings by day
      </h2>
      <p className="mb-3 text-xs text-neutral-400 dark:text-neutral-500">
        Money taken each day by payment method, less refunds paid out that day.
        {note && ` ${note}`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
              <th className="px-4 py-3">Date</th>
              <th className={cell}>Sales</th>
              <th className={cell}>Cash</th>
              <th className={cell}>Transfer</th>
              <th className={cell}>Card</th>
              <th className={cell}>Refunded</th>
              <th className={cell}>Total</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="whitespace-nowrap px-4 py-3 text-neutral-900 dark:text-neutral-100">{dayLabel(d.day)}</td>
                <td className={`${cell} text-neutral-500 dark:text-neutral-400`}>{d.sales}</td>
                <td className={`${cell} text-neutral-900 dark:text-neutral-100`}>{money(d.cash)}</td>
                <td className={`${cell} text-neutral-900 dark:text-neutral-100`}>{money(d.transfer)}</td>
                <td className={`${cell} text-neutral-900 dark:text-neutral-100`}>{money(d.card)}</td>
                <td className={`${cell} text-neutral-500 dark:text-neutral-400`}>
                  {d.refunds > 0 ? `−${money(d.refunds)}` : '—'}
                </td>
                <td className={`${cell} font-medium text-neutral-900 dark:text-neutral-100`}>
                  {money(d.cash + d.transfer + d.card)}
                </td>
              </tr>
            ))}
          </tbody>
          {days.length > 1 && (
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold text-neutral-900 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                <td className="px-4 py-3">Total</td>
                <td className={cell}>{totals.sales}</td>
                <td className={cell}>{money(totals.cash)}</td>
                <td className={cell}>{money(totals.transfer)}</td>
                <td className={cell}>{money(totals.card)}</td>
                <td className={cell}>{totals.refunds > 0 ? `−${money(totals.refunds)}` : '—'}</td>
                <td className={cell}>{money(totals.cash + totals.transfer + totals.card)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
