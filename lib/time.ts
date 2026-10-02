// The shop runs on Nigerian time, but the server (and the database) run on UTC.
// Left alone, "today" flips over at 1am, a sale rung up at 00:30 lands on the
// previous day, and server-rendered times read an hour early. Everything that
// turns a timestamp into a day, or a day into a range, goes through here.
//
// Nigeria (WAT) is UTC+1 all year with no daylight saving, so a fixed offset is
// exact.
export const SHOP_TIME_ZONE = 'Africa/Lagos'
const SHOP_UTC_OFFSET = '+01:00'

/** First instant of a shop day (YYYY-MM-DD), for a >= filter. */
export function dayStart(day: string): string {
  return `${day}T00:00:00${SHOP_UTC_OFFSET}`
}

/** Last instant of a shop day (YYYY-MM-DD), for a <= filter. */
export function dayEnd(day: string): string {
  return `${day}T23:59:59.999${SHOP_UTC_OFFSET}`
}

/** The shop day (YYYY-MM-DD) a timestamp falls on. */
export function shopDay(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: SHOP_TIME_ZONE })
}

/** Today's date in the shop, as YYYY-MM-DD. */
export function shopToday(): string {
  return shopDay(new Date())
}

/** The shop day n days before today, as YYYY-MM-DD. */
export function shopDaysAgo(n: number): string {
  const d = new Date(`${shopToday()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
