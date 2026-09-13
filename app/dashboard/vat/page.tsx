import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  buildVatBreakdown,
  dayLabel,
  fetchCompletedSalesForMonth,
  getVatRate,
  monthLabel,
  monthOptions,
  resolveMonth,
} from '@/lib/vat'

function money(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const month = resolveMonth(monthParam)
  const label = monthLabel(month)

  const supabase = await createClient()
  const { vatRate, error: settingsError } = await getVatRate(supabase)
  const vatConfigured = vatRate > 0

  const { rows, error: salesError } = vatConfigured
    ? await fetchCompletedSalesForMonth(supabase, month)
    : { rows: [], error: null }

  const { days, totals } = buildVatBreakdown(rows, vatRate)

  const months = monthOptions()
  const monthChoices = months.includes(month) ? months : [month, ...months]

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/reports"
            className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
          >
            ← Reports
          </Link>

          <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            VAT Report{' '}
            <span className="text-neutral-400 dark:text-neutral-500">
              · {label}
            </span>
          </h1>
        </div>

        {vatConfigured && (
          <a
            href={`/api/vat-csv?month=${month}`}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Download CSV
          </a>
        )}
      </div>

      {settingsError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Couldn&apos;t load your VAT rate from settings: {settingsError}
        </p>
      )}

      {salesError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Couldn&apos;t load sales for this period: {salesError}. The figures
          below are incomplete — don&apos;t file from them.
        </p>
      )}

      {!vatConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            VAT isn&apos;t set up yet
          </h2>

          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            There&apos;s no VAT rate saved for this store, so there are no VAT
            figures to report. Add your rate (for example 7.5) in Settings and
            this report will fill in.
          </p>

          <Link
            href="/dashboard/settings"
            className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            Go to Settings
          </Link>
        </div>
      ) : (
        <>
          {/* Month selector */}
          <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div>
              <label
                htmlFor="month"
                className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
              >
                Filing period
              </label>

              <select
                id="month"
                name="month"
                defaultValue={month}
                className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
              >
                {monthChoices.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
            >
              Show month
            </button>

            <p className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">
              This page&apos;s web address includes the month, so you can
              bookmark or share it.
            </p>
          </form>

          {/* Honest caveat — the rate is not stored per sale */}
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Please read before filing
            </h2>

            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              Past sales don&apos;t record the VAT rate that was in force on the
              day they were rung up. Every figure on this page is therefore
              worked out at your VAT rate as it stands today,{' '}
              <span className="font-semibold">{vatRate}%</span>. If the rate was
              different at any point during {label}, the numbers here will be
              wrong for those days and need checking by hand before you send
              anything to FIRS.
            </p>

            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              Your prices already include VAT, so the VAT shown is the portion
              sitting inside each sale total — the same figure printed on the
              customer&apos;s receipt, not an extra charge added on top.
              Refunded and cancelled sales are left out.
            </p>
          </div>

          {/* Headline figures */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Gross sales
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                {money(totals.gross)}
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                VAT included
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Net of VAT
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                {money(totals.net)}
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                Your share of the takings
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                VAT at {vatRate}%
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {money(totals.vat)}
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                Payable for {label}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Completed sales
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                {totals.numSales.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                Refunds and cancellations excluded
              </p>
            </div>
          </div>

          {/* Per-day breakdown */}
          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Day by day
          </h2>

          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Net of VAT</th>
                  <th className="px-4 py-3 text-right">VAT</th>
                </tr>
              </thead>

              <tbody>
                {days.map((d) => (
                  <tr
                    key={d.day}
                    className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-900 dark:text-neutral-100">
                      {dayLabel(d.day)}
                    </td>

                    <td className="px-4 py-3 text-right text-neutral-500 dark:text-neutral-400">
                      {d.numSales}
                    </td>

                    <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-100">
                      {money(d.gross)}
                    </td>

                    <td className="px-4 py-3 text-right text-neutral-500 dark:text-neutral-400">
                      {money(d.net)}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {money(d.vat)}
                    </td>
                  </tr>
                ))}

                {days.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-neutral-400 dark:text-neutral-500"
                    >
                      No completed sales in {label}.
                    </td>
                  </tr>
                )}
              </tbody>

              {days.length > 0 && (
                <tfoot>
                  <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold text-neutral-900 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{totals.numSales}</td>
                    <td className="px-4 py-3 text-right">
                      {money(totals.gross)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(totals.net)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                      {money(totals.vat)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
