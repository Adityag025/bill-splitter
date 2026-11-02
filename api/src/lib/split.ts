/**
 * Splits `totalCents` into `count` whole-cent shares that always add up to the total.
 * The remainder is handed out one cent at a time, starting from the first share.
 * Example: splitCents(1000, 3) -> [334, 333, 333]
 */
export function splitCents(totalCents: number, count: number): number[] {
  if (count <= 0) throw new Error('count must be positive')
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}
