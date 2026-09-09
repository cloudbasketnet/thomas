import type { Account, Bill, BudgetCategory, Goal, Loan, Transaction } from '@/types'
import { toBase, monthKey, daysLeft, TODAY, addMonths, monthLabel } from '@/lib/format'

/** The live calendar month, so every "this month" figure follows the real clock. */
export const CURRENT_MONTH = TODAY.slice(0, 7)
export const PREV_MONTH = addMonths(CURRENT_MONTH, -1)

export function inMonth(txns: Transaction[], month = CURRENT_MONTH) {
  return txns.filter((t) => monthKey(t.date) === month)
}

export function sumBase(txns: Transaction[]) {
  return txns.reduce((acc, t) => acc + toBase(t.amount, t.currency), 0)
}

export function totals(txns: Transaction[], month = CURRENT_MONTH) {
  const m = inMonth(txns, month)
  const income = sumBase(m.filter((t) => t.type === 'income'))
  const expenses = sumBase(m.filter((t) => t.type === 'expense'))
  return { income, expenses, net: income - expenses, count: m.length }
}

export function byCategory(txns: Transaction[], type: 'income' | 'expense', month = CURRENT_MONTH) {
  const map = new Map<string, number>()
  for (const t of inMonth(txns, month)) {
    if (t.type !== type) continue
    map.set(t.category, (map.get(t.category) ?? 0) + toBase(t.amount, t.currency))
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function byPerson(txns: Transaction[], month = CURRENT_MONTH) {
  const map = new Map<string, number>()
  for (const t of inMonth(txns, month)) {
    if (t.type !== 'expense') continue
    const key = t.person || 'Me'
    map.set(key, (map.get(key) ?? 0) + toBase(t.amount, t.currency))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function byMethod(txns: Transaction[], month = CURRENT_MONTH) {
  const map = new Map<string, number>()
  for (const t of inMonth(txns, month)) {
    if (t.type !== 'expense') continue
    const key = t.method || 'Other'
    map.set(key, (map.get(key) ?? 0) + toBase(t.amount, t.currency))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function byAccount(txns: Transaction[], type: 'income' | 'expense', accounts: Account[], month = CURRENT_MONTH) {
  const map = new Map<string, number>()
  for (const t of inMonth(txns, month)) {
    if (t.type !== type) continue
    map.set(t.accountId, (map.get(t.accountId) ?? 0) + toBase(t.amount, t.currency))
  }
  return [...map.entries()]
    .map(([id, value]) => ({ name: accounts.find((a) => a.id === id)?.name ?? 'Other', value }))
    .sort((a, b) => b.value - a.value)
}

/** Trailing 9 months ending on the current one, built from your transactions. */
export function monthlySeries(txns: Transaction[]) {
  return Array.from({ length: 9 }, (_, i) => {
    const key = addMonths(CURRENT_MONTH, i - 8)
    const live = totals(txns, key)
    return { month: monthLabel(key), income: Math.round(live.income), expenses: Math.round(live.expenses) }
  })
}

/** Month labels for the trailing 9-month window, oldest first. */
export function seriesRange() {
  const from = monthLabel(addMonths(CURRENT_MONTH, -8))
  const to = monthLabel(CURRENT_MONTH)
  return `${from} – ${to} ${CURRENT_MONTH.slice(0, 4)}`
}

/** Human label for the active month, e.g. 'September 2026'. */
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export function currentMonthLabel(key = CURRENT_MONTH) {
  return `${LONG_MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
}

export function accountTotals(accounts: Account[]) {
  const sum = (type: Account['type']) =>
    accounts.filter((a) => a.type === type).reduce((acc, a) => acc + toBase(a.balance, a.currency), 0)
  const bank = sum('bank')
  const cash = sum('cash')
  const card = sum('card')
  const loan = sum('loan')
  return {
    bank, cash, card, loan,
    // Gross is what the four buckets add up to; net treats cards and loans as
    // the liabilities they are.
    total: bank + cash + card + loan,
    net: bank + cash - card - loan,
  }
}

/** Liquid balance = bank + cash, minus card outstanding. */
export function liquidBalance(accounts: Account[]) {
  const t = accountTotals(accounts)
  return t.bank + t.cash - t.card
}

export function loanSummary(loans: Loan[]) {
  const active = loans.filter((l) => l.status !== 'Closed')
  const outstanding = active.reduce((acc, l) => acc + toBase(l.outstanding, l.currency), 0)
  const monthlyEmi = active.reduce((acc, l) => acc + toBase(l.emi, l.currency), 0)
  const dueThisMonth = active.filter((l) => monthKey(l.nextPayment) === CURRENT_MONTH)
  const dueAmount = dueThisMonth.reduce((acc, l) => acc + toBase(l.emi, l.currency), 0)
  const overdue = active.filter((l) => l.status === 'Overdue')
  return { active, outstanding, monthlyEmi, dueThisMonth, dueAmount, overdue }
}

export function billSummary(bills: Bill[]) {
  const upcoming = bills.filter((b) => b.status !== 'Paid')
  const upcomingTotal = upcoming.reduce((acc, b) => acc + b.amount, 0)
  const overdue = bills.filter((b) => b.status === 'Overdue')
  const paidTotal = bills.filter((b) => b.status === 'Paid').reduce((acc, b) => acc + b.amount, 0)
  return { upcoming, upcomingTotal, overdue, paidTotal }
}

export function docStatus(expiry: string): 'Valid' | 'Expiring Soon' | 'Expired' {
  const d = daysLeft(expiry, TODAY)
  if (d < 0) return 'Expired'
  if (d <= 30) return 'Expiring Soon'
  return 'Valid'
}

/**
 * The "This Month Plan" figure on the dashboard. Every line is derived — the
 * savings line is what your goals need per month to land by their deadlines.
 */
export function monthPlan(txns: Transaction[], loans: Loan[], bills: Bill[], goals: Goal[] = []) {
  const t = totals(txns, CURRENT_MONTH)
  const requiredExpenses = Math.round(t.expenses)
  const upcomingLoans = Math.round(loanSummary(loans).dueAmount)
  const upcomingBills = Math.round(billSummary(bills).upcomingTotal)
  const savings = Math.round(
    goals.reduce((acc, g) => {
      const remaining = Math.max(0, g.target - g.saved)
      if (!remaining) return acc
      const months = Math.max(1, Math.round(daysLeft(g.deadline) / 30))
      return acc + remaining / months
    }, 0),
  )
  const totalRequired = requiredExpenses + upcomingLoans + upcomingBills + savings
  const expectedIncome = Math.round(t.income)
  return {
    requiredExpenses,
    upcomingLoans,
    upcomingBills,
    savings,
    totalRequired,
    expectedIncome,
    shortfall: Math.max(0, totalRequired - expectedIncome),
  }
}


// ---------------------------------------------------------------------------
// Budget spend is derived from transactions rather than stored, so every
// expense you record moves the matching budget bar on its own.
// ---------------------------------------------------------------------------

/** Keywords that tie a transaction category to a budget category name. */
const BUDGET_KEYWORDS: Record<string, string[]> = {
  'home / rent': ['home', 'rent', 'family', 'housing'],
  'family support': ['family', 'home', 'support'],
  groceries: ['grocer', 'food', 'supermarket'],
  transport: ['transport', 'fuel', 'car', 'travel'],
  utilities: ['utilit', 'bill'],
  subscriptions: ['subscription', 'bill', 'entertainment'],
  shopping: ['shopping', 'clothing'],
  restaurants: ['restaurant', 'dining', 'eat'],
  health: ['health', 'medical', 'pharmacy'],
  personal: ['personal', 'care'],
  education: ['education', 'school', 'tuition'],
  'loan payment': ['loan', 'emi', 'debt'],
}

/** The budget a transaction category belongs to, or undefined when none fits. */
export function matchBudget(category: string, budgets: BudgetCategory[]) {
  const cat = category.trim().toLowerCase()
  const keys = BUDGET_KEYWORDS[cat] ?? cat.split(/[^a-z]+/).filter((w) => w.length > 2)

  // An exact name match always wins over keyword matching.
  const exact = budgets.find((b) => b.name.trim().toLowerCase() === cat)
  if (exact) return exact

  return budgets.find((b) => {
    const name = b.name.toLowerCase()
    return keys.some((k) => name.includes(k))
  })
}

/** Actual spend per budget id for the given month, in AED. */
export function budgetSpend(txns: Transaction[], budgets: BudgetCategory[], month = CURRENT_MONTH) {
  const out = new Map<string, number>(budgets.map((b) => [b.id, 0]))
  for (const t of inMonth(txns, month)) {
    if (t.type !== 'expense') continue
    const b = matchBudget(t.category, budgets)
    if (b) out.set(b.id, (out.get(b.id) ?? 0) + toBase(t.amount, t.currency))
  }
  return out
}

/** Budgets with `spent` replaced by the live figure derived from transactions. */
export function budgetsWithSpend(txns: Transaction[], budgets: BudgetCategory[], month = CURRENT_MONTH) {
  const spend = budgetSpend(txns, budgets, month)
  return budgets.map((b) => ({ ...b, spent: Math.round(spend.get(b.id) ?? 0) }))
}

/** Expenses in the month that no budget category covers. */
export function unbudgetedSpend(txns: Transaction[], budgets: BudgetCategory[], month = CURRENT_MONTH) {
  return inMonth(txns, month)
    .filter((t) => t.type === 'expense' && !matchBudget(t.category, budgets))
    .reduce((a, t) => a + toBase(t.amount, t.currency), 0)
}
