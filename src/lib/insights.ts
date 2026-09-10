import type { Account, Bill, BudgetCategory, Goal, Loan, Settings, Transaction } from '@/types'
import { TODAY, daysLeft, monthKey, toBase } from '@/lib/format'
import {
  CURRENT_MONTH, PREV_MONTH, billSummary, budgetsWithSpend, byCategory, byPerson, byStore,
  liquidBalance, loanSummary, matchBudget, monthlySeries, totals, unbudgetedSpend,
} from '@/lib/selectors'

/**
 * The financial picture handed to Gemini for analysis.
 *
 * Deliberately aggregates only — category and store totals rather than
 * individual transactions. That keeps the request small and cheap, and means
 * line-by-line detail of what was bought never leaves the browser.
 */
export interface Snapshot {
  today: string
  month: string
  currency: string
  daysElapsed: number
  daysInMonth: number
  daysRemaining: number

  income: number
  incomeTarget: number
  spent: number
  budget: number
  net: number

  prevMonthSpent: number
  prevMonthIncome: number

  /** Spend projected to month end at the current daily rate. */
  projectedSpend: number

  liquidBalance: number
  categories: { name: string; spent: number; budget?: number }[]
  topStores: { name: string; spent: number }[]
  byPerson: { name: string; spent: number }[]
  unbudgeted: number

  bills: { upcomingTotal: number; overdue: number; nextDue?: string }
  loans: { outstanding: number; monthlyEmi: number; overdue: number; dueThisMonth: number }
  goals: { name: string; target: number; saved: number; monthsLeft: number }[]
  trend: { month: string; income: number; expenses: number }[]
}

const round = (n: number) => Math.round(n * 100) / 100

export function buildSnapshot(
  transactions: Transaction[],
  accounts: Account[],
  budgets: BudgetCategory[],
  bills: Bill[],
  loans: Loan[],
  goals: Goal[],
  settings: Settings,
  month = CURRENT_MONTH,
  today = TODAY,
): Snapshot {
  const t = totals(transactions, month)
  const prev = totals(transactions, PREV_MONTH)

  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  // Only count elapsed days when the report month is the one we are living in.
  const isCurrent = monthKey(today) === month
  const daysElapsed = isCurrent ? Math.min(Number(today.slice(8, 10)), daysInMonth) : daysInMonth
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed)

  const withSpend = budgetsWithSpend(transactions, budgets, month)
  const cats = byCategory(transactions, 'expense', month)
  const bs = billSummary(bills)
  const ls = loanSummary(loans)

  const upcoming = [...bs.upcoming].sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return {
    today,
    month,
    currency: settings.baseCurrency,
    daysElapsed,
    daysInMonth,
    daysRemaining,

    income: round(t.income),
    incomeTarget: round(settings.monthlyIncomeTarget),
    spent: round(t.expenses),
    budget: round(settings.monthlyBudget),
    net: round(t.net),

    prevMonthSpent: round(prev.expenses),
    prevMonthIncome: round(prev.income),
    projectedSpend: daysElapsed ? round((t.expenses / daysElapsed) * daysInMonth) : 0,

    liquidBalance: round(liquidBalance(accounts)),

    categories: cats.slice(0, 12).map((c) => {
      // Match the way budgets are resolved everywhere else. Comparing names
      // exactly would report the "Groceries" category as unbudgeted when the
      // budget is called "Grocery", and the analysis would repeat that error.
      const b = matchBudget(c.name, withSpend)
      return { name: c.name, spent: round(c.value), budget: b ? round(b.budget) : undefined }
    }),
    topStores: byStore(transactions, month)
      .filter((s) => s.name !== 'Unrecorded')
      .slice(0, 6)
      .map((s) => ({ name: s.name, spent: round(s.value) })),
    byPerson: byPerson(transactions, month).map((p) => ({ name: p.name, spent: round(p.value) })),
    unbudgeted: round(unbudgetedSpend(transactions, budgets, month)),

    bills: {
      upcomingTotal: round(bs.upcomingTotal),
      overdue: bs.overdue.length,
      nextDue: upcoming[0]?.dueDate,
    },
    loans: {
      outstanding: round(ls.outstanding),
      monthlyEmi: round(ls.monthlyEmi),
      overdue: ls.overdue.length,
      dueThisMonth: round(ls.dueAmount),
    },
    goals: goals.map((g) => ({
      name: g.name,
      target: round(g.target),
      saved: round(g.saved),
      monthsLeft: Math.max(0, Math.round(daysLeft(g.deadline, today) / 30)),
    })),
    trend: monthlySeries(transactions),
  }
}

/** True when there is enough recorded to say anything useful. */
export function hasEnoughData(s: Snapshot) {
  return s.spent > 0 || s.income > 0
}

/**
 * Budget lines already over, computed locally. These are facts rather than
 * opinions, so they are shown whether or not an AI analysis has been run.
 */
export function hardWarnings(
  transactions: Transaction[],
  budgets: BudgetCategory[],
  bills: Bill[],
  loans: Loan[],
  settings: Settings,
  month = CURRENT_MONTH,
) {
  const out: { title: string; detail: string }[] = []

  for (const b of budgetsWithSpend(transactions, budgets, month)) {
    if (b.budget > 0 && b.spent > b.budget) {
      out.push({
        title: `${b.name} is over budget`,
        detail: `Spent ${b.spent.toLocaleString()} of ${b.budget.toLocaleString()}.`,
      })
    }
  }

  const t = totals(transactions, month)
  if (settings.monthlyBudget > 0 && t.expenses > settings.monthlyBudget) {
    out.push({
      title: 'Monthly budget exceeded',
      detail: `${Math.round(t.expenses).toLocaleString()} spent against a ${settings.monthlyBudget.toLocaleString()} budget.`,
    })
  }
  if (t.expenses > t.income && t.income > 0) {
    out.push({
      title: 'Spending more than you earned',
      detail: `${Math.round(t.expenses - t.income).toLocaleString()} more went out than came in this month.`,
    })
  }

  const overdueBills = bills.filter((b) => b.status === 'Overdue')
  if (overdueBills.length) {
    out.push({
      title: `${overdueBills.length} bill${overdueBills.length === 1 ? '' : 's'} overdue`,
      detail: overdueBills.map((b) => b.name).join(', ') + '.',
    })
  }

  const overdueLoans = loans.filter((l) => l.status === 'Overdue')
  if (overdueLoans.length) {
    out.push({
      title: `${overdueLoans.length} loan payment${overdueLoans.length === 1 ? '' : 's'} overdue`,
      detail: overdueLoans.map((l) => l.name).join(', ') + '.',
    })
  }

  return out
}

/** Total of every expense currency-converted, used for sanity checks. */
export function monthSpend(transactions: Transaction[], month = CURRENT_MONTH) {
  return transactions
    .filter((t) => t.type === 'expense' && monthKey(t.date) === month)
    .reduce((a, t) => a + toBase(t.amount, t.currency), 0)
}
