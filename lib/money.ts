// Money never shows a single decimal place: ₦107.5 reads like a typo on a
// receipt. Whole amounts stay clean (₦100), anything with kobo gets both
// digits (₦107.50).
export function money(amount: number): string {
  const fractional = Math.round(amount * 100) % 100 !== 0
  return `₦${amount.toLocaleString(undefined, {
    minimumFractionDigits: fractional ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}
