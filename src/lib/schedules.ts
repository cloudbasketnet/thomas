import type { Currency, Installment, Note } from '@/types'

export type InstallmentStatus = 'Planned' | 'Paid' | 'Overdue'

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * An instalment is Paid once it points at a payment that still exists (or the
 * user marked it paid by hand), Overdue once its date has passed unpaid, and
 * Planned otherwise. Derived, so it can never disagree with the transactions.
 */
export function installmentStatus(i: Installment, today: string, txnExists: (id: string) => boolean): InstallmentStatus {
  if ((i.paidTxnId && txnExists(i.paidTxnId)) || (!i.paidTxnId && i.paidAmount !== undefined && i.paidDate)) return 'Paid'
  return i.dueDate < today ? 'Overdue' : 'Planned'
}

export function scheduleSummary(note: Pick<Note, 'schedule'>, today: string, txnExists: (id: string) => boolean) {
  const list = [...(note.schedule ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  let total = 0
  let paid = 0
  for (const i of list) {
    total += i.amount
    if (installmentStatus(i, today, txnExists) === 'Paid') paid += i.paidAmount ?? i.amount
  }
  const next = list.find((i) => installmentStatus(i, today, txnExists) !== 'Paid')
  return {
    list,
    total: r2(total),
    paid: r2(paid),
    outstanding: r2(Math.max(0, total - paid)),
    next,
    nextDate: next?.dueDate,
    overdue: list.filter((i) => installmentStatus(i, today, txnExists) === 'Overdue').length,
  }
}

/** Instalments that need a reminder now: due within their reminder window and not paid. */
export function dueReminders(notes: Note[], today: string, txnExists: (id: string) => boolean) {
  const out: { note: Note; installment: Installment; days: number }[] = []
  for (const note of notes) {
    if (note.done) continue
    for (const i of note.schedule ?? []) {
      if (installmentStatus(i, today, txnExists) === 'Paid') continue
      const days = Math.round((new Date(i.dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
      if (days <= (i.remindDays ?? 7)) out.push({ note, installment: i, days })
    }
  }
  return out.sort((a, b) => a.days - b.days)
}

/**
 * Every plan added together, in ONE currency. A plan's own card reports in that
 * plan's currency, but these figures span plans, so each instalment is
 * converted first: 100,000 rupees is not 100,000 dirhams, and adding the raw
 * figures would claim it is. `toBase` is injected so this file stays pure.
 */
export function allSchedulesTotal(
  notes: Note[],
  today: string,
  txnExists: (id: string) => boolean,
  toBase: (amount: number, currency: Currency) => number,
) {
  let total = 0
  let paid = 0
  for (const n of notes) {
    for (const i of n.schedule ?? []) {
      total += toBase(i.amount, i.currency)
      if (installmentStatus(i, today, txnExists) === 'Paid') paid += toBase(i.paidAmount ?? i.amount, i.currency)
    }
  }
  return { total: r2(total), paid: r2(paid), outstanding: r2(Math.max(0, total - paid)) }
}

// ---------------------------------------------------------------------------
// Building a schedule from a few figures
// ---------------------------------------------------------------------------

/**
 * A plan is three numbers — the total, the monthly payment and how many months
 * — and knowing any TWO gives the third. Which two you have depends on what
 * you were told: a fee letter gives a total and a term, a loan gives a total
 * and an EMI, a subscription gives a monthly figure and a term.
 */
export type GenerateMode = 'total-count' | 'total-monthly' | 'monthly-count'

/** Nobody has a real plan longer than this, and it stops a tiny EMI building a runaway schedule. */
export const MAX_INSTALLMENTS = 600

export interface ResolvedPlan {
  count: number
  /** The regular monthly payment. */
  per: number
  total: number
  /** The final payment. Smaller than `per` when the figures do not divide evenly. */
  last: number
  /** True when the two figures given imply more instalments than are allowed. */
  capped: boolean
  /** False until both figures this mode needs have been entered. */
  valid: boolean
}

const EMPTY: ResolvedPlan = { count: 0, per: 0, total: 0, last: 0, capped: false, valid: false }
const positive = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/**
 * Work the plan out from whichever two figures are known.
 *
 * Where it does not divide evenly the LAST instalment carries the difference,
 * so the schedule always adds up to the total rather than quietly coming to
 * less than the fee. The one exception is 'monthly-count', where the monthly
 * figure is what was agreed — every payment is that amount and the total
 * follows from it.
 */
export function resolvePlan(mode: GenerateMode, i: { total?: number; monthly?: number; count?: number }): ResolvedPlan {
  const count = Math.max(1, Math.round(i.count ?? 0) || 0)

  if (mode === 'monthly-count') {
    if (!positive(i.monthly) || !positive(i.count)) return EMPTY
    const per = r2(i.monthly)
    const n = Math.min(count, MAX_INSTALLMENTS)
    return { count: n, per, total: r2(per * n), last: per, capped: count > MAX_INSTALLMENTS, valid: true }
  }

  if (mode === 'total-count') {
    if (!positive(i.total) || !positive(i.count)) return EMPTY
    const n = Math.min(count, MAX_INSTALLMENTS)
    const per = r2(i.total / n)
    return { count: n, per, total: r2(i.total), last: r2(i.total - per * (n - 1)), capped: count > MAX_INSTALLMENTS, valid: true }
  }

  // total-monthly: the months are what you do not know.
  if (!positive(i.total) || !positive(i.monthly)) return EMPTY
  const per = r2(i.monthly)
  // A monthly payment larger than the total is simply one payment of the total.
  const needed = Math.ceil(r2(i.total) / per)
  const n = Math.min(Math.max(1, needed), MAX_INSTALLMENTS)
  const capped = needed > MAX_INSTALLMENTS
  return {
    count: n,
    per,
    total: r2(i.total),
    // The final payment is whatever is left, which is how a last instalment
    // usually works: 10,000 at 3,000 a month is 3,000 x 3 then 1,000.
    last: capped ? per : r2(i.total - per * (n - 1)),
    capped,
    valid: !capped,
  }
}

/** Add `n` months to a yyyy-MM-dd date, keeping it inside the target month. */
export function addMonthsClamped(date: string, n: number): string {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7)) - 1
  const day = Number(date.slice(8, 10))
  // The 31st of a month has no counterpart in November, and letting the date
  // roll over would push that instalment into the month after the one it
  // belongs to. Clamp it to the last day instead.
  const lastDay = new Date(y, m + n + 1, 0).getDate()
  const d = new Date(y, m + n, Math.min(day, lastDay))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface GenerateInput {
  mode: GenerateMode
  total?: number
  monthly?: number
  count?: number
  /** First due date, yyyy-MM-dd. */
  start: string
  currency: Currency
  remindDays?: number
  makeId: () => string
}

/** Build the evenly spaced monthly schedule the figures describe. */
export function generateSchedule(i: GenerateInput): Installment[] {
  const plan = resolvePlan(i.mode, { total: i.total, monthly: i.monthly, count: i.count })
  if (!plan.valid) return []

  return Array.from({ length: plan.count }, (_, k) => ({
    id: i.makeId(),
    label: `Installment ${k + 1}`,
    dueDate: addMonthsClamped(i.start, k),
    amount: k === plan.count - 1 ? plan.last : plan.per,
    currency: i.currency,
    remindDays: i.remindDays ?? 7,
  }))
}
