import type { Currency, Loan } from '@/types'
import { toBase } from '@/lib/format'

// ============================================================================
// Ordering for the Loans & EMIs lists. Pure, so scripts/test-sorting.mjs can
// pin down the awkward cases — finished items, missing dates, mixed currencies.
// ============================================================================

export type SortKey = 'due-asc' | 'due-desc' | 'amount-desc' | 'name'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'due-asc', label: 'Next due — soonest first' },
  { key: 'due-desc', label: 'Next due — latest first' },
  { key: 'amount-desc', label: 'Largest amount first' },
  { key: 'name', label: 'Name A–Z' },
]

/** What every sortable row has to offer, whatever it is. */
interface Sortable {
  name: string
  /** The next date something falls due; undefined once nothing is left to pay. */
  due?: string
  /** Base-currency amount, so a rupee loan and a dirham loan compare fairly. */
  amount: number
}

/**
 * Something with nothing left to pay has no next date, and sorting it by one
 * would scatter finished items through the list. They always go to the end of
 * a date order, in either direction, and fall back to name between themselves.
 */
function compare(a: Sortable, b: Sortable, key: SortKey) {
  const byName = a.name.localeCompare(b.name)
  if (key === 'name') return byName
  if (key === 'amount-desc') return b.amount - a.amount || byName
  if (!a.due && !b.due) return byName
  if (!a.due) return 1
  if (!b.due) return -1
  const order = a.due.localeCompare(b.due)
  return (key === 'due-asc' ? order : -order) || byName
}

export function sortBy<T>(items: T[], key: SortKey, view: (item: T) => Sortable): T[] {
  const keyed = items.map((item) => ({ item, s: view(item) }))
  keyed.sort((a, b) => compare(a.s, b.s, key))
  return keyed.map((k) => k.item)
}

export const loanSortView = (l: Loan): Sortable => ({
  name: l.name,
  // A closed loan has nothing due, whatever nextPayment still says.
  due: l.status === 'Closed' || !l.nextPayment ? undefined : l.nextPayment,
  amount: toBase(l.outstanding, l.currency),
})

export const planSortView = (
  title: string,
  summary: { nextDate?: string; outstanding: number },
  currency: Currency,
): Sortable => ({
  name: title,
  due: summary.outstanding > 0 ? summary.nextDate : undefined,
  amount: toBase(summary.outstanding, currency),
})
