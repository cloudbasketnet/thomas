import type { Account, Bill, Loan, Transaction } from '@/types'
import { toBase, monthKey, daysLeft, TODAY } from '@/lib/format'
import { MONTHLY_HISTORY } from '@/data/seed'

export const CURRENT_MONTH = '2026-09'
export const PREV_MONTH = '2026-08'

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

/** Monthly history merged with live transaction data for the current month. */
export function monthlySeries(txns: Transaction[]) {
  const live = totals(txns, CURRENT_MONTH)
  return MONTHLY_HISTORY.map((m) =>
    m.month === 'Sep' ? { ...m, income: Math.round(live.income), expenses: Math.round(live.expenses) } : m,
  )
}

export function accountTotals(accounts: Account[]) {
  const sum = (type: Account['type']) =>
    accounts.filter((a) => a.type === type).reduce((acc, a) => acc + toBase(a.balance, a.currency), 0)
  const bank = sum('bank')
  const cash = sum('cash')
  const card = sum('card')
  const loan = sum('loan')
  return { bank, cash, card, loan, total: bank + cash + card + loan }
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

/** The "This Month Plan" AI-style suggestion shown on the dashboard. */
export function monthPlan(txns: Transaction[], loans: Loan[], bills: Bill[], goalsMonthly = 1500) {
  const t = totals(txns, CURRENT_MONTH)
  const requiredExpenses = Math.round(t.expenses)
  const upcomingLoans = Math.round(loanSummary(loans).dueAmount + 500)
  const upcomingBills = Math.round(billSummary(bills).upcomingTotal)
  const savings = goalsMonthly
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
