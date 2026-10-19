import type { Account, Bill, Currency, IncomeSource, Loan, Note, Transaction, Transfer } from '@/types'
import { TODAY, monthKey, toBase } from '@/lib/format'
import { addDays, duePayments } from '@/lib/dashboard'
import { availableMoney } from '@/lib/selectors'
import { incomeForMonth } from '@/lib/income'
import { installmentStatus } from '@/lib/schedules'

// ============================================================================
// Payment timeline: every movement of real money across a month, in order,
// with the balance it leaves behind — and what one more payment would do to it.
//
// Pure, so every figure on the page is checked in scripts/test-timeline.mjs.
// ============================================================================

export type TimelineKind = 'loan' | 'bill' | 'subscription' | 'instalment' | 'expense' | 'income'

/**
 * Bills and subscriptions are one record type in this app, so the split is by
 * category. Anything recurring that is not one of these reads as a bill.
 */
const SUBSCRIPTION_CATEGORIES = ['Software', 'Entertainment']
const isSubscription = (b: Bill) => SUBSCRIPTION_CATEGORIES.includes(b.category)

export const KIND_LABEL: Record<TimelineKind, string> = {
  loan: 'Loan (EMI)',
  bill: 'Bill',
  subscription: 'Subscription',
  instalment: 'Instalment',
  expense: 'Expense',
  income: 'Income',
}

export const KIND_COLOR: Record<TimelineKind, string> = {
  loan: '#f59e0b',
  bill: '#8b5cf6',
  subscription: '#2563eb',
  instalment: '#ec4899',
  expense: '#ef4444',
  income: '#10b981',
}

export interface TimelineRow {
  id: string
  date: string
  description: string
  kind: TimelineKind
  /** Signed, in base currency: money out is negative. */
  delta: number
  /** The amount as it was entered, for display. */
  amount: number
  currency: Currency
  /** Balance once this row has happened. */
  balanceAfter: number
  status: 'Paid' | 'Upcoming' | 'Overdue'
}

export interface Timeline {
  month: string
  startingBalance: number
  /** Income already received this month plus what the plan still expects. */
  inflow: number
  /** Everything going out across the month. */
  outflow: number
  byKind: Record<TimelineKind, { total: number; count: number }>
  rows: TimelineRow[]
  endBalance: number
  /** The worst point the balance reaches, which is what actually matters. */
  lowest: { date: string; balance: number }
}

const r0 = (n: number) => Math.round(n)
const emptyByKind = (): Record<TimelineKind, { total: number; count: number }> => ({
  loan: { total: 0, count: 0 },
  bill: { total: 0, count: 0 },
  subscription: { total: 0, count: 0 },
  instalment: { total: 0, count: 0 },
  expense: { total: 0, count: 0 },
  income: { total: 0, count: 0 },
})

/** Only accounts holding real money move this line — a card purchase adds debt, not cash. */
const liquidIds = (accounts: Account[]) =>
  new Set(accounts.filter((a) => a.type !== 'card' && a.type !== 'loan').map((a) => a.id))

export interface TimelineInput {
  accounts: Account[]
  txns: Transaction[]
  transfers: Transfer[]
  loans: Loan[]
  bills: Bill[]
  notes: Note[]
  incomeSources: IncomeSource[]
  txnExists: (id: string) => boolean
  month?: string
  today?: string
}

export function paymentTimeline(i: TimelineInput): Timeline {
  const today = i.today ?? TODAY
  const month = i.month ?? monthKey(today)
  const from = `${month}-01`
  const to = `${month}-31`
  const liquid = liquidIds(i.accounts)

  // ---- what the month opened with -----------------------------------------
  // Today's real balance, wound back over everything that has moved since the
  // first of the month. Running it forwards from a guess would make every
  // figure below it a guess too.
  let startingBalance = availableMoney(i.accounts)
  for (const t of i.txns) {
    if (t.date < from || t.date > today || !liquid.has(t.accountId)) continue
    startingBalance -= t.type === 'income' ? toBase(t.amount, t.currency) : -toBase(t.amount, t.currency)
  }
  for (const tr of i.transfers) {
    if (tr.date < from || tr.date > today) continue
    const out = liquid.has(tr.fromAccountId)
    const into = tr.toKind === 'account' && liquid.has(tr.toId)
    if (out && !into) startingBalance += toBase(tr.amount, tr.currency)
    else if (into && !out) startingBalance -= toBase(tr.amount, tr.currency)
  }

  // ---- the rows -----------------------------------------------------------
  const rows: TimelineRow[] = []

  // Money that has already moved, from the records themselves.
  for (const t of i.txns) {
    if (t.date < from || t.date > to || !liquid.has(t.accountId)) continue
    const base = toBase(t.amount, t.currency)
    rows.push({
      id: `txn_${t.id}`,
      date: t.date,
      description: t.description,
      kind: t.type === 'income' ? 'income' : 'expense',
      delta: t.type === 'income' ? base : -base,
      amount: t.amount,
      currency: t.currency,
      balanceAfter: 0,
      status: 'Paid',
    })
  }

  // Commitments still ahead. Anything already settled is in the records above,
  // so counting a paid one here would take the money out twice.
  const due = duePayments(i.loans, i.bills, i.notes, i.txnExists, 400, from)
  for (const d of due) {
    if (d.dueDate < from || d.dueDate > to) continue
    const bill = d.kind === 'bill' ? i.bills.find((b) => `bill_${b.id}` === d.id) : undefined
    const kind: TimelineKind =
      d.kind === 'loan' ? 'loan' : d.kind === 'installment' ? 'instalment' : bill && isSubscription(bill) ? 'subscription' : 'bill'
    rows.push({
      id: d.id,
      date: d.dueDate,
      description: d.title,
      kind,
      delta: -d.base,
      amount: d.amount,
      currency: d.currency,
      balanceAfter: 0,
      status: d.dueDate < today ? 'Overdue' : 'Upcoming',
    })
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description))

  // ---- run the balance through them ---------------------------------------
  const byKind = emptyByKind()
  let running = startingBalance
  let lowest = { date: from, balance: startingBalance }
  for (const row of rows) {
    running += row.delta
    row.balanceAfter = r0(running)
    const bucket = byKind[row.kind]
    bucket.total += Math.abs(row.delta)
    bucket.count += 1
    if (running < lowest.balance) lowest = { date: row.date, balance: r0(running) }
  }

  // Income already received is in the rows; the plan covers the rest of the month.
  const received = byKind.income.total
  const planned = incomeForMonth(i.incomeSources, month, (a, c) => toBase(a, c))
  const outflow = rows.reduce((n, r) => n + (r.delta < 0 ? -r.delta : 0), 0)

  return {
    month,
    startingBalance: r0(startingBalance),
    inflow: r0(Math.max(received, planned)),
    outflow: r0(outflow),
    byKind: Object.fromEntries(
      Object.entries(byKind).map(([k, v]) => [k, { total: r0(v.total), count: v.count }]),
    ) as Timeline['byKind'],
    rows,
    endBalance: r0(running),
    lowest,
  }
}

// ---------------------------------------------------------------------------
// "Can I afford this, on this day?"
// ---------------------------------------------------------------------------

export type Verdict = 'comfortable' | 'tight' | 'shortfall'

export interface Simulation {
  amount: number
  date: string
  newOutflow: number
  newEndBalance: number
  change: number
  /** The worst point the balance reaches once the debit is in. */
  lowest: { date: string; balance: number }
  verdict: Verdict
  headline: string
  reason: string
  /** The soonest day this month it would be comfortable, when the asked-for day is not. */
  betterDate?: string
  /** How much could go out on that day and still stay comfortable. */
  affordable: number
}

/**
 * A cushion rather than zero. Landing exactly on nothing is not affordable in
 * any useful sense: one forgotten direct debit overdraws the account. A tenth
 * of what the month opened with, and never less than 500.
 */
export function buffer(startingBalance: number) {
  return Math.max(500, Math.round(startingBalance * 0.1))
}

/**
 * The lowest the balance gets from `date` onwards, if `amount` leaves then.
 *
 * Deliberately only from that day: a dip earlier in the month happens whatever
 * is decided here, so folding it in would condemn every day equally and make
 * the answer useless. The page reports the month's own low point separately.
 */
function lowestWith(t: Timeline, amount: number, date: string) {
  let running = t.startingBalance
  let low: { date: string; balance: number } | null = null
  let spent = false

  const see = (d: string, v: number) => {
    if (!low || v < low.balance) low = { date: d, balance: Math.round(v) }
  }

  for (const row of t.rows) {
    // The debit lands before anything else on its day: the pessimistic reading,
    // and the one that keeps you solvent when the order is not known.
    if (!spent && row.date >= date) {
      running -= amount
      spent = true
      see(date, running)
    }
    running += row.delta
    if (row.date >= date) see(row.date, running)
  }
  if (!spent) {
    running -= amount
    see(date, running)
  }
  return { low: low ?? { date, balance: Math.round(running) }, end: Math.round(running) }
}

export function simulateDebit(t: Timeline, amount: number, date: string): Simulation {
  const cushion = buffer(t.startingBalance)
  const { low, end } = lowestWith(t, amount, date)

  const verdict: Verdict = low.balance < 0 ? 'shortfall' : low.balance < cushion ? 'tight' : 'comfortable'

  // The most that could leave on this day and still clear the cushion. Derived
  // by difference rather than by searching, so it is exact.
  const without = lowestWith(t, 0, date)
  const affordable = Math.max(0, Math.round(without.low.balance - cushion))

  // If this day does not work, find the soonest one that does — usually after
  // the next payday or once a big commitment has cleared.
  let betterDate: string | undefined
  if (verdict !== 'comfortable') {
    const days = [...new Set(t.rows.map((r) => r.date))].filter((d) => d > date).sort()
    for (const d of [...days, addDays(`${t.month}-01`, 31)]) {
      if (d.slice(0, 7) !== t.month) break
      if (lowestWith(t, amount, d).low.balance >= cushion) { betterDate = d; break }
    }
  }

  const headline =
    verdict === 'shortfall' ? 'This would leave you short'
      : verdict === 'tight' ? 'Possible, but it leaves you tight'
        : 'This looks affordable'

  const reason =
    verdict === 'shortfall'
      ? `Paying this on ${date} takes the balance to ${low.balance.toLocaleString()} on ${low.date}, which is below zero. ` +
        (betterDate ? `Waiting until ${betterDate} would clear it.` : 'There is no day this month that clears it.')
      : verdict === 'tight'
        ? `The balance dips to ${low.balance.toLocaleString()} on ${low.date}, under the ${cushion.toLocaleString()} cushion kept back for anything unplanned. ` +
          (betterDate ? `From ${betterDate} it would be comfortable.` : 'No later day this month clears the cushion either.')
        : `The balance stays at or above ${low.balance.toLocaleString()}, keeping the ${cushion.toLocaleString()} cushion intact.`

  return {
    amount: Math.round(amount),
    date,
    newOutflow: r0(t.outflow + amount),
    newEndBalance: end,
    change: end - t.endBalance,
    lowest: low,
    verdict,
    headline,
    reason,
    betterDate,
    affordable,
  }
}

/** One point per day that moved: the running balance, and what left under each kind. */
export interface TimelinePoint {
  date: string
  balance: number
  out: number
  loan: number
  bill: number
  subscription: number
  instalment: number
  expense: number
}

/** Running balance per day, for the chart, with each kind's outflow broken out. */
export function timelinePoints(t: Timeline): TimelinePoint[] {
  const byDate = new Map<string, TimelineRow[]>()
  for (const r of t.rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r])
  const empty = { loan: 0, bill: 0, subscription: 0, instalment: 0, expense: 0 }
  const points: TimelinePoint[] = []
  let running = t.startingBalance
  points.push({ date: `${t.month}-01`, balance: r0(running), out: 0, ...empty })
  for (const date of [...byDate.keys()].sort()) {
    const rows = byDate.get(date)!
    const kinds = { ...empty }
    let out = 0
    for (const r of rows) {
      running += r.delta
      if (r.delta < 0) {
        out -= r.delta
        if (r.kind !== 'income') kinds[r.kind] -= r.delta
      }
    }
    const point = { date, balance: r0(running), out: r0(out), ...kinds }
    for (const k of Object.keys(empty) as (keyof typeof empty)[]) point[k] = r0(point[k])
    // The first of the month may already carry movements; merge rather than duplicate it.
    if (points.length && points[points.length - 1].date === date) points[points.length - 1] = point
    else points.push(point)
  }
  return points
}

export { installmentStatus }
