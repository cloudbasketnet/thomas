import type {
  Account, Bill, BudgetCategory, Doc, Goal, Loan, Note, Person, PriceWatch, Purchase, Settings, Transaction,
} from '@/types'
import { TODAY } from '@/lib/format'

/** First and last day of the month `iso` falls in. */
function monthBounds(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${last}` }
}

const period = monthBounds(TODAY)

/**
 * Defaults for a brand-new account. Everything starts empty and at zero —
 * figures only appear once you enter your own.
 */
export const SETTINGS: Settings = {
  userName: 'Thomas',
  accountLabel: 'Personal Account',
  baseCurrency: 'AED',
  monthlyIncomeTarget: 0,
  monthlyBudget: 0,
  periodStart: period.start,
  periodEnd: period.end,
}

/** Conversion rates into the AED base. Edit these to match your own. */
export const FX: Record<string, number> = { AED: 1, INR: 0.0434, USD: 3.6725 }

export const ACCOUNTS: Account[] = []
export const TRANSACTIONS: Transaction[] = []
export const BUDGETS: BudgetCategory[] = []
export const LOANS: Loan[] = []
export const PEOPLE: Person[] = []
export const BILLS: Bill[] = []
export const DOCUMENTS: Doc[] = []
export const NOTES: Note[] = []
export const GOALS: Goal[] = []
export const PURCHASES: Purchase[] = []
export const PRICE_WATCH: PriceWatch[] = []
